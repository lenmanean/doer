import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePlanClarificationQuestions } from '@/lib/ai'
import { formatDateForDB, parseDateFromDB } from '@/lib/date-utils'
import { BusySlot } from '@/lib/types'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

const CLARIFICATION_GENERATION_CREDIT_COST = 1 // 1 OpenAI call: generatePlanClarificationQuestions

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

    // Verify user owns the plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, goal_text, start_date, end_date, summary_data')
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

    // Reserve credits after validation
    const { CreditService } = await import('@/lib/usage/credit-service')
    creditService = new CreditService(user.id, undefined)
    await creditService.getSubscription()
    
    try {
      await creditService.reserve('api_credits', CLARIFICATION_GENERATION_CREDIT_COST, { route: 'plans.clarify', plan_id: planId })
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

    // Parse summary_data
    let summaryData: any = plan.summary_data
    if (typeof summaryData === 'string') {
      try {
        summaryData = JSON.parse(summaryData)
      } catch {
        summaryData = null
      }
    }

    const planSummary = summaryData?.plan_summary || plan.goal_text || ''

    // Fetch tasks for the plan
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, details, estimated_duration_minutes, priority')
      .eq('plan_id', planId)
      .eq('user_id', user.id)
      .order('idx', { ascending: true })

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      if (reserved) {
        await creditService.release('api_credits', CLARIFICATION_GENERATION_CREDIT_COST, { reason: 'tasks_fetch_failed' })
      }
      return NextResponse.json(
        { error: 'TASKS_FETCH_FAILED', message: 'Failed to fetch plan tasks' },
        { status: 500 }
      )
    }

    if (!tasks || tasks.length === 0) {
      if (reserved) {
        await creditService.release('api_credits', CLARIFICATION_GENERATION_CREDIT_COST, { reason: 'no_tasks' })
      }
      return NextResponse.json(
        { error: 'NO_TASKS', message: 'Plan has no tasks' },
        { status: 400 }
      )
    }

    // Fetch existing schedules (excluding current plan's schedules)
    const { data: existingSchedules, error: schedulesError } = await supabase
      .from('task_schedule')
      .select('date, start_time, end_time')
      .eq('user_id', user.id)
      .neq('plan_id', planId)
      .gte('date', plan.start_date)
      .lte('date', plan.end_date || plan.start_date)

    if (schedulesError) {
      console.error('Error fetching existing schedules:', schedulesError)
      // Continue without schedules - not critical
    }

    // Fetch calendar busy slots
    const startDate = new Date(plan.start_date)
    const endDate = plan.end_date ? new Date(plan.end_date) : new Date(startDate.getTime() + 21 * 24 * 60 * 60 * 1000)
    
    const { data: calendarEvents, error: calendarError } = await supabase
      .from('calendar_events')
      .select('start_time, end_time, is_busy')
      .eq('user_id', user.id)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .eq('is_busy', true) // Only fetch events that block availability

    if (calendarError) {
      console.error('Error fetching calendar events:', calendarError)
      // Continue without calendar events - not critical
    }

    // Fetch user workday settings (use defaults if not found)
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle()

    // Extract workday settings from preferences.workday object
    const preferences = userSettings?.preferences || {}
    const workdayPrefs = preferences.workday || {}

    // Use defaults if settings don't exist (new users may not have settings yet)
    const workdaySettings = {
      startHour: workdayPrefs.workday_start_hour || 9,
      endHour: workdayPrefs.workday_end_hour || 17,
      lunchStart: workdayPrefs.lunch_start_hour || 12,
      lunchEnd: workdayPrefs.lunch_end_hour || 13,
      allowWeekends: workdayPrefs.allow_weekends ?? true,
    }

    if (settingsError && settingsError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is acceptable - we use defaults
      console.error('Error fetching user settings:', settingsError)
      // Continue with defaults rather than failing
    }

    // Calculate timeline days
    const timelineDays = plan.end_date && plan.start_date
      ? Math.ceil((new Date(plan.end_date).getTime() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 1

    // Prepare calendar busy slots
    const calendarBusySlots: BusySlot[] = (calendarEvents || []).map((event: any) => ({
      start: event.start_time,
      end: event.end_time,
    }))

    // workdaySettings already prepared above with defaults

    // Generate clarification questions
    const result = await generatePlanClarificationQuestions({
      goal: plan.goal_text,
      planSummary,
      timelineDays,
      tasks: tasks.map((t: any) => ({
        name: t.name || '',
        details: t.details || '',
        duration: t.estimated_duration_minutes || 0,
        priority: t.priority || 1,
      })),
      existingSchedules: (existingSchedules || []).map((s: any) => ({
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
      calendarBusySlots,
      workdaySettings,
    })

    // Commit credits after successful AI call
    if (reserved && creditService) {
      await creditService.commit('api_credits', CLARIFICATION_GENERATION_CREDIT_COST, {
        route: 'plans.clarify',
        plan_id: planId,
        questions_count: result.questions.length,
      })
      reserved = false
    }

    return NextResponse.json({
      questions: result.questions,
      reasoning: result.reasoning,
    })
  } catch (error) {
    console.error('Error generating clarification questions:', error)
    
    // Release credits on error
    if (reserved && creditService) {
      try {
        await creditService.release('api_credits', CLARIFICATION_GENERATION_CREDIT_COST, {
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
          message: 'You have exhausted your plan generation credits for this billing cycle.',
          remaining: error.remaining,
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { 
        error: 'GENERATION_FAILED', 
        message: error instanceof Error ? error.message : 'Failed to generate clarification questions' 
      },
      { status: 500 }
    )
  }
}

