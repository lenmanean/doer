/**
 * Notification Hooks
 * Functions to call from existing code to trigger notifications
 */

import {
  sendPlanGenerationNotification,
  sendScheduleGenerationNotification,
  sendRescheduleNotification,
  sendTaskCompletionNotification,
  sendPlanCompletionNotification,
} from './slack-notifications'
import { logger } from '@/lib/logger'

/**
 * Notify when a plan is generated
 * Call this after plan creation in /api/plans/generate
 */
export async function notifyPlanGenerated(userId: string, planId: string): Promise<void> {
  try {
    await sendPlanGenerationNotification(userId, planId)
  } catch (error) {
    // Log but don't throw - notifications are best effort
    logger.error('Failed to notify plan generation', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      planId,
    })
  }
}

/**
 * Notify when a schedule is generated
 * Call this after schedule generation in generateTaskSchedule
 */
export async function notifyScheduleGenerated(userId: string, planId: string): Promise<void> {
  try {
    await sendScheduleGenerationNotification(userId, planId)
  } catch (error) {
    logger.error('Failed to notify schedule generation', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      planId,
    })
  }
}

/**
 * Notify when a task is rescheduled
 * Call this after successful reschedule in applyRescheduleProposal
 */
export async function notifyTaskRescheduled(
  userId: string,
  taskScheduleId: string,
  oldDate: string,
  oldStartTime: string | null,
  oldEndTime: string | null,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): Promise<void> {
  try {
    await sendRescheduleNotification(
      userId,
      taskScheduleId,
      oldDate,
      oldStartTime,
      oldEndTime,
      newDate,
      newStartTime,
      newEndTime
    )
  } catch (error) {
    logger.error('Failed to notify task reschedule', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      taskScheduleId,
    })
  }
}

/**
 * Notify when a task is completed
 * Call this after task completion in updateTaskCompletionUnified
 */
export async function notifyTaskCompleted(userId: string, taskId: string, taskName: string): Promise<void> {
  try {
    await sendTaskCompletionNotification(userId, taskId, taskName)
  } catch (error) {
    logger.error('Failed to notify task completion', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      taskId,
    })
  }
}

/**
 * Notify when a plan is completed (all tasks done)
 * Call this when all tasks in a plan are completed
 */
export async function notifyPlanCompleted(userId: string, planId: string): Promise<void> {
  try {
    await sendPlanCompletionNotification(userId, planId)
  } catch (error) {
    logger.error('Failed to notify plan completion', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      planId,
    })
  }
}

