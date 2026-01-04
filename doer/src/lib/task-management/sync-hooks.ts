/**
 * Task Management Sync Hooks
 * Functions to sync DOER tasks with task management tools when tasks are updated
 */

import { createClient } from '@/lib/supabase/server'
import { getProvider, type TaskManagementProviderType } from '@/lib/task-management/providers/provider-factory'
import { logger } from '@/lib/logger'
import type { AsanaProvider } from '@/lib/task-management/providers/asana-provider'

/**
 * Sync task to Todoist when task schedule is updated (rescheduled)
 */
export async function syncTaskRescheduleToTodoist(
  userId: string,
  taskScheduleId: string,
  newDate: string,
  newStartTime?: string | null,
  newEndTime?: string | null
): Promise<void> {
  try {
    const supabase = await createClient()

    // Check if task has a Todoist link
    const { data: link, error: linkError } = await supabase
      .from('task_management_links')
      .select(`
        id,
        connection_id,
        external_task_id,
        task_management_connections!inner (
          id,
          provider,
          auto_push_enabled,
          user_id
        )
      `)
      .eq('task_schedule_id', taskScheduleId)
      .eq('task_management_connections.user_id', userId)
      .eq('task_management_connections.provider', 'todoist')
      .single()

    if (linkError || !link) {
      // No Todoist link exists, nothing to sync
      return
    }

    const connection = link.task_management_connections as any
    if (!connection || connection.provider !== 'todoist') {
      return
    }

    // Get provider and update task
    const provider = getProvider('todoist')

    // Format due date (YYYY-MM-DD)
    const dueDate = newDate

    // Build update object
    const updates: any = {
      dueDate,
    }

    // Update link record
    const { error: updateLinkError } = await supabase
      .from('task_management_links')
      .update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id)

    if (updateLinkError) {
      logger.warn('Failed to update task management link after reschedule', {
        error: updateLinkError.message,
        linkId: link.id,
      })
    }

    // Update task in Todoist
    const result = await provider.updateTask(
      connection.id,
      link.external_task_id,
      updates
    )

    if (!result.success) {
      logger.error('Failed to sync task reschedule to Todoist', {
        error: result.error,
        taskScheduleId,
        externalTaskId: link.external_task_id,
      })
      
      // Update link status to failed
      await supabase
        .from('task_management_links')
        .update({
          sync_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id)
    }
  } catch (error) {
    logger.error('Error syncing task reschedule to Todoist', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      taskScheduleId,
    })
    // Don't throw - this is a background sync operation
  }
}

/**
 * Sync task completion status to Todoist
 */
export async function syncTaskCompletionToTodoist(
  userId: string,
  taskId: string,
  isCompleted: boolean
): Promise<void> {
  try {
    const supabase = await createClient()

    // Check if task has a Todoist link and connection with auto_completion_sync enabled
    const { data: link, error: linkError } = await supabase
      .from('task_management_links')
      .select(`
        id,
        connection_id,
        external_task_id,
        task_management_connections!inner (
          id,
          provider,
          auto_completion_sync,
          user_id
        )
      `)
      .eq('task_id', taskId)
      .eq('task_management_connections.user_id', userId)
      .eq('task_management_connections.provider', 'todoist')
      .eq('task_management_connections.auto_completion_sync', true)
      .single()

    if (linkError || !link) {
      // No Todoist link or auto_completion_sync not enabled
      return
    }

    const connection = link.task_management_connections as any
    if (!connection || connection.provider !== 'todoist' || !connection.auto_completion_sync) {
      return
    }

    // Get provider
    const provider = getProvider('todoist')

    if (isCompleted) {
      // Mark task as complete in Todoist
      const result = await provider.completeTask(
        connection.id,
        link.external_task_id
      )

      if (!result.success) {
        logger.error('Failed to sync task completion to Todoist', {
          error: result.error,
          taskId,
          externalTaskId: link.external_task_id,
        })
        return
      }
    } else {
      // Task uncompleted - Todoist doesn't have an "uncomplete" API endpoint
      // We would need to update the task, but there's no direct way to reopen
      // For now, we'll just log it
      logger.info('Task uncompleted in DOER, but Todoist does not support reopening tasks via API', {
        taskId,
        externalTaskId: link.external_task_id,
      })
      // Note: Todoist API doesn't support reopening tasks. User would need to do it manually.
    }

    // Update link record
    await supabase
      .from('task_management_links')
      .update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id)
  } catch (error) {
    logger.error('Error syncing task completion to Todoist', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      taskId,
      isCompleted,
    })
    // Don't throw - this is a background sync operation
  }
}

/**
 * Sync task to Asana when task schedule is updated (rescheduled)
 */
export async function syncTaskRescheduleToAsana(
  userId: string,
  taskScheduleId: string,
  newDate: string,
  newStartTime?: string | null,
  newEndTime?: string | null
): Promise<void> {
  try {
    const supabase = await createClient()

    // Check if task has an Asana link
    const { data: link, error: linkError } = await supabase
      .from('task_management_links')
      .select(`
        id,
        connection_id,
        external_task_id,
        task_management_connections!inner (
          id,
          provider,
          auto_push_enabled,
          user_id
        )
      `)
      .eq('task_schedule_id', taskScheduleId)
      .eq('task_management_connections.user_id', userId)
      .eq('task_management_connections.provider', 'asana')
      .single()

    if (linkError || !link) {
      // No Asana link exists, nothing to sync
      return
    }

    const connection = link.task_management_connections as any
    if (!connection || connection.provider !== 'asana') {
      return
    }

    // Get provider and update task
    const provider = getProvider('asana' as TaskManagementProviderType)

    // Format due date (YYYY-MM-DD)
    const dueDate = newDate

    // Format due datetime if we have time
    let dueDateTime: string | undefined = undefined
    if (newStartTime && newDate) {
      dueDateTime = `${newDate}T${newStartTime}:00`
    }

    // Build update object
    const updates: any = {
      dueDate,
    }
    if (dueDateTime) {
      updates.dueDateTime = dueDateTime
    }

    // Update link record
    const { error: updateLinkError } = await supabase
      .from('task_management_links')
      .update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id)

    if (updateLinkError) {
      logger.warn('Failed to update task management link after reschedule', {
        error: updateLinkError.message,
        linkId: link.id,
      })
    }

    // Update task in Asana
    const result = await provider.updateTask(
      connection.id,
      link.external_task_id,
      updates
    )

    if (!result.success) {
      logger.error('Failed to sync task reschedule to Asana', {
        error: result.error,
        taskScheduleId,
        externalTaskId: link.external_task_id,
      })
      
      // Update link status to failed
      await supabase
        .from('task_management_links')
        .update({
          sync_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', link.id)
    }
  } catch (error) {
    logger.error('Error syncing task reschedule to Asana', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      taskScheduleId,
    })
    // Don't throw - this is a background sync operation
  }
}

/**
 * Sync task completion status to Asana
 */
export async function syncTaskCompletionToAsana(
  userId: string,
  taskId: string,
  isCompleted: boolean
): Promise<void> {
  try {
    const supabase = await createClient()

    // Check if task has an Asana link and connection with auto_completion_sync enabled
    const { data: link, error: linkError } = await supabase
      .from('task_management_links')
      .select(`
        id,
        connection_id,
        external_task_id,
        task_management_connections!inner (
          id,
          provider,
          auto_completion_sync,
          user_id
        )
      `)
      .eq('task_id', taskId)
      .eq('task_management_connections.user_id', userId)
      .eq('task_management_connections.provider', 'asana')
      .eq('task_management_connections.auto_completion_sync', true)
      .single()

    if (linkError || !link) {
      // No Asana link or auto_completion_sync not enabled
      return
    }

    const connection = link.task_management_connections as any
    if (!connection || connection.provider !== 'asana' || !connection.auto_completion_sync) {
      return
    }

    // Get provider
    const provider = getProvider('asana' as TaskManagementProviderType)

    if (isCompleted) {
      // Mark task as complete in Asana
      const result = await provider.completeTask(
        connection.id,
        link.external_task_id
      )

      if (!result.success) {
        logger.error('Failed to sync task completion to Asana', {
          error: result.error,
          taskId,
          externalTaskId: link.external_task_id,
        })
        return
      }
    } else {
      // Task uncompleted: attempt to reopen in Asana if the provider supports it
      const asanaProvider = provider as Partial<AsanaProvider>

      if (typeof asanaProvider.reopenTask === 'function') {
        const result = await asanaProvider.reopenTask(
          connection.id,
          link.external_task_id
        )

        if (!result.success) {
          logger.error('Failed to reopen task in Asana', {
            error: result.error,
            taskId,
            externalTaskId: link.external_task_id,
          })
          return
        }
      } else {
        // Provider does not support reopen in this build, avoid throwing
        logger.info('Task uncompleted in DOER, but Asana provider does not support reopenTask', {
          taskId,
          externalTaskId: link.external_task_id,
        })
      }
    }

    // Update link record
    await supabase
      .from('task_management_links')
      .update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id)
  } catch (error) {
    logger.error('Error syncing task completion to Asana', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      taskId,
      isCompleted,
    })
    // Don't throw - this is a background sync operation
  }
}
