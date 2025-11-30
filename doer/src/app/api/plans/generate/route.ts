import { NextRequest, NextResponse } from 'next/server'

import { generateRoadmapContent } from '@/lib/ai'
import { authenticateApiRequest, ApiTokenError } from '@/lib/auth/api-token-auth'
import { addDays, formatDateForDB, parseDateFromDB, formatTimeForDisplay } from '@/lib/date-utils'
import { generateTaskSchedule } from '@/lib/roadmap-server'
import { createClient } from '@/lib/supabase/server'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'
import { autoAssignBasicPlan } from '@/lib/stripe/auto-assign-basic'
import { detectUrgencyIndicators } from '@/lib/goal-analysis'
import { calculateRemainingTime, calculateDaysNeeded } from '@/lib/time-constraints'

// Force dynamic rendering since we use cookies for authentication (session auth fallback)
export const dynamic = 'force-dynamic'

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
    const timezoneOffset = body.timezone_offset ?? 0 // Timezone offset in minutes (negative for ahead of UTC)

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

    // Fetch busy slots from all calendar providers (provider-agnostic)
    let availability = undefined
    const startDate = parseDateFromDB(finalStartDate)
    try {
      const { getBusySlotsForUser } = await import('@/lib/calendar/busy-slots')
      // Estimate end date (will be refined by AI)
      const estimatedEndDate = new Date(startDate)
      estimatedEndDate.setDate(estimatedEndDate.getDate() + 21) // Max 21 days
      
      const busySlots = await getBusySlotsForUser(user.id, startDate, estimatedEndDate)
      
      if (busySlots.length > 0) {
        availability = {
          busySlots,
          timeOff: [],
        }
        console.log(`Found ${busySlots.length} busy slots from calendar`)
      }
    } catch (error) {
      console.warn('Failed to fetch busy slots for plan generation:', error)
      // Continue without availability if fetch fails
    }

    // Detect urgency from goal text and clarifications
    const urgencyAnalysis = detectUrgencyIndicators(finalGoalText, finalClarifications)
    console.log('🔍 Urgency analysis:', urgencyAnalysis)

    // Calculate time constraints if start date is today
    // Use user's local timezone for accurate time calculations
    const now = new Date()
    // Adjust server time to user's local timezone
    const userLocalTime = new Date(now.getTime() - (timezoneOffset * 60 * 1000))
    const todayUTC = new Date(Date.UTC(userLocalTime.getFullYear(), userLocalTime.getMonth(), userLocalTime.getDate()))
    const startDateUTC = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()))
    const isStartDateToday = startDateUTC.getTime() === todayUTC.getTime()
    let timeConstraints: { isStartDateToday: boolean; remainingMinutes: number; urgencyLevel: 'high' | 'medium' | 'low' | 'none'; requiresToday: boolean; timeFormat?: '12h' | '24h'; userLocalTime?: Date } | undefined

    if (isStartDateToday) {
      // Fetch user's workday settings and time format preference
      const { data: settings } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle()
      
      const prefs = (settings?.preferences as any) ?? {}
      const workdaySettings = prefs.workday || {}
      const timeFormat = prefs.time_format || '12h' // Default to 12h if not set
      
      // Use user's local time for remaining time calculation
      const remainingTime = calculateRemainingTime(startDate, workdaySettings, userLocalTime)
      
      timeConstraints = {
        isStartDateToday: true,
        remainingMinutes: remainingTime.remainingMinutes,
        urgencyLevel: urgencyAnalysis.urgencyLevel,
        requiresToday: urgencyAnalysis.requiresToday,
        deadlineDate: urgencyAnalysis.deadlineDate,
        deadlineType: urgencyAnalysis.deadlineType,
        timeFormat: timeFormat as '12h' | '24h',
        userLocalTime: userLocalTime,
      }
      
      console.log('⏰ Time constraints detected:', {
        remainingMinutes: remainingTime.remainingMinutes,
        urgencyLevel: urgencyAnalysis.urgencyLevel,
        requiresToday: urgencyAnalysis.requiresToday,
        deadlineDate: urgencyAnalysis.deadlineDate,
        deadlineType: urgencyAnalysis.deadlineType,
      })
    }

    try {
      aiContent = await generateRoadmapContent({
        goal: finalGoalText,
        start_date: finalStartDate,
        clarifications: finalClarifications,
        clarificationQuestions: finalClarificationQuestions,
        availability,
        timeConstraints,
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

    const actualDailyTasks = aiContent.tasks.length
    let timelineDays = Math.max(aiContent.timeline_days, 1)
    const lunchStartHour = 12
    const lunchEndHour = 13
    const workdayStartHour = 9
    const workdayEndHour = 17
    const lunchMinutes = Math.max(0, (lunchEndHour - lunchStartHour) * 60)
    const workdayMinutes = Math.max(60, (workdayEndHour - workdayStartHour) * 60 - lunchMinutes)
    const realisticDailyCapacity = Math.max(120, Math.round(workdayMinutes * 0.65))
    let totalDuration = aiContent.tasks.reduce((sum: number, task: any) => sum + (task.estimated_duration_minutes || 30), 0)
    const derivedFromDuration = Math.max(1, Math.ceil(totalDuration / realisticDailyCapacity))
    if (derivedFromDuration > timelineDays) {
      timelineDays = derivedFromDuration
    }
    const minTasks = Math.max(2, Math.ceil(timelineDays * 0.5))
    let allowedCapacity = realisticDailyCapacity * timelineDays

    if (totalDuration > allowedCapacity) {
      let removed = 0
      while (totalDuration > allowedCapacity && aiContent.tasks.length > minTasks) {
        const task = aiContent.tasks.pop()
        totalDuration -= task?.estimated_duration_minutes || 30
        removed += 1
      }
      if (removed > 0) {
        console.warn(`⚠️ Trimmed ${removed} tasks to keep total duration (${totalDuration} min) within ${allowedCapacity} min capacity`)
      }
    }

    const requiredTasks = Math.max(minTasks, 1)
    if (aiContent.tasks.length < requiredTasks) {
      const shortage = requiredTasks - aiContent.tasks.length
      console.warn(`⚠️ AI produced too few tasks (${aiContent.tasks.length}), adding ${shortage} generic entries`)
      const templates = [
        { name: 'Review your progress', details: 'Reflect on key takeaways.', estimated_duration_minutes: 20, priority: 3 as const },
        { name: 'Practice core skills', details: 'Reinforce fundamentals.', estimated_duration_minutes: 30, priority: 2 as const },
        { name: 'Study relevant material', details: 'Dig deeper into the topic.', estimated_duration_minutes: 25, priority: 2 as const },
      ]
      const sampleSize = Math.min(10, aiContent.tasks.length)
      const baseTasks = sampleSize > 0 ? aiContent.tasks.slice(-sampleSize) : templates
      for (let i = 0; i < shortage; i++) {
        const template = baseTasks[i % baseTasks.length] || templates[i % templates.length]
        const name = template.name || (baseTasks[i % baseTasks.length]?.name ?? 'Extra focus')
        const variations = [
          (text: string) => `Continue ${text.toLowerCase()}`,
          (text: string) => `Practice more ${text.toLowerCase()}`,
          (text: string) => `Review ${text.toLowerCase()}`,
        ]
        const variationFn = variations[i % variations.length]
        const seedName = template.name || name
        const newName = variationFn(seedName)
        const details = template.details || (baseTasks[i % baseTasks.length]?.details ?? 'Keep working on your goal')
        const duration = template.estimated_duration_minutes || 30
        const priority = (template.priority as 1 | 2 | 3 | 4) || 3
        aiContent.tasks.push({
          name: newName,
          details,
          estimated_duration_minutes: duration,
          priority,
        })
        totalDuration += duration
      }
    }

    // Validate that we have enough tasks
    // For a plan with N days, we typically want at least N-1 tasks (one per day minus start/end days)
    const minExpectedTasks = Math.max(1, timelineDays - 2)
    if (aiContent.tasks.length < minExpectedTasks) {
      console.error('Insufficient tasks:', {
        expected: minExpectedTasks,
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
        { expected: minExpectedTasks, actual: aiContent.tasks.length }
      )
    }

    aiContent.timeline_days = timelineDays

    const [year, month, day] = finalStartDate.split('-').map(Number)
    const parsedStartDate = new Date(year, month - 1, day, 0, 0, 0, 0)
    
    // Intelligent time constraint handling: extend timeline if needed, respecting deadlines
    let timeAdjustmentWarning: string | null = null
    let adjustedTimelineDays = timelineDays
    
    if (timeConstraints && timeConstraints.isStartDateToday) {
      const { remainingMinutes, urgencyLevel, requiresToday, deadlineDate, deadlineType } = timeConstraints
      const dailyCapacity = 250 // Realistic daily capacity in minutes
      
      // Calculate maximum allowed days based on deadline
      let maxAllowedDays: number | null = null
      if (deadlineDate && deadlineType !== 'none') {
        const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24))
        maxAllowedDays = Math.max(1, daysUntilDeadline + 1) // +1 to include start date
        
        // If deadline is "tomorrow", cap at 2 days (today + tomorrow)
        if (deadlineType === 'tomorrow') {
          maxAllowedDays = 2
        }
      }
      
      // Check if tasks fit in remaining time
      if (totalDuration > remainingMinutes) {
        // Calculate how many additional days are needed
        const additionalDays = calculateDaysNeeded(totalDuration, remainingMinutes, dailyCapacity)
        let proposedTimelineDays = timelineDays + additionalDays
        
        // Cap timeline at deadline if one exists
        if (maxAllowedDays !== null && proposedTimelineDays > maxAllowedDays) {
          proposedTimelineDays = maxAllowedDays
          console.log(`⚠️ Timeline capped at ${maxAllowedDays} days due to deadline constraint`)
        }
        
        adjustedTimelineDays = proposedTimelineDays
        
        // Generate contextual warning based on urgency and deadline
        const timeFormat = timeConstraints.timeFormat || '12h'
        const userLocalTime = timeConstraints.userLocalTime || new Date()
        const formattedCurrentTime = formatTimeForDisplay(userLocalTime, timeFormat)
        const totalHours = Math.ceil(totalDuration / 60)
        const newEndDate = addDays(parsedStartDate, adjustedTimelineDays - 1)
        
        if (deadlineType === 'tomorrow' && adjustedTimelineDays > 2) {
          // Deadline is tomorrow but plan needs more days
          timeAdjustmentWarning = `This plan requires ${totalHours} hour${totalHours !== 1 ? 's' : ''} of work, but your deadline is tomorrow morning. The plan has been adjusted to fit within the deadline. Consider starting earlier or reducing the scope.`
        } else if (deadlineDate && adjustedTimelineDays > maxAllowedDays!) {
          // Specific deadline exceeded
          const deadlineStr = formatDateForDB(deadlineDate)
          timeAdjustmentWarning = `This plan requires ${totalHours} hour${totalHours !== 1 ? 's' : ''} of work, but your deadline is ${deadlineStr}. The plan has been adjusted to fit within the deadline. Consider starting earlier or reducing the scope.`
        } else if (requiresToday && urgencyLevel === 'high') {
          // User explicitly wanted today - warn about extension
          const hoursRemaining = Math.floor(remainingMinutes / 60)
          const minutesRemaining = remainingMinutes % 60
          if (adjustedTimelineDays === 1) {
            timeAdjustmentWarning = `Not enough time remains today (current time: ${formattedCurrentTime}). Plan will start tomorrow.`
          } else {
            timeAdjustmentWarning = `This plan requires ${totalHours} hour${totalHours !== 1 ? 's' : ''} of work, but only ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} and ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} remain in today's workday (current time: ${formattedCurrentTime}). Plan extended to ${formatDateForDB(newEndDate)}.`
          }
        } else if (urgencyLevel === 'medium' && deadlineType === 'tomorrow') {
          // Time-sensitive with tomorrow deadline
          const hoursRemaining = Math.floor(remainingMinutes / 60)
          const minutesRemaining = remainingMinutes % 60
          timeAdjustmentWarning = `This plan requires ${totalHours} hour${totalHours !== 1 ? 's' : ''} of work, but only ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} and ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} remain in today's workday (current time: ${formattedCurrentTime}). Plan adjusted to fit within tomorrow's deadline.`
        } else if (urgencyLevel === 'medium') {
          // Time-sensitive but not necessarily today
          const hoursRemaining = Math.floor(remainingMinutes / 60)
          const minutesRemaining = remainingMinutes % 60
          timeAdjustmentWarning = `This plan requires ${totalHours} hour${totalHours !== 1 ? 's' : ''} of work, but only ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} and ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} remain in today's workday (current time: ${formattedCurrentTime}). Plan extended to ${formatDateForDB(newEndDate)} to ensure completion.`
        } else {
          // No urgency - extend silently or with gentle note
          timeAdjustmentWarning = `Plan extended to ${formatDateForDB(newEndDate)} to ensure all tasks can be completed comfortably.`
        }
        
        console.log('📅 Timeline extended due to time constraints:', {
          originalTimeline: timelineDays,
          adjustedTimeline: adjustedTimelineDays,
          totalDuration,
          remainingMinutes,
          urgencyLevel,
          requiresToday,
          deadlineDate: deadlineDate?.toISOString(),
          deadlineType,
          maxAllowedDays,
          warning: timeAdjustmentWarning,
        })
        
        // Update timeline
        aiContent.timeline_days = adjustedTimelineDays
      }
      
      // Additional deadline validation: check if calculated end date exceeds deadline
      if (timeConstraints && timeConstraints.deadlineDate && timeConstraints.deadlineType !== 'none') {
        const calculatedEndDate = addDays(parsedStartDate, adjustedTimelineDays - 1)
        if (calculatedEndDate > timeConstraints.deadlineDate) {
          // Recalculate to fit within deadline
          const daysUntilDeadline = Math.ceil((timeConstraints.deadlineDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24))
          const maxDays = timeConstraints.deadlineType === 'tomorrow' ? 2 : Math.max(1, daysUntilDeadline + 1)
          
          if (adjustedTimelineDays > maxDays) {
            adjustedTimelineDays = maxDays
            aiContent.timeline_days = adjustedTimelineDays
            
            if (!timeAdjustmentWarning) {
              const deadlineStr = formatDateForDB(timeConstraints.deadlineDate)
              timeAdjustmentWarning = `Plan adjusted to fit within deadline of ${deadlineStr}. Consider reducing scope or starting earlier.`
            }
            
            console.log(`⚠️ Timeline capped at ${maxDays} days due to deadline: ${formatDateForDB(timeConstraints.deadlineDate)}`)
          }
        }
      }
    } else {
        console.log('✅ Tasks fit in remaining time:', {
          totalDuration,
          remainingMinutes,
          canFit: true,
        })
      }
    }
    
    const endDate = addDays(parsedStartDate, aiContent.timeline_days - 1)
    const calculatedEndDate = endDate.toISOString().split('T')[0]

    console.log('✅ AI content validated:', {
      timeline_days: timelineDays,
      ai_end_date: aiContent.end_date,
      calculated_end_date: calculatedEndDate,
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

    // Ensure goal title and summary exist – derive sensible fallbacks if AI omitted them
    const deriveTitle = (text: string): string => {
      const raw = (text || '').trim()
      if (!raw) return 'New Goal'
      const firstSentence = raw.split(/[.!?]/)[0] || raw
      const words = firstSentence.split(/\s+/).filter(Boolean).slice(0, 8)
      const title = words.join(' ')
      return raw.length > title.length ? `${title}…` : title
    }
    const deriveSummary = (text: string): string => {
      const raw = (text || '').trim()
      if (!raw) return 'Personalized plan generated.'
      const firstSentence = raw.split(/[.!?]/)[0] || raw
      const words = firstSentence.split(/\s+/).filter(Boolean).slice(0, 14)
      const short = words.join(' ')
      return raw.length > short.length ? `${short}…` : short
    }
    // Normalize possible model variations: title/summary vs goal_title/plan_summary
    const aiTitle =
      (aiContent as any).goal_title ??
      (aiContent as any).title ??
      null
    const aiSummary =
      (aiContent as any).plan_summary ??
      (aiContent as any).summary ??
      null
    // Create a concise imperative title from goal text when AI title is missing or unhelpful
    const createTitleFromGoal = (text: string): string => {
      let t = (text || '').trim()
      // Remove common prefixes
      t = t.replace(/^(i\s+need\s+to|i\s+want\s+to|i\s+have\s+to|i\s+must\s+to|help\s+me\s+to|help\s+me|i\s+should)\s+/i, '')
      // Remove trailing punctuation
      t = t.replace(/[.,;:]$/, '')
      // Remove time references that make titles wordy
      t = t.replace(/\s+(for\s+tomorrow|for\s+next\s+week|for\s+next\s+month|by\s+tomorrow|by\s+next\s+week).*$/i, '')
      // Take key words but prioritize action verbs and nouns, limit to 5-6 words max
      const words = t.split(/\s+/)
      // Find the action verb if it exists
      let actionIndex = words.findIndex(w => /^(prepare|create|build|make|write|develop|learn|study|practice|complete|finish|organize|plan)/i.test(w))
      let titleWords: string[] = []
      if (actionIndex >= 0) {
        // Start from action verb, take up to 5-6 words total
        titleWords = words.slice(actionIndex, actionIndex + 6)
      } else {
        // No clear action verb, take first 5-6 meaningful words
        titleWords = words.slice(0, 6).filter(w => w.length > 2) // Filter out very short words
      }
      // Capitalize first word
      if (titleWords.length > 0) {
        titleWords[0] = titleWords[0].charAt(0).toUpperCase() + titleWords[0].slice(1)
      }
      const title = titleWords.join(' ')
      // If result is too long, truncate more aggressively
      if (title.length > 50) {
        return title.split(/\s+/).slice(0, 4).join(' ')
      }
      return title.length > 0 ? title : 'My Plan'
    }
    const candidateTitle =
      typeof aiTitle === 'string' && aiTitle.trim().length > 0
        ? aiTitle.trim()
        : createTitleFromGoal(finalGoalText)
    // If AI title equals the raw goal text (or very long), improve it with better logic
    const needsFallback = candidateTitle.toLowerCase() === finalGoalText.trim().toLowerCase() || 
                          candidateTitle.length > 60 ||
                          candidateTitle.split(/\s+/).length > 8
    const safeGoalTitle = needsFallback
      ? createTitleFromGoal(finalGoalText)
      : candidateTitle
    const safePlanSummary =
      typeof aiSummary === 'string' && aiSummary.trim().length > 0
        ? aiSummary.trim()
        : deriveSummary(finalGoalText)

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
          goal_title: safeGoalTitle,
          plan_summary: safePlanSummary,
          ...(timeAdjustmentWarning && { time_adjustment_warning: timeAdjustmentWarning }),
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

    // Use the unified tasks array from AI content
    // All tasks are inserted without milestone associations (milestones are legacy - column removed)
    // Note: We intentionally omit the "category" column here. The database enforces
    // a CHECK constraint that only allows 'A', 'B', or 'C' for category, and it is
    // nullable. By not setting it, we let the column default to NULL, which passes
    // the constraint and keeps categorisation logic decoupled from plan generation.
    const allTasks = aiContent.tasks.map((task: any, index: number) => ({
        plan_id: plan.id,
        user_id: user.id,
        idx: index + 1,
        name: task.name,
      details: task.details,
      estimated_duration_minutes: task.estimated_duration_minutes || 30,
      priority: task.priority || 3,
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
      await generateTaskSchedule(plan.id, parsedStartDate, endDate)
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
        // Legacy milestone fields removed; the new AI returns a single unified tasks array.
        tasks: {
          total: allTasks.length,
        },
        ...(timeAdjustmentWarning && { warning: timeAdjustmentWarning }),
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