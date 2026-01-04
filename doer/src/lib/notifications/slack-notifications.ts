/**
 * Slack Notification Service
 * Handles sending notifications to Slack with Block Kit formatting
 */

import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { logger } from '@/lib/logger'

/**
 * Send plan generation notification
 */
export async function sendPlanGenerationNotification(
  userId: string,
  planId: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Get user's Slack connection
    const { data: connection } = await supabase
      .from('slack_connections')
      .select('id, notification_preferences, default_channel_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!connection) {
      return false // No Slack connection
    }

    // Check notification preferences
    const prefs = connection.notification_preferences as any
    const planGenPrefs = prefs?.plan_generation

    if (!planGenPrefs?.enabled) {
      return false // Notifications disabled
    }

    // Get plan details
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, description, start_date, end_date')
      .eq('id', planId)
      .single()

    if (!plan) {
      logger.warn('Plan not found for notification', { planId })
      return false
    }

    // Get task count
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('plan_id', planId)

    const channelId = planGenPrefs.channel || connection.default_channel_id
    if (!channelId) {
      logger.warn('No channel configured for plan generation notification', { connectionId: connection.id })
      return false
    }

    // Build Block Kit message
    const blocks = buildPlanGenerationBlocks(plan, tasks?.length || 0)

    // Send notification
    const provider = getProvider('slack')
    return await provider.sendBlockKitMessage(connection.id, channelId, blocks)
  } catch (error) {
    logger.error('Failed to send plan generation notification', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      planId,
    })
    return false
  }
}

/**
 * Send schedule generation notification
 */
export async function sendScheduleGenerationNotification(
  userId: string,
  planId: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Get user's Slack connection
    const { data: connection } = await supabase
      .from('slack_connections')
      .select('id, notification_preferences, default_channel_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!connection) {
      return false
    }

    // Check notification preferences
    const prefs = connection.notification_preferences as any
    const schedulePrefs = prefs?.schedule_generation

    if (!schedulePrefs?.enabled) {
      return false
    }

    // Get plan details
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name')
      .eq('id', planId)
      .single()

    if (!plan) {
      return false
    }

    // Get scheduled tasks count
    const { data: schedules } = await supabase
      .from('task_schedule')
      .select('id')
      .eq('plan_id', planId)

    const channelId = schedulePrefs.channel || connection.default_channel_id
    if (!channelId) {
      return false
    }

    const blocks = buildScheduleBlocks(plan, schedules?.length || 0)

    const provider = getProvider('slack')
    return await provider.sendBlockKitMessage(connection.id, channelId, blocks)
  } catch (error) {
    logger.error('Failed to send schedule generation notification', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      planId,
    })
    return false
  }
}

/**
 * Send reschedule notification
 */
export async function sendRescheduleNotification(
  userId: string,
  taskScheduleId: string,
  oldDate: string,
  oldStartTime: string | null,
  oldEndTime: string | null,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Get user's Slack connection
    const { data: connection } = await supabase
      .from('slack_connections')
      .select('id, notification_preferences, default_channel_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!connection) {
      return false
    }

    // Check notification preferences
    const prefs = connection.notification_preferences as any
    const reschedulePrefs = prefs?.reschedule

    if (!reschedulePrefs?.enabled) {
      return false
    }

    // Get task schedule and task details
    const { data: schedule } = await supabase
      .from('task_schedule')
      .select(`
        id,
        tasks:task_id (
          id,
          name
        )
      `)
      .eq('id', taskScheduleId)
      .single()

    if (!schedule) {
      return false
    }

    const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks
    if (!task) {
      return false
    }

    const channelId = reschedulePrefs.channel || connection.default_channel_id
    if (!channelId) {
      return false
    }

    const blocks = buildRescheduleBlocks(
      task,
      oldDate,
      oldStartTime,
      oldEndTime,
      newDate,
      newStartTime,
      newEndTime,
      taskScheduleId
    )

    const provider = getProvider('slack')
    return await provider.sendBlockKitMessage(connection.id, channelId, blocks)
  } catch (error) {
    logger.error('Failed to send reschedule notification', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      taskScheduleId,
    })
    return false
  }
}

/**
 * Send task completion notification
 */
export async function sendTaskCompletionNotification(
  userId: string,
  taskId: string,
  taskName: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Get user's Slack connection
    const { data: connection } = await supabase
      .from('slack_connections')
      .select('id, notification_preferences, default_channel_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!connection) {
      return false
    }

    // Check notification preferences
    const prefs = connection.notification_preferences as any
    const completionPrefs = prefs?.task_completion

    if (!completionPrefs?.enabled) {
      return false
    }

    const channelId = completionPrefs.channel || connection.default_channel_id
    if (!channelId) {
      return false
    }

    const blocks = buildTaskCompletionBlocks(taskName)

    const provider = getProvider('slack')
    return await provider.sendBlockKitMessage(connection.id, channelId, blocks)
  } catch (error) {
    logger.error('Failed to send task completion notification', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      taskId,
    })
    return false
  }
}

/**
 * Send plan completion notification
 */
export async function sendPlanCompletionNotification(
  userId: string,
  planId: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Get user's Slack connection
    const { data: connection } = await supabase
      .from('slack_connections')
      .select('id, notification_preferences, default_channel_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!connection) {
      return false
    }

    // Check notification preferences
    const prefs = connection.notification_preferences as any
    const planCompletionPrefs = prefs?.plan_completion

    if (!planCompletionPrefs?.enabled) {
      return false
    }

    // Get plan details
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name')
      .eq('id', planId)
      .single()

    if (!plan) {
      return false
    }

    const channelId = planCompletionPrefs.channel || connection.default_channel_id
    if (!channelId) {
      return false
    }

    const blocks = buildPlanCompletionBlocks(plan.name)

    const provider = getProvider('slack')
    return await provider.sendBlockKitMessage(connection.id, channelId, blocks)
  } catch (error) {
    logger.error('Failed to send plan completion notification', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      planId,
    })
    return false
  }
}

/**
 * Build Block Kit blocks for plan generation notification
 */
function buildPlanGenerationBlocks(plan: any, taskCount: number): any[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🎯 New Plan Generated',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${plan.name}*\n\n${plan.description || 'No description provided'}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Start Date:*\n${new Date(plan.start_date).toLocaleDateString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*End Date:*\n${new Date(plan.end_date).toLocaleDateString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Tasks:*\n${taskCount} tasks`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Plan',
            emoji: true,
          },
          url: `https://usedoer.com/dashboard?plan=${plan.id}`,
          style: 'primary',
        },
      ],
    },
  ]
}

/**
 * Build Block Kit blocks for schedule generation notification
 */
function buildScheduleBlocks(plan: any, scheduleCount: number): any[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📅 Schedule Generated',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${plan.name}*\n\nYour ${scheduleCount} tasks have been scheduled!`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Schedule',
            emoji: true,
          },
          url: `https://usedoer.com/dashboard?plan=${plan.id}`,
          style: 'primary',
        },
      ],
    },
  ]
}

/**
 * Build Block Kit blocks for reschedule notification
 */
function buildRescheduleBlocks(
  task: any,
  oldDate: string,
  oldStartTime: string | null,
  oldEndTime: string | null,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  taskScheduleId: string
): any[] {
  const formatTime = (time: string | null) => {
    if (!time) return 'All day'
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return time
    }
  }

  const oldTimeStr = oldStartTime && oldEndTime
    ? `${formatTime(oldStartTime)} - ${formatTime(oldEndTime)}`
    : formatTime(oldStartTime) || 'All day'
  const newTimeStr = `${formatTime(newStartTime)} - ${formatTime(newEndTime)}`

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔄 Task Rescheduled',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${task.name}*`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Old Schedule:*\n${new Date(oldDate).toLocaleDateString()}\n${oldTimeStr}`,
        },
        {
          type: 'mrkdwn',
          text: `*New Schedule:*\n${new Date(newDate).toLocaleDateString()}\n${newTimeStr}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✅ Approve',
            emoji: true,
          },
          action_id: `approve_reschedule_${taskScheduleId}`,
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '❌ Reject',
            emoji: true,
          },
          action_id: `reject_reschedule_${taskScheduleId}`,
          style: 'danger',
        },
      ],
    },
  ]
}

/**
 * Build Block Kit blocks for task completion notification
 */
function buildTaskCompletionBlocks(taskName: string): any[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '✅ Task Completed',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${taskName}*\n\nGreat job completing this task! 🎉`,
      },
    },
  ]
}

/**
 * Build Block Kit blocks for plan completion notification
 */
function buildPlanCompletionBlocks(planName: string): any[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🎉 Plan Completed!',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${planName}*\n\nCongratulations! You've completed all tasks in this plan. 🚀`,
      },
    },
  ]
}

/**
 * Build Block Kit blocks for daily/weekly digest
 */
export function buildDigestBlocks(tasks: any[], date: string, type: 'daily' | 'weekly'): any[] {
  const title = type === 'daily' ? '📋 Daily Task Digest' : '📊 Weekly Plan Summary'
  const dateStr = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (tasks.length === 0) {
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: title,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${dateStr}*\n\nNo tasks scheduled for this period. Great job! 🎉`,
        },
      },
    ]
  }

  const taskList = tasks.slice(0, 10).map((task, index) => {
    const time = task.start_time
      ? new Date(`2000-01-01T${task.start_time}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'All day'
    return `${index + 1}. *${time}* - ${task.name}`
  }).join('\n')

  const moreTasks = tasks.length > 10 ? `\n\n_...and ${tasks.length - 10} more tasks_` : ''

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${dateStr}*\n\n*Tasks (${tasks.length}):*\n${taskList}${moreTasks}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Dashboard',
            emoji: true,
          },
          url: 'https://usedoer.com/dashboard',
          style: 'primary',
        },
      ],
    },
  ]
}

