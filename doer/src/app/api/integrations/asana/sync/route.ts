import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider, type TaskManagementProviderType } from '@/lib/task-management/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Sync entire DOER plan to Asana
 * POST /api/integrations/asana/sync
 * Body: { plan_id?: string }
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
    const body = await request.json().catch(() => ({}))
    let plan_id = body.plan_id

    // If no plan_id provided, get active plan
    if (!plan_id) {
      const { data: activePlan } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!activePlan) {
        return NextResponse.json(
          { error: 'No active plan found' },
          { status: 404 }
        )
      }

      plan_id = activePlan.id
    }

    // Determine which project to use
    const targetProjectId = connection.default_project_id || undefined

    if (!targetProjectId) {
      return NextResponse.json(
        { error: 'No project specified. Please select a default project in settings.' },
        { status: 400 }
      )
    }

    // Fetch all task schedules for the plan
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
      .eq('plan_id', plan_id)

    if (schedulesError || !schedules || schedules.length === 0) {
      return NextResponse.json(
        { error: 'No task schedules found for this plan' },
        { status: 404 }
      )
    }

    // Get provider
    const provider = getProvider('asana' as TaskManagementProviderType)

    // Create sync log
    const { data: syncLog, error: syncLogError } = await supabase
      .from('task_management_sync_logs')
      .insert({
        user_id: user.id,
        connection_id: connection.id,
        sync_type: 'full_sync',
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

    // Get plan details
    const plan = schedules[0]?.plans as any
    const planName = plan?.summary_data?.goal_title || plan?.goal_text || null

    // Push all tasks
    let tasksPushed = 0
    const errors: string[] = []

    for (const schedule of schedules) {
      const task = schedule.tasks as any
      if (!task) {
        errors.push(`Task not found for schedule ${schedule.id}`)
        continue
      }

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

          // Create or update link record (use upsert to handle duplicates)
          const { error: linkError } = await supabase
            .from('task_management_links')
            .upsert({
              user_id: user.id,
              connection_id: connection.id,
              task_id: task.id,
              plan_id: plan_id,
              task_schedule_id: schedule.id,
              external_task_id: result.external_task_id,
              external_project_id: targetProjectId || null,
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
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logger.error('Unexpected error syncing plan to Asana', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to sync plan' },
      { status: 500 }
    )
  }
}

