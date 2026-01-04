import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/task-management/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Sync all tasks from a plan to Trello
 * POST /api/integrations/trello/sync
 * Body: { plan_id: string, project_id?: string }
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
    const { plan_id, project_id } = body

    if (!plan_id) {
      return NextResponse.json(
        { error: 'plan_id is required' },
        { status: 400 }
      )
    }

    // Verify plan belongs to user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, goal_text, summary_data')
      .eq('id', plan_id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
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

    // Fetch all task schedules for this plan
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
          priority
        )
      `)
      .eq('user_id', user.id)
      .eq('plan_id', plan_id)

    if (schedulesError) {
      logger.error('Failed to fetch task schedules', {
        error: schedulesError instanceof Error ? schedulesError.message : String(schedulesError),
        planId: plan_id,
      })
      return NextResponse.json(
        { error: 'Failed to fetch task schedules' },
        { status: 500 }
      )
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json(
        { error: 'No tasks found in plan' },
        { status: 404 }
      )
    }

    // Get plan name
    const planName = plan.summary_data?.goal_title || plan.goal_text || null

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from('task_management_sync_logs')
      .insert({
        user_id: user.id,
        connection_id: connection.id,
        sync_type: 'full_sync',
        status: 'in_progress',
      })
      .select('id')
      .single()

    // Get provider instance
    const provider = getProvider('trello')

    let tasksPushed = 0
    const errors: string[] = []

    // Push each task to Trello
    for (const schedule of schedules) {
      const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks

      if (!task) {
        errors.push(`Schedule ${schedule.id}: Task not found`)
        continue
      }

      // Calculate duration from schedule if available
      let durationMinutes = task.estimated_duration_minutes || null
      if (schedule.start_time && schedule.end_time) {
        const start = new Date(`${schedule.date}T${schedule.start_time}`)
        const end = new Date(`${schedule.date}T${schedule.end_time}`)
        durationMinutes = Math.round((end.getTime() - start.getTime()) / 1000 / 60)
      }

      // Format due date
      const dueDate = schedule.date

      try {
        const result = await provider.pushTask(
          connection.id,
          {
            taskScheduleId: schedule.id,
            taskId: task.id,
            planId: plan_id,
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

          // Create or update link record
          const { error: linkError } = await supabase
            .from('task_management_links')
            .upsert({
              user_id: user.id,
              connection_id: connection.id,
              task_id: task.id,
              plan_id: plan_id,
              task_schedule_id: schedule.id,
              external_task_id: result.external_task_id,
              external_project_id: targetBoardId || null,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            }, {
              onConflict: 'connection_id,external_task_id',
            })
          
          if (linkError) {
            logger.warn('Failed to create/update task management link', {
              error: linkError.message,
              taskId: task.id,
            })
          }
        } else {
          errors.push(`Task ${task.name}: ${result.error || 'Unknown error'}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Task ${task.name}: ${errorMessage}`)
        logger.error('Failed to push task to Trello', {
          error: error instanceof Error ? error.message : String(error),
          taskId: task.id,
        })
      }
    }

    // Update sync log and connection last_sync_at
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
      })
      .eq('id', connection.id)

    return NextResponse.json({
      success: true,
      tasks_pushed: tasksPushed,
      total: schedules.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logger.error('Unexpected error syncing plan to Trello', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to sync plan' },
      { status: 500 }
    )
  }
}

