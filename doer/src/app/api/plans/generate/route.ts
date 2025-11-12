import { NextRequest, NextResponse } from 'next/server'

import { generateRoadmapContent } from '@/lib/ai'
import { authenticateApiRequest, ApiTokenError } from '@/lib/auth/api-token-auth'
import { addDays, formatDateForDB } from '@/lib/date-utils'
import { generateTaskSchedule } from '@/lib/roadmap-server'
import { createClient } from '@/lib/supabase/server'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'

const PLAN_GENERATION_CREDIT_COST = 5

export async function POST(req: NextRequest) {
  let authContext: Awaited<ReturnType<typeof authenticateApiRequest>> | null = null
  let reserved = false
  let creditMetadata: Record<string, unknown> = { route: 'plans.generate' }

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
    authContext = await authenticateApiRequest(req.headers, {
      requiredScopes: ['plans.generate'],
    })

    await authContext.creditService.reserve('api_credits', PLAN_GENERATION_CREDIT_COST, creditMetadata)
    reserved = true
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

    console.error('Failed to authenticate API token for plan generation:', error)
    return NextResponse.json(
      { error: 'API_TOKEN_ERROR', message: 'Unable to authenticate API token.' },
      { status: 401 }
    )
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return fail(
        401,
        { error: 'User not authenticated' },
        'user_not_authenticated',
        { user_error: userError?.message }
      )
    }

    console.log('Fetching onboarding data for user:', user.id)

    const { data: onboardingData, error: onboardingError } = await supabase
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

    if (!onboardingData) {
      console.error('No unlinked onboarding response found for user:', user.id)
      return fail(
        400,
        { error: 'No onboarding data found. Please complete onboarding first.' },
        'onboarding_not_found'
      )
    }

    console.log('Found onboarding data:', onboardingData.id, 'for goal:', onboardingData.goal_text)

    const finalGoalText = onboardingData.goal_text
    const finalClarifications = {
      clarification_1: onboardingData.clarification_1,
      clarification_2: onboardingData.clarification_2,
    }
    const finalClarificationQuestions = onboardingData.clarification_questions
    const finalStartDate = onboardingData.start_date

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

    const expectedDailyTasks = aiContent.timeline_days - 2
    const actualDailyTasks = aiContent.daily_tasks.length

    if (actualDailyTasks !== expectedDailyTasks) {
      console.warn(`⚠️ Adjusting daily task count: ${actualDailyTasks} → ${expectedDailyTasks}`)

      if (actualDailyTasks < expectedDailyTasks) {
        const tasksNeeded = expectedDailyTasks - actualDailyTasks

        if (actualDailyTasks < 3) {
          console.error('⚠️ AI generated insufficient daily tasks for padding. Creating generic tasks.')
          const genericTasks = [
            { name: 'Review your progress', details: 'Take time to reflect on what you have learned.' },
            { name: 'Practice core skills', details: 'Focus on fundamental techniques.' },
            { name: 'Study relevant materials', details: 'Continue learning about your goal.' },
          ]

          for (let i = 0; i < tasksNeeded; i++) {
            const template = genericTasks[i % genericTasks.length]
            aiContent.daily_tasks.push({
              name: `${template.name} (Day ${actualDailyTasks + i + 1})`,
              details: template.details,
            })
          }
        } else {
          const sampleSize = Math.min(10, actualDailyTasks)
          const sampleTasks = aiContent.daily_tasks.slice(-sampleSize)

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
            aiContent.daily_tasks.push({
              name: variationFn(template.name),
              details: template.details,
            })
          }
          console.log(`✅ Padded ${tasksNeeded} daily tasks with grammatically correct variations`)
        }
      } else {
        const tasksToRemove = actualDailyTasks - expectedDailyTasks
        aiContent.daily_tasks = aiContent.daily_tasks.slice(0, expectedDailyTasks)
        console.log(`✅ Trimmed ${tasksToRemove} excess daily tasks`)
      }
    }

    if (aiContent.milestone_tasks.length < aiContent.milestones.length) {
      console.error('Insufficient milestone tasks:', {
        expected: aiContent.milestones.length,
        actual: aiContent.milestone_tasks.length,
      })
      await supabase.from('onboarding_responses').delete().eq('user_id', user.id)
      return fail(
        400,
        {
          error: 'VALIDATION_FAILED',
          message: 'AI generated insufficient milestone tasks. Please restart onboarding.',
          redirect: '/onboarding',
        },
        'milestone_validation_failed',
        { expected: aiContent.milestones.length, actual: aiContent.milestone_tasks.length }
      )
    }

    const [year, month, day] = finalStartDate.split('-').map(Number)
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
    const endDate = addDays(startDate, aiContent.timeline_days - 1)
    const calculatedEndDate = endDate.toISOString().split('T')[0]

    console.log('✅ AI content validated:', {
      timeline_days: aiContent.timeline_days,
      ai_end_date: aiContent.end_date,
      calculated_end_date: calculatedEndDate,
      milestones: aiContent.milestones.length,
      milestone_tasks: aiContent.milestone_tasks.length,
      daily_tasks: aiContent.daily_tasks.length,
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

    const { error: updateOnboardingError } = await supabase
      .from('onboarding_responses')
      .update({ plan_id: plan.id })
      .eq('user_id', user.id)
      .is('plan_id', null)

    if (updateOnboardingError) {
      console.error('Error updating onboarding_responses with plan_id:', updateOnboardingError)
    }

    const milestoneMap = new Map<number, string>()
    const milestoneCount = aiContent.milestones.length
    const totalDays = aiContent.timeline_days

    for (let i = 0; i < aiContent.milestones.length; i++) {
      const milestone = aiContent.milestones[i]

      const dayOffset = Math.floor((totalDays / (milestoneCount + 1)) * (i + 1))
      const targetDate = addDays(startDate, dayOffset)
      const targetDateStr = formatDateForDB(targetDate)

      const { data: milestoneData, error: milestoneError } = await supabase
        .from('milestones')
        .insert({
          plan_id: plan.id,
          user_id: user.id,
          idx: i + 1,
          name: milestone.name,
          rationale: milestone.rationale,
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

    const allTasks = [
      ...aiContent.milestone_tasks.map((task: any, index: number) => ({
        plan_id: plan.id,
        user_id: user.id,
        milestone_id: milestoneMap.get(task.milestone_idx) || null,
        idx: index + 1,
        name: task.name,
        category: 'milestone_task',
      })),
      ...aiContent.daily_tasks.map((task: any, index: number) => ({
        plan_id: plan.id,
        user_id: user.id,
        milestone_id: null,
        idx: aiContent.milestone_tasks.length + index + 1,
        name: task.name,
        category: 'daily_task',
      })),
    ]

    console.log('Inserting tasks:', {
      milestone_tasks: aiContent.milestone_tasks.length,
      daily_tasks: aiContent.daily_tasks.length,
      total_tasks: allTasks.length,
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