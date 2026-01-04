import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/task-management/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Push DOER tasks to Trello
 * POST /api/integrations/trello/push
 * Body: { task_schedule_ids: string[], project_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's Trello connection
    const { data: connection, error: connectionError } = await supabase
      .from('task_management_connections')
      .select('id, default_project_id')
      .eq('user_id', user.id)
      .eq('provider', 'trello')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Trello connection found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { task_schedule_ids, project_id } = body

    if (!Array.isArray(task_schedule_ids) || task_schedule_ids.length === 0) {
      return NextResponse.json(
        { error: 'task_schedule_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    // Determine which board to use
    const targetBoardId = project_id || connection.default_project_id || undefined

    if (!targetBoardId) {
      return NextResponse.json(
        { error: 'No board specified. Please select a default board in Trello settings.' },
        { status: 400 }
      )
    }

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
          details,
          estimated_duration_minutes,
          priority,
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
      .from('task_management_sync_logs')
      .insert({
        user_id: user.id,
        connection_id: connection.id,
        sync_type: 'push',
        status: 'in_progress',
      })
      .select('id')
      .single()

    // Get provider instance
    const provider = getProvider('trello')

    const results: Array<{
      task_schedule_id: string
      success: boolean
      external_task_id?: string
      error?: string
    }> = []

    let tasksPushed = 0
    const errors: string[] = []

    // Push each task to Trello
    for (const schedule of schedules) {
      const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks
      const plan = Array.isArray(schedule.plans) ? schedule.plans[0] : schedule.plans

      if (!task) {
        results.push({
          task_schedule_id: schedule.id,
          success: false,
          error: 'Task not found',
        })
        errors.push(`Task schedule ${schedule.id}: Task not found`)
        continue
      }

      // Get plan name
      const planName = plan?.summary_data?.goal_title || plan?.goal_text || null

      // Calculate duration from schedule if available
      let durationMinutes = task.estimated_duration_minutes || null
      if (schedule.start_time && schedule.end_time) {
        const start = new Date(`${schedule.date}T${schedule.start_time}`)
        const end = new Date(`${schedule.date}T${schedule.end_time}`)
        durationMinutes = Math.round((end.getTime() - start.getTime()) / 1000 / 60)
      }

      // Format due date (YYYY-MM-DD)
      const dueDate = schedule.date

      try {
        const result = await provider.pushTask(
          connection.id,
          {
            taskScheduleId: schedule.id,
            taskId: task.id,
            planId: schedule.plan_id || null,
            taskName: task.name,
            taskDetails: task.details || undefined,
            planName,
            priority: task.priority || 3,
            dueDate,
            durationMinutes: durationMinutes || undefined,
            projectId: targetBoardId || undefined,
          }
        )

        if (result.success) {
          tasksPushed++

          // Create link record
          const { error: linkError } = await supabase
            .from('task_management_links')
            .insert({
              user_id: user.id,
              connection_id: connection.id,
              task_id: task.id,
              plan_id: schedule.plan_id || null,
              task_schedule_id: schedule.id,
              external_task_id: result.external_task_id,
              external_project_id: targetBoardId || null,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
          
          if (linkError) {
            logger.warn('Failed to create task management link', {
              error: linkError.message,
              taskId: task.id,
              externalTaskId: result.external_task_id,
            })
          }

          results.push({
            task_schedule_id: schedule.id,
            success: true,
            external_task_id: result.external_task_id,
          })
        } else {
          results.push({
            task_schedule_id: schedule.id,
            success: false,
            error: result.error,
          })
          errors.push(`Task ${task.name}: ${result.error || 'Unknown error'}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          task_schedule_id: schedule.id,
          success: false,
          error: errorMessage,
        })
        errors.push(`Task ${task.name}: ${errorMessage}`)
        logger.error('Failed to push task to Trello', {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          taskScheduleId: schedule.id,
          taskId: task.id,
        })
      }
    }

    // Update sync log
    if (syncLog) {
      await supabase
        .from('task_management_sync_logs')
        .update({
          status: tasksPushed > 0 ? 'completed' : 'failed',
          tasks_pushed: tasksPushed,
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
      tasks_pushed: tasksPushed,
      total: schedules.length,
      results,
    })
  } catch (error) {
    logger.error('Unexpected error pushing tasks to Trello', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to push tasks' },
      { status: 500 }
    )
  }
}

