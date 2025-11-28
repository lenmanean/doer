/**
 * Task Detachment Service
 * Handles detaching calendar event tasks from their source events
 * When a user edits a calendar event task, it becomes "detached" and won't be overwritten by sync
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Detach a task from its calendar event
 * This prevents future syncs from overwriting user changes
 * Security: Verifies task belongs to user before detaching
 */
export async function detachTaskFromCalendar(taskId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  try {
    // Verify task is a calendar event and belongs to user
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, is_calendar_event, is_detached, calendar_event_id, user_id')
      .eq('id', taskId)
      .eq('user_id', userId) // Explicit user_id check for security
      .single()

    if (taskError || !task) {
      logger.warn('Task not found or access denied', { taskId, userId })
      throw new Error('Task not found or access denied')
    }

    if (!task.is_calendar_event) {
      logger.warn('Attempted to detach non-calendar event task', { taskId })
      return // Not an error, just nothing to do
    }

    if (task.is_detached) {
      logger.info('Task already detached', { taskId })
      return // Already detached
    }

    // Mark task as detached
    // Keep calendar_event_id for reference but set is_detached to true
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        is_detached: true,
        // Keep calendar_event_id for reference/history
      })
      .eq('id', taskId)

    if (updateError) {
      logger.error('Failed to detach task from calendar', updateError as Error, {
        taskId,
      })
      throw updateError
    }

    logger.info('Detached task from calendar event', {
      taskId,
      userId,
      calendarEventId: task.calendar_event_id,
    })
  } catch (error) {
    logger.error('Error detaching task from calendar', error as Error, {
      taskId,
      userId,
    })
    throw error
  }
}

/**
 * Check if a task should be automatically detached when edited
 * Security: Verifies task belongs to user
 */
export async function shouldAutoDetachOnEdit(taskId: string, userId: string): Promise<boolean> {
  const supabase = await createClient()

  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .select('is_calendar_event, is_detached, user_id')
      .eq('id', taskId)
      .eq('user_id', userId) // Explicit user_id check for security
      .single()

    if (error || !task) {
      return false
    }

    // Auto-detach if it's a calendar event and not already detached
    return task.is_calendar_event === true && task.is_detached === false
  } catch (error) {
    logger.error('Error checking if task should auto-detach', error as Error, {
      taskId,
      userId,
    })
    return false
  }
}

/**
 * Automatically detach task if it's a calendar event being edited
 */
export async function autoDetachIfNeeded(taskId: string, userId: string): Promise<boolean> {
  const shouldDetach = await shouldAutoDetachOnEdit(taskId, userId)
  if (shouldDetach) {
    await detachTaskFromCalendar(taskId, userId)
    return true
  }
  return false
}

