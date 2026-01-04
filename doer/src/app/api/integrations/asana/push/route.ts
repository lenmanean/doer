import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/task-management/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Push DOER tasks to Asana
 * POST /api/integrations/asana/push
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

    // Get user's Asana connection
    const { data: connection, error: connectionError } = await supabase
      .from('task_management_connections')
      .select('id, default_project_id')
      .eq('user_id', user.id)
      .eq('provider', 'asana')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Asana connection found' },
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

    // Determine which project to use
    const targetProjectId = project_id || connection.default_project_id || undefined

    if (!targetProjectId) {
      return NextResponse.json(
        { error: 'No project specified. Please select a default project in settings.' },
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

    // Get provider
    const provider = getProvider('asana')

    // Create sync log
    const { data: syncLog, error: syncLogError } = await supabase
      .from('task_management_sync_logs')
      .insert({
        user_id: user.id,
        connection_id: connection.id,
        sync_type: 'push',
        status: 'in_progress',
        tasks_pushed: 0,
        tasks_updated: 0,
        tasks_completed: 0,
      })
      .select('id')
      .single()

    if (syncLogError) {
      logger.warn('Failed to create sync log', {
        error: syncLogError.message,
      })
    }

    // Push each task
    const results: Array<{
      task_schedule_id: string
      success: boolean
      external_task_id?: string
      error?: string
    }> = []

    let tasksPushed = 0
    const errors: string[] = []

    for (const schedule of schedules) {
      const task = schedule.tasks as any
      if (!task) {
        errors.push(`Task not found for schedule ${schedule.id}`)
        results.push({
          task_schedule_id: schedule.id,
          success: false,
          error: 'Task not found',
        })
        continue
      }

      const plan = schedule.plans as any
      const planName = plan?.summary_data?.goal_title || plan?.goal_text || null

      // Calculate duration in minutes
      let durationMinutes: number | undefined = undefined
      if (schedule.start_time && schedule.end_time) {
        const start = new Date(`2000-01-01T${schedule.start_time}`)
        const end = new Date(`2000-01-01T${schedule.end_time}`)
        durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
      } else if (task.estimated_duration_minutes) {
        durationMinutes = task.estimated_duration_minutes
      }

      // Format due date (YYYY-MM-DD)
      const dueDate = schedule.date

      // Format due datetime if we have time
      let dueDateTime: string | undefined = undefined
      if (schedule.start_time && schedule.date) {
        dueDateTime = `${schedule.date}T${schedule.start_time}:00`
      }

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
            dueDateTime,
            durationMinutes: durationMinutes || undefined,
            projectId: targetProjectId || undefined,
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
              external_project_id: targetProjectId || null,
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
        errors.push(`Task ${task.name}: ${errorMessage}`)
        results.push({
          task_schedule_id: schedule.id,
          success: false,
          error: errorMessage,
        })
        logger.error('Failed to push task to Asana', {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
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
          error_message: errors.length > 0 ? errors.join('; ') : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id)
    }

    // Update connection's last_sync_at
    await supabase
      .from('task_management_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    return NextResponse.json({
      success: true,
      tasks_pushed: tasksPushed,
      total_tasks: schedules.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logger.error('Unexpected error pushing tasks to Asana', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to push tasks' },
      { status: 500 }
    )
  }
}

