import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRoadmapContent } from '@/lib/ai'
import { generateTaskSchedule } from '@/lib/roadmap-server'
import { detectUrgencyIndicators, detectAvailabilityPatterns, combineGoalWithClarifications } from '@/lib/goal-analysis'
import { calculateEveningWorkdayHours, extractWorkdayEndHourFromText } from '@/lib/availability-utils'
import { formatDateForDB, parseDateFromDB, addDays } from '@/lib/date-utils'
import { NormalizedAvailability, BusySlot } from '@/lib/types'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

const PLAN_REGENERATION_CREDIT_COST = 1 // 1 OpenAI call: generateRoadmapContent

export async function POST(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  let user: any = null
  let reserved = false
  let creditService: any = null
  
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
    user = authUser
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const planId = params.planId

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(planId)) {
      return NextResponse.json({ error: 'Invalid plan ID format' }, { status: 400 })
    }

    // Verify user owns the plan and fetch existing plan (before reserving credits)
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, goal_text, start_date, end_date, summary_data, clarifications')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { 
          error: 'PLAN_NOT_FOUND', 
          message: 'Plan not found or access denied' 
        }, 
        { status: 404 }
      )
    }

    // Parse request body (before reserving credits)
    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { 
          error: 'INVALID_REQUEST_BODY', 
          message: 'Invalid request body format' 
        }, 
        { status: 400 }
      )
    }

    // Reserve credits after validation
    const { CreditService } = await import('@/lib/usage/credit-service')
    creditService = new CreditService(user.id, undefined)
    await creditService.getSubscription()
    
    try {
      await creditService.reserve('api_credits', PLAN_REGENERATION_CREDIT_COST, { route: 'plans.regenerate', plan_id: planId })
      reserved = true
    } catch (creditError) {
      if (creditError instanceof UsageLimitExceeded) {
        return NextResponse.json(
          {
            error: 'USAGE_LIMIT_EXCEEDED',
            message: 'You have reached your plan\'s limit for this feature. Please upgrade your plan or wait for the next billing cycle.',
            remaining: creditError.remaining,
          },
          { status: 429 }
        )
      }
      throw creditError
    }

    // Validate and sanitize input
    const clarifications: Record<string, string> = 
      typeof body.clarifications === 'object' && body.clarifications !== null && !Array.isArray(body.clarifications)
        ? Object.fromEntries(
            Object.entries(body.clarifications).filter(([_, v]) => typeof v === 'string')
          ) as Record<string, string>
        : {}
    
    // clarificationQuestions is now optional - we use question text as keys in clarifications
    const clarificationQuestions: Array<string | { text: string; options: string[] }> = 
      Array.isArray(body.clarificationQuestions)
        ? body.clarificationQuestions
        : []
    
    const timezoneOffset: number = 
      typeof body.timezone_offset === 'number' && !isNaN(body.timezone_offset)
        ? body.timezone_offset
        : new Date().getTimezoneOffset()

    // Validate that clarifications match the questions
    // Expected format: { "question text": "answer", ... } or { "clarification_1": "answer1", ... }
    // Support both old format (string array) and new format (object array with text/options)
    if (clarificationQuestions.length > 0) {
      const providedKeys = Object.keys(clarifications)
      
      // Determine expected keys based on question format
      const expectedKeys: string[] = []
      for (const question of clarificationQuestions) {
        if (typeof question === 'string') {
          // Old format: use index-based keys
          const index = clarificationQuestions.indexOf(question)
          expectedKeys.push(`clarification_${index + 1}`)
        } else if (typeof question === 'object' && question !== null && 'text' in question) {
          // New format: use question text as key
          expectedKeys.push(question.text)
        }
      }
      
      // Check if all expected keys are present (answers can be empty strings, but keys should exist)
      const missingKeys = expectedKeys.filter(key => !providedKeys.includes(key))
      if (missingKeys.length > 0) {
        if (reserved) {
          await creditService.release('api_credits', PLAN_REGENERATION_CREDIT_COST, { reason: 'validation_failed' })
        }
        return NextResponse.json(
          {
            error: 'INVALID_REQUEST',
            message: `Missing answers for questions: ${missingKeys.join(', ')}`,
          },
          { status: 400 }
        )
      }
    }

    // Store original plan state for rollback
    const originalPlanState = {
      goal_text: plan.goal_text,
      clarifications: plan.clarifications,
      end_date: plan.end_date,
      summary_data: plan.summary_data,
    }

    // Fetch original tasks for rollback
    const { data: originalTasks, error: originalTasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('plan_id', planId)
      .eq('user_id', user.id)
      .order('idx', { ascending: true })

    if (originalTasksError) {
      console.error('Error fetching original tasks for rollback:', originalTasksError)
      // Proceed, but rollback might be incomplete if tasks couldn't be fetched
    }

    // Combine goal with new clarifications
    const combinedGoal = combineGoalWithClarifications(plan.goal_text, clarifications)

    // Fetch user settings for workday hours
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle()

    // Extract workday settings from preferences.workday object
    const preferences = userSettings?.preferences || {}
    const workdayPrefs = preferences.workday || {}

    // Use defaults if settings don't exist
    const workdayStartHour = workdayPrefs.workday_start_hour || 9
    const workdayEndHour = workdayPrefs.workday_end_hour || 17
    const lunchStartHour = workdayPrefs.lunch_start_hour || 12
    const lunchEndHour = workdayPrefs.lunch_end_hour || 13
    const allowWeekends = workdayPrefs.allow_weekends ?? true

    if (settingsError && settingsError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is acceptable - we use defaults
      if (reserved) {
        await creditService.release('api_credits', PLAN_REGENERATION_CREDIT_COST, { reason: 'settings_fetch_failed' })
      }
      return NextResponse.json(
        { error: 'SETTINGS_FETCH_FAILED', message: 'Failed to fetch user settings' },
        { status: 500 }
      )
    }

    const workdaySettings = {
      workday_end_hour: workdayEndHour,
    }

    // Detect urgency and availability patterns
    const urgencyAnalysis = detectUrgencyIndicators(combinedGoal, clarifications)
    const availabilityAnalysis = detectAvailabilityPatterns(combinedGoal, clarifications, workdaySettings)

    // Calculate evening workday hours if needed
    let eveningWorkdayStartHour: number | undefined
    let eveningWorkdayEndHour: number | undefined
    
    if (availabilityAnalysis.timeOfDay === 'evening' && availabilityAnalysis.hoursPerDay) {
      const extractedWorkdayEndHour = extractWorkdayEndHourFromText(combinedGoal, workdayEndHour)
      
      const eveningHours = calculateEveningWorkdayHours(
        extractedWorkdayEndHour,
        availabilityAnalysis.hoursPerDay,
        30 // 30 minute buffer
      )
      
      if (eveningHours) {
        eveningWorkdayStartHour = eveningHours.eveningStartHour
        eveningWorkdayEndHour = eveningHours.eveningEndHour
      }
    }

    // Fetch existing schedules and calendar events for availability
    const startDate = parseDateFromDB(plan.start_date)
    const endDate = plan.end_date ? parseDateFromDB(plan.end_date) : addDays(startDate, 21)
    
    // Fetch existing task schedules (excluding current plan)
    const { data: existingSchedules, error: schedulesError } = await supabase
      .from('task_schedule')
      .select('date, start_time, end_time')
      .eq('user_id', user.id)
      .neq('plan_id', planId)
      .gte('date', plan.start_date)
      .lte('date', plan.end_date || plan.start_date)

    // Fetch calendar busy slots
    const { getBusySlotsForUser } = await import('@/lib/calendar/busy-slots')
    const calendarBusySlots = await getBusySlotsForUser(user.id, startDate, endDate)

    // Combine into availability object
    const taskBusySlots: BusySlot[] = (existingSchedules || []).map((s: any) => ({
      start: new Date(`${s.date}T${s.start_time}`).toISOString(),
      end: new Date(`${s.date}T${s.end_time}`).toISOString(),
    }))

    const availability: NormalizedAvailability = {
      busySlots: [...taskBusySlots, ...calendarBusySlots],
      timeOff: [],
    }

    // Convert clarificationQuestions to string array for AI request
    // Support both old format (string[]) and new format (Array<{text: string, options: string[]}>)
    const clarificationQuestionsForAI: string[] = clarificationQuestions.map((q) => {
      if (typeof q === 'string') {
        return q
      } else if (typeof q === 'object' && q !== null && 'text' in q) {
        return q.text
      }
      return ''
    }).filter((q) => q.length > 0)

    // Prepare AI request
    const aiRequest = {
      goal: combinedGoal,
      clarifications,
      clarificationQuestions: clarificationQuestionsForAI,
      start_date: plan.start_date,
      availability,
      workdaySettings: {
        startHour: workdayStartHour,
        endHour: workdayEndHour,
        lunchStart: lunchStartHour,
        lunchEnd: lunchEndHour,
        allowWeekends: allowWeekends,
      },
      timeConstraints: {
        isStartDateToday: false, // Regeneration always uses original start date
        remainingMinutes: 0,
        urgencyLevel: urgencyAnalysis.urgencyLevel,
        requiresToday: false,
        timelineRequirement: urgencyAnalysis.timelineRequirement,
      },
    }

    // Generate new roadmap content
    const aiContent = await generateRoadmapContent(aiRequest)

    // Calculate new end date
    const newEndDate = addDays(startDate, aiContent.timeline_days - 1)
    const newEndDateStr = formatDateForDB(newEndDate)

    // Update plan
    const { error: updateError } = await supabase
      .from('plans')
      .update({
        goal_text: plan.goal_text, // Keep original goal text
        clarifications: clarifications,
        end_date: newEndDateStr,
        summary_data: {
          ...(typeof plan.summary_data === 'object' ? plan.summary_data : {}),
          goal_title: aiContent.goal_title,
          plan_summary: aiContent.plan_summary,
        },
      })
      .eq('id', planId)
      .eq('user_id', user.id)

    if (updateError) {
      if (reserved) {
        await creditService.release('api_credits', PLAN_REGENERATION_CREDIT_COST, { reason: 'plan_update_failed' })
      }
      return NextResponse.json(
        { error: 'PLAN_UPDATE_FAILED', message: 'Failed to update plan. Please try again.' },
        { status: 500 }
      )
    }

    // Delete old tasks
    const { error: deleteTasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('plan_id', planId)
      .eq('user_id', user.id)

    if (deleteTasksError) {
      // Rollback plan update
      await supabase
        .from('plans')
        .update(originalPlanState)
        .eq('id', planId)
        .eq('user_id', user.id)

      if (originalTasks && originalTasks.length > 0) {
        // Restore original tasks (best effort)
        await supabase.from('tasks').insert(originalTasks.map(t => ({
          plan_id: t.plan_id,
          user_id: t.user_id,
          idx: t.idx,
          name: t.name,
          details: t.details || null,
          estimated_duration_minutes: t.estimated_duration_minutes || 60,
          priority: t.priority || null,
          is_recurring: t.is_recurring || false,
          is_indefinite: t.is_indefinite || false,
        })))
      }

      if (reserved) {
        await creditService.release('api_credits', PLAN_REGENERATION_CREDIT_COST, { reason: 'task_deletion_failed' })
      }
      return NextResponse.json(
        { error: 'TASK_DELETION_FAILED', message: 'Failed to delete old tasks. Plan has been restored.' },
        { status: 500 }
      )
    }

    // Insert new tasks
    // Validate and prepare tasks with proper constraints
    const newTasks = aiContent.tasks.map((task, index) => {
      // Validate and sanitize task name (constraint: trim(name) != '')
      const taskName = (task.name || '').trim()
      if (!taskName) {
        throw new Error(`Task at index ${index} has an empty name`)
      }

      // Validate duration (constraint: 5 <= duration <= 360)
      const duration = Math.max(5, Math.min(360, task.estimated_duration_minutes || 60))

      // Validate priority (constraint: priority IN (1, 2, 3, 4))
      const priority = task.priority && [1, 2, 3, 4].includes(task.priority) 
        ? task.priority 
        : 3 // Default to medium priority if invalid

      // idx must be > 0 (constraint: idx > 0)
      return {
        plan_id: planId,
        user_id: user.id,
        idx: index + 1, // Start at 1, not 0
        name: taskName,
        details: task.details || null,
        estimated_duration_minutes: duration,
        priority: priority,
        is_recurring: false,
        is_indefinite: false,
      }
    })

    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(newTasks)
      .select()

    if (insertError || !insertedTasks) {
      // Log detailed error for debugging
      console.error('Task insertion error:', {
        error: insertError,
        errorCode: insertError?.code,
        errorMessage: insertError?.message,
        errorDetails: insertError?.details,
        errorHint: insertError?.hint,
        tasksCount: newTasks.length,
        firstTask: newTasks[0] ? {
          idx: newTasks[0].idx,
          name: newTasks[0].name,
          duration: newTasks[0].estimated_duration_minutes,
          priority: newTasks[0].priority,
        } : null,
      })

      // Rollback: restore original plan and tasks
      await supabase
        .from('plans')
        .update(originalPlanState)
        .eq('id', planId)
        .eq('user_id', user.id)

      if (originalTasks && originalTasks.length > 0) {
        await supabase.from('tasks').insert(originalTasks.map(t => ({
          plan_id: t.plan_id,
          user_id: t.user_id,
          idx: t.idx,
          name: t.name,
          details: t.details || null,
          estimated_duration_minutes: t.estimated_duration_minutes || 60,
          priority: t.priority || null,
          is_recurring: t.is_recurring || false,
          is_indefinite: t.is_indefinite || false,
        })))
      }

      if (reserved) {
        await creditService.release('api_credits', PLAN_REGENERATION_CREDIT_COST, { reason: 'task_insertion_failed' })
      }
      return NextResponse.json(
        { 
          error: 'TASK_INSERTION_FAILED', 
          message: insertError?.message || 'Failed to insert new tasks. Plan has been restored.',
          details: insertError?.details || null,
        },
        { status: 500 }
      )
    }

    // Delete old schedules
    const { error: deleteSchedulesError } = await supabase
      .from('task_schedule')
      .delete()
      .eq('plan_id', planId)
      .eq('user_id', user.id)

    if (deleteSchedulesError) {
      console.error('Error deleting old schedules:', deleteSchedulesError)
      // Continue - schedules will be regenerated anyway
    }

    // Regenerate schedules
    let scheduleGenerationSuccess = true
    try {
      await generateTaskSchedule(
        planId,
        startDate,
        newEndDate,
        timezoneOffset,
        undefined, // userLocalTime
        false, // requireStartDate
        eveningWorkdayStartHour,
        eveningWorkdayEndHour
      )
    } catch (scheduleError) {
      console.error('Error generating task schedule:', scheduleError)
      scheduleGenerationSuccess = false
      // Continue - plan is updated, just schedules failed
    }

    // Commit credits after successful regeneration
    if (reserved && creditService) {
      await creditService.commit('api_credits', PLAN_REGENERATION_CREDIT_COST, {
        route: 'plans.regenerate',
        plan_id: planId,
        tasks_count: insertedTasks.length,
      })
      reserved = false
    }

    // Fetch updated plan
    const { data: updatedPlan, error: fetchError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      console.error('Error fetching updated plan:', fetchError)
    }

    return NextResponse.json({
      success: true,
      plan: updatedPlan || plan,
      tasks: insertedTasks,
      scheduleGenerationSuccess,
    })
  } catch (error) {
    console.error('Error regenerating plan:', error)
    
    // Release credits on error
    if (reserved && creditService) {
      try {
        await creditService.release('api_credits', PLAN_REGENERATION_CREDIT_COST, {
          reason: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      } catch (releaseError) {
        console.error('Failed to release credits:', releaseError)
      }
    }

    if (error instanceof UsageLimitExceeded) {
      return NextResponse.json(
        {
          error: 'USAGE_LIMIT_EXCEEDED',
          message: 'You have reached your plan\'s limit for this feature. Please upgrade your plan or wait for the next billing cycle.',
          remaining: error.remaining,
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { 
        error: 'REGENERATION_FAILED', 
        message: error instanceof Error ? error.message : 'Failed to regenerate plan' 
      },
      { status: 500 }
    )
  }
}

