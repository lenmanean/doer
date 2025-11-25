import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider, validateProvider } from '@/lib/calendar/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Push DOER tasks to calendar provider
 * POST /api/integrations/[provider]/push
 * Body: { task_schedule_ids: string[], calendar_id?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate provider
    let provider: 'google' | 'outlook' | 'apple'
    try {
      provider = validateProvider(params.provider)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid provider' },
        { status: 400 }
      )
    }

    // Get user's calendar connection
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id, selected_calendar_ids')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: `No ${provider} Calendar connection found` },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { task_schedule_ids, calendar_id } = body

    if (!Array.isArray(task_schedule_ids) || task_schedule_ids.length === 0) {
      return NextResponse.json(
        { error: 'task_schedule_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    // Determine which calendar to use
    const targetCalendarId = calendar_id || connection.selected_calendar_ids?.[0] || 'primary'

    // Fetch task schedules
    const { data: schedules, error: schedulesError } = await supabase
      .from('task_schedule')
      .select(`
        id,
        date,
        start_time,
        end_time,
        task_id,
        plan_id,
        tasks (
          id,
          name,
          plan_id
        ),
        plans (
          id,
          goal_text,
          summary_data
        )
      `)
      .eq('user_id', user.id)
      .in('id', task_schedule_ids)

    if (schedulesError || !schedules || schedules.length === 0) {
      return NextResponse.json(
        { error: 'No task schedules found' },
        { status: 404 }
      )
    }

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from('calendar_sync_logs')
      .insert({
        user_id: user.id,
        calendar_connection_id: connection.id,
        sync_type: 'push',
        status: 'in_progress',
      })
      .select('id')
      .single()

    // Get provider instance
    const calendarProvider = getProvider(provider)

    const results: Array<{
      task_schedule_id: string
      success: boolean
      external_event_id?: string
      error?: string
    }> = []

    let eventsPushed = 0
    const errors: string[] = []

    // Push each task to calendar
    for (const schedule of schedules) {
      const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks
      const plan = Array.isArray(schedule.plans) ? schedule.plans[0] : schedule.plans

      if (!task || !schedule.start_time || !schedule.end_time) {
        results.push({
          task_schedule_id: schedule.id,
          success: false,
          error: 'Missing required schedule data',
        })
        errors.push(`Task ${schedule.id}: Missing required schedule data`)
        continue
      }

      // Build start/end datetime strings
      const startDateTime = `${schedule.date}T${schedule.start_time}:00`
      const endDateTime = `${schedule.date}T${schedule.end_time}:00`

      // Get plan name from summary_data or goal_text
      const planName = plan?.summary_data?.goal_title || plan?.goal_text || null

      // Get AI confidence from task metadata (if available)
      const aiConfidence = null // TODO: Get from task or plan metadata

      try {
        const result = await calendarProvider.pushTaskToCalendar(
          connection.id,
          targetCalendarId,
          {
            taskScheduleId: schedule.id,
            taskId: task.id,
            planId: schedule.plan_id || null,
            taskName: task.name,
            planName,
            startTime: startDateTime,
            endTime: endDateTime,
            aiConfidence,
            timezone: 'UTC', // TODO: Get from user preferences
          }
        )

        if (result.success) {
          eventsPushed++
          results.push({
            task_schedule_id: schedule.id,
            success: true,
            external_event_id: result.external_event_id,
          })
        } else {
          results.push({
            task_schedule_id: schedule.id,
            success: false,
            error: result.error,
          })
          errors.push(`Task ${schedule.id}: ${result.error}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          task_schedule_id: schedule.id,
          success: false,
          error: errorMessage,
        })
        errors.push(`Task ${schedule.id}: ${errorMessage}`)
        logger.error('Failed to push task to calendar', error as Error, { taskScheduleId: schedule.id })
      }
    }

    // Update sync log
    if (syncLog) {
      await supabase
        .from('calendar_sync_logs')
        .update({
          status: eventsPushed > 0 ? 'completed' : 'failed',
          events_pushed: eventsPushed,
          changes_summary: {
            results,
            errors,
            total: schedules.length,
          },
          error_message: errors.length > 0 ? errors.join('; ') : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id)
    }

    return NextResponse.json({
      success: true,
      events_pushed: eventsPushed,
      total: schedules.length,
      results,
    })
  } catch (error) {
    logger.error(`Failed to push tasks to ${params.provider} calendar`, error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to push tasks to calendar' },
      { status: 500 }
    )
  }
}

