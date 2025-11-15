import { NextRequest, NextResponse } from 'next/server'

import { generateRoadmapContent } from '@/lib/ai'
import { authenticateApiRequest, ApiTokenError } from '@/lib/auth/api-token-auth'
import { addDays, formatDateForDB } from '@/lib/date-utils'
import { generateTaskSchedule } from '@/lib/roadmap-server'
import { createClient } from '@/lib/supabase/server'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'
import { autoAssignBasicPlan } from '@/lib/stripe/auto-assign-basic'

const PLAN_GENERATION_CREDIT_COST = 1 // 1 OpenAI call: generateRoadmapContent

export async function POST(req: NextRequest) {
  let authContext: Awaited<ReturnType<typeof authenticateApiRequest>> | null = null
  let reserved = false
  let creditMetadata: Record<string, unknown> = { route: 'plans.generate' }
  let sessionUser: any = null // Store user from session auth to avoid re-fetching

  const fail = async (
    status: number,
    body: Record<string, unknown>,
    reason: string,
    extras: Record<string, unknown> = {}
  ) => {
    if (reserved && authContext) {
      try {
        await authContext.creditService.release('api_credits', PLAN_GENERATION_CREDIT_COST, {
          ...creditMetadata,
          reason,
          ...extras,
          outcome: 'release',
        })
      } catch (releaseError) {
        console.error('Failed to release plan generation credits:', releaseError)
      }
      reserved = false
    }

    return NextResponse.json(body, { status })
  }

  try {
    // Authenticate user via API token or session
    try {
      authContext = await authenticateApiRequest(req.headers, {
        requiredScopes: ['plans.generate'],
      })
      // Reserve credits for OpenAI call
      await authContext.creditService.reserve('api_credits', PLAN_GENERATION_CREDIT_COST, creditMetadata)
      reserved = true
    } catch (authError) {
      // If API token auth fails, try session auth (for web UI)
      const supabase = await createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        // If it was an ApiTokenError, return that specific error
        if (authError instanceof ApiTokenError) {
          return NextResponse.json(
            { error: 'API_TOKEN_ERROR', message: authError.message },
            { status: authError.status }
          )
        }
        return fail(
          401,
          { error: 'User not authenticated' },
          'user_not_authenticated',
          { user_error: userError?.message }
        )
      }
      // For session auth, create a CreditService instance
      // Store the user so we don't need to fetch it again
      sessionUser = user
      const { CreditService } = await import('@/lib/usage/credit-service')
      const creditService = new CreditService(user.id, undefined)
      await creditService.getSubscription()
      authContext = {
        tokenId: '', // Empty string for session auth
        userId: user.id,
        scopes: ['plans.generate'], // Include scope for session auth
        expiresAt: null,
        creditService,
      }
      // Reserve credits for OpenAI call
      try {
        await creditService.reserve('api_credits', PLAN_GENERATION_CREDIT_COST, creditMetadata)
        reserved = true
      } catch (creditError) {
        if (creditError instanceof UsageLimitExceeded) {
          return NextResponse.json(
            {
              error: 'USAGE_LIMIT_EXCEEDED',
              message: 'You have exhausted your plan generation credits for this billing cycle.',
              remaining: creditError.remaining,
            },
            { status: 429 }
          )
        }
        throw creditError
      }
    }
  } catch (error) {
    if (error instanceof UsageLimitExceeded) {
      return NextResponse.json(
        {
          error: 'USAGE_LIMIT_EXCEEDED',
          message: 'You have exhausted your plan generation credits for this billing cycle.',
          remaining: error.remaining,
        },
        { status: 429 }
      )
    }

    if (error instanceof ApiTokenError) {
      return NextResponse.json(
        { error: 'API_TOKEN_ERROR', message: error.message },
        { status: error.status }
      )
    }

    console.error('Failed to authenticate for plan generation:', error)
    return NextResponse.json(
      { error: 'AUTHENTICATION_ERROR', message: 'Unable to authenticate request.' },
      { status: 401 }
    )
  }

  if (!authContext) {
    return NextResponse.json(
      { error: 'AUTHENTICATION_ERROR', message: 'Authentication context not available.' },
      { status: 401 }
    )
  }

  try {
    const supabase = await createClient()

    // Get user - for session auth we already have it, for API token auth we need to fetch it
    let user = sessionUser
    if (!user) {
      // Need to fetch full user object (API token auth case)
      const {
        data: { user: fetchedUser },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !fetchedUser) {
        return fail(
          401,
          { error: 'User not authenticated' },
          'user_not_authenticated',
          { user_error: userError?.message }
        )
      }
      user = fetchedUser
    }

    // Parse request body - onboarding data may come from request body or database
    const body = await req.json().catch(() => ({}))
    const requestGoalText = body.goal_text || body.goal
    const requestStartDate = body.start_date
    const requestClarifications = body.clarifications || {}
    const requestClarificationQuestions = body.clarification_questions || []

    let onboardingData: any = null
    let finalGoalText: string
    let finalStartDate: string
    let finalClarifications: Record<string, string>
    let finalClarificationQuestions: any

    // If data is provided in request body, save it to database first (or use it directly)
    if (requestGoalText && requestStartDate) {
      console.log('Onboarding data provided in request body, saving to database...')
      
      // Prepare responses JSONB object
      const responses = {
        goal_text: requestGoalText,
        start_date: requestStartDate,
        clarification_1: requestClarifications.clarification_1,
        clarification_2: requestClarifications.clarification_2,
        clarification_questions: requestClarificationQuestions,
        clarifications: requestClarifications,
      }

      // Save to database
      const { data: savedResponse, error: saveError } = await supabase
        .from('onboarding_responses')
        .insert({
          user_id: user.id,
          responses,
        })
        .select()
        .single()

      if (saveError) {
        console.error('Error saving onboarding data:', saveError)
        // Continue anyway - we can use the request body data directly
        console.warn('Continuing with request body data despite save error')
      } else {
        console.log('Saved onboarding response to database:', savedResponse.id)
        onboardingData = savedResponse
      }

      // Use request body data
      finalGoalText = requestGoalText
      finalStartDate = requestStartDate
      finalClarifications = {
        clarification_1: requestClarifications.clarification_1 || requestClarifications['clarification_1'],
        clarification_2: requestClarifications.clarification_2 || requestClarifications['clarification_2'],
      }
      finalClarificationQuestions = requestClarificationQuestions
    } else {
      // No data in request body - fetch from database
      console.log('Fetching onboarding data from database for user:', user.id)

      const { data: fetchedData, error: onboardingError } = await supabase
        .from('onboarding_responses')
        .select('*')
        .eq('user_id', user.id)
        .is('plan_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (onboardingError) {
        console.error('Error fetching onboarding data:', onboardingError)
        return fail(
          500,
          { error: 'Failed to fetch onboarding data', details: onboardingError.message },
          'onboarding_fetch_failed',
          { code: onboardingError.code }
        )
      }

      if (!fetchedData) {
        console.error('No unlinked onboarding response found for user:', user.id)
        return fail(
          400,
          { error: 'No onboarding data found. Please provide goal_text and start_date in the request, or complete onboarding first.' },
          'onboarding_not_found'
        )
      }

      onboardingData = fetchedData
      console.log('Found onboarding data:', onboardingData.id)

      // Extract data from JSONB responses column
      const responses = onboardingData.responses || {}
      finalGoalText = responses.goal_text || onboardingData.goal_text
      finalStartDate = responses.start_date || onboardingData.start_date
      finalClarifications = {
        clarification_1: responses.clarification_1 || onboardingData.clarification_1,
        clarification_2: responses.clarification_2 || onboardingData.clarification_2,
      }
      finalClarificationQuestions = responses.clarification_questions || onboardingData.clarification_questions
    }

    if (!finalGoalText || !finalStartDate) {
      return fail(
        400,
        { error: 'Missing required fields: goal_text or start_date' },
        'missing_required_fields'
      )
    }

    console.log('Generating roadmap content with AI...')
    let aiContent: any

    try {
      aiContent = await generateRoadmapContent({
        goal: finalGoalText,
        start_date: finalStartDate,
        clarifications: finalClarifications,
        clarificationQuestions: finalClarificationQuestions,
      })

      console.log('✅ AI content generated successfully')
    } catch (error) {
      console.error('❌ AI content generation failed:', error)
      return fail(
        500,
        {
          error: 'AI_GENERATION_FAILED',
          message: 'Failed to generate roadmap content. Please try again.',
        },
        'ai_generation_failed',
        { error: error instanceof Error ? error.message : 'unknown' }
      )
    }

    // Ensure aiContent has tasks array
    if (!aiContent.tasks || !Array.isArray(aiContent.tasks)) {
      console.error('❌ AI content missing tasks array:', aiContent)
      return fail(
        500,
        {
          error: 'AI_GENERATION_INVALID',
          message: 'AI generated invalid content structure. Please try again.',
        },
        'ai_generation_invalid',
        { aiContent: JSON.stringify(aiContent).substring(0, 500) }
      )
    }

    const expectedDailyTasks = aiContent.timeline_days - 2
    const actualDailyTasks = aiContent.tasks.length

    if (actualDailyTasks !== expectedDailyTasks) {
      console.warn(`⚠️ Adjusting daily task count: ${actualDailyTasks} → ${expectedDailyTasks}`)

      if (actualDailyTasks < expectedDailyTasks) {
        const tasksNeeded = expectedDailyTasks - actualDailyTasks

        if (actualDailyTasks < 3) {
          console.error('⚠️ AI generated insufficient daily tasks for padding. Creating generic tasks.')
          const genericTasks = [
            { name: 'Review your progress', details: 'Take time to reflect on what you have learned.', estimated_duration_minutes: 20, priority: 3 as const },
            { name: 'Practice core skills', details: 'Focus on fundamental techniques.', estimated_duration_minutes: 30, priority: 2 as const },
            { name: 'Study relevant materials', details: 'Continue learning about your goal.', estimated_duration_minutes: 25, priority: 2 as const },
          ]

          for (let i = 0; i < tasksNeeded; i++) {
            const template = genericTasks[i % genericTasks.length]
            aiContent.tasks.push({
              name: `${template.name} (Day ${actualDailyTasks + i + 1})`,
              details: template.details,
              estimated_duration_minutes: template.estimated_duration_minutes,
              priority: template.priority,
            })
          }
        } else {
          const sampleSize = Math.min(10, actualDailyTasks)
          const sampleTasks = aiContent.tasks.slice(-sampleSize)

          for (let i = 0; i < tasksNeeded; i++) {
            const template = sampleTasks[i % sampleTasks.length]

            const variations = [
              (name: string) =>
                `Review your progress on ${name
                  .toLowerCase()
                  .replace(/^(practice|learn|study|research|watch|read|create|attend) /, '$1ing ')}`,
              (name: string) =>
                `Continue ${name.toLowerCase().replace(/^(practice|learn|study|research|create|attend) /, '$1ing ')}`,
              (name: string) =>
                `Spend more time ${name
                  .toLowerCase()
                  .replace(/^(practice|learn|study|research|watch|read|create|attend) /, '$1ing ')}`,
              (name: string) =>
                `Revisit ${name
                  .toLowerCase()
                  .replace(/^(practice|learn|study|research|watch|read|create|attend) /, '$1ing ')}`,
              (name: string) =>
                `Dedicate additional time to ${name
                  .toLowerCase()
                  .replace(/^(practice|learn|study|research|watch|read|create|attend) /, '$1ing ')}`,
            ]

            const variationFn = variations[i % variations.length]
            aiContent.tasks.push({
              name: variationFn(template.name),
              details: template.details,
              estimated_duration_minutes: template.estimated_duration_minutes || 30,
              priority: (template.priority as 1 | 2 | 3 | 4) || 3,
            })
          }
          console.log(`✅ Padded ${tasksNeeded} daily tasks with grammatically correct variations`)
        }
      } else {
        const tasksToRemove = actualDailyTasks - expectedDailyTasks
        aiContent.tasks = aiContent.tasks.slice(0, expectedDailyTasks)
        console.log(`✅ Trimmed ${tasksToRemove} excess tasks`)
      }
    }

    // Validate that we have enough tasks
    // For a plan with N days, we typically want at least N-1 tasks (one per day minus start/end days)
    if (aiContent.tasks.length < Math.max(1, aiContent.timeline_days - 2)) {
      console.error('Insufficient tasks:', {
        expected: Math.max(1, aiContent.timeline_days - 2),
        actual: aiContent.tasks.length,
      })
      await supabase.from('onboarding_responses').delete().eq('user_id', user.id)
      return fail(
        400,
        {
          error: 'VALIDATION_FAILED',
          message: 'AI generated insufficient tasks. Please restart onboarding.',
          redirect: '/onboarding',
        },
        'task_validation_failed',
        { expected: Math.max(1, aiContent.timeline_days - 2), actual: aiContent.tasks.length }
      )
    }

    const [year, month, day] = finalStartDate.split('-').map(Number)
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
    const endDate = addDays(startDate, aiContent.timeline_days - 1)
    const calculatedEndDate = endDate.toISOString().split('T')[0]

    // Initialize milestones array early for validation logging
    const milestones = aiContent.milestones || []

    console.log('✅ AI content validated:', {
      timeline_days: aiContent.timeline_days,
      ai_end_date: aiContent.end_date,
      calculated_end_date: calculatedEndDate,
      milestones: milestones.length,
      tasks: aiContent.tasks.length,
    })

    console.log('Checking for existing active plans...')

    const { data: existingPlans, error: fetchError } = await supabase
      .from('plans')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (fetchError) {
      console.error('Error fetching existing active plans:', fetchError)
      return fail(
        500,
        {
          error: 'Failed to check for existing plans',
          details: fetchError.message,
        },
        'existing_plan_fetch_failed',
        { code: fetchError.code }
      )
    }

    if (existingPlans && existingPlans.length > 0) {
      console.log(
        `Found ${existingPlans.length} existing active plan(s), setting to paused:`,
        existingPlans.map((p) => p.id)
      )

      for (const plan of existingPlans) {
        const { error: pauseError } = await supabase
          .from('plans')
          .update({ status: 'paused' })
          .eq('id', plan.id)
          .eq('user_id', user.id)

        if (pauseError) {
          console.error('Error pausing existing plan:', pauseError)
          return fail(
            500,
            {
              error: 'Failed to pause existing plan',
              details: pauseError.message,
              hint: 'Please try again or contact support if the issue persists',
            },
            'existing_plan_pause_failed',
            { code: pauseError.code, plan_id: plan.id }
          )
        }
      }

      console.log('✅ Successfully paused all existing active plans')

      await new Promise((resolve) => setTimeout(resolve, 100))
    } else {
      console.log('No existing active plans found - this will be the first plan')
    }

    console.log('Proceeding to insert new plan with status=active...')

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        user_id: user.id,
        goal_text: finalGoalText,
        clarifications: finalClarifications,
        start_date: finalStartDate,
        end_date: calculatedEndDate,
        status: 'active',
        plan_type: 'ai',
        summary_data: {
          total_duration_days: aiContent.timeline_days,
          goal_title: aiContent.goal_title,
          goal_summary: aiContent.plan_summary,
        },
      })
      .select()
      .single()

    if (planError || !plan) {
      console.error('Plan insert error:', planError)
      return fail(
        500,
        { error: planError?.message ?? 'Failed to insert plan' },
        'plan_insert_failed',
        { code: planError?.code }
      )
    }

    creditMetadata = {
      ...creditMetadata,
      plan_id: plan.id,
      timeline_days: aiContent.timeline_days,
    }

    // Link the onboarding response to the created plan
    if (onboardingData?.id) {
      const { error: updateOnboardingError } = await supabase
        .from('onboarding_responses')
        .update({ plan_id: plan.id })
        .eq('id', onboardingData.id)

      if (updateOnboardingError) {
        console.error('Error updating onboarding_responses with plan_id:', updateOnboardingError)
      } else {
        console.log('Linked onboarding response to plan:', onboardingData.id, '→', plan.id)
      }
    } else {
      // Fallback: try to link any unlinked response for this user
      const { error: updateOnboardingError } = await supabase
        .from('onboarding_responses')
        .update({ plan_id: plan.id })
        .eq('user_id', user.id)
        .is('plan_id', null)
        .limit(1)

      if (updateOnboardingError) {
        console.error('Error updating onboarding_responses with plan_id:', updateOnboardingError)
      }
    }

    // Handle milestones if they exist in AI content
    // Milestones are optional - the AI function may not always return them
    const milestoneMap = new Map<number, string>()
    const milestoneCount = milestones.length
    const totalDays = aiContent.timeline_days

    if (milestoneCount > 0) {
      console.log(`Creating ${milestoneCount} milestones for plan`)
      for (let i = 0; i < milestoneCount; i++) {
        const milestone = milestones[i]

        const dayOffset = Math.floor((totalDays / (milestoneCount + 1)) * (i + 1))
        const targetDate = addDays(startDate, dayOffset)
        const targetDateStr = formatDateForDB(targetDate)

        const { data: milestoneData, error: milestoneError } = await supabase
          .from('milestones')
          .insert({
            plan_id: plan.id,
            user_id: user.id,
            idx: i + 1,
            name: milestone.name || `Milestone ${i + 1}`,
            rationale: milestone.rationale || '',
            target_date: targetDateStr,
          })
          .select()
          .single()

        if (milestoneError) {
          console.error('Milestone insert error:', milestoneError)
          continue
        }

        milestoneMap.set(i + 1, milestoneData.id)
      }
      console.log(`✅ Created ${milestoneMap.size} milestones`)
    } else {
      console.log('No milestones in AI content - skipping milestone creation')
    }

    // Use the unified tasks array from AI content
    // All tasks are inserted as daily tasks (milestone association happens via generateTaskSchedule)
    const allTasks = aiContent.tasks.map((task: any, index: number) => ({
      plan_id: plan.id,
      user_id: user.id,
      milestone_id: null, // Will be set by generateTaskSchedule if needed
      idx: index + 1,
      name: task.name,
      details: task.details,
      estimated_duration_minutes: task.estimated_duration_minutes || 30,
      priority: task.priority || 3,
      category: 'daily_task', // All tasks from AI are daily tasks
    }))

    console.log('Inserting tasks:', {
      total_tasks: allTasks.length,
      tasks: aiContent.tasks.length,
    })

    const { error: taskError } = await supabase.from('tasks').insert(allTasks)
    if (taskError) {
      console.error('Task insert error:', taskError)
      return fail(
        500,
        { error: taskError.message },
        'task_insert_failed',
        { code: taskError.code }
      )
    }

    try {
      await generateTaskSchedule(plan.id, startDate, endDate)
      console.log(`✅ Task schedule generated for ${aiContent.timeline_days}-day timeline`)
    } catch (scheduleError) {
      console.error('Error generating task schedule:', scheduleError)
    }

    if (reserved && authContext) {
      try {
        await authContext.creditService.commit('api_credits', PLAN_GENERATION_CREDIT_COST, {
          ...creditMetadata,
          outcome: 'commit',
          task_count: allTasks.length,
        })
        reserved = false
      } catch (commitError) {
        console.error('Failed to commit plan generation credits:', commitError)
      }
    }

    return NextResponse.json(
      {
        success: true,
        plan,
        timeline: {
          days: aiContent.timeline_days,
        },
        milestones: aiContent.milestones.length,
        tasks: {
          milestone: aiContent.milestone_tasks.length,
          daily: aiContent.daily_tasks.length,
          total: allTasks.length,
        },
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('Generate Error:', err)
    console.error('Error details:', {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
    })

    return fail(
      500,
      {
        error: 'Unexpected error during plan generation',
        message: err?.message || 'Unknown error',
        details: err?.details || 'No additional details',
      },
      'exception',
      { error: err?.message }
    )
  }
}