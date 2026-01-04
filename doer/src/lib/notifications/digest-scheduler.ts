/**
 * Digest Scheduler
 * Handles scheduling and sending daily and weekly digest notifications
 */

import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { buildDigestBlocks } from './slack-notifications'
import { logger } from '@/lib/logger'

/**
 * Send daily digest for a user
 */
export async function sendDailyDigest(userId: string): Promise<boolean> {
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
    const dailyDigestPrefs = prefs?.daily_digest

    if (!dailyDigestPrefs?.enabled) {
      return false
    }

    // Get today's scheduled tasks
    const today = new Date().toISOString().split('T')[0]
    const { data: schedules } = await supabase
      .from('task_schedule')
      .select(`
        id,
        date,
        start_time,
        end_time,
        tasks:task_id (
          id,
          name,
          priority
        )
      `)
      .eq('user_id', userId)
      .eq('date', today)
      .order('start_time', { ascending: true })

    if (!schedules || schedules.length === 0) {
      // Still send digest even if no tasks
      const blocks = buildDigestBlocks([], today, 'daily')
      const channelId = dailyDigestPrefs.channel || connection.default_channel_id
      if (!channelId) {
        return false
      }
      const provider = getProvider('slack')
      return await provider.sendBlockKitMessage(connection.id, channelId, blocks)
    }

    // Format tasks for digest
    const tasks = schedules.map((schedule: any) => {
      const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks
      return {
        name: task?.name || 'Unknown task',
        start_time: schedule.start_time,
        end_time: schedule.end_time,
      }
    })

    const blocks = buildDigestBlocks(tasks, today, 'daily')
    const channelId = dailyDigestPrefs.channel || connection.default_channel_id
    if (!channelId) {
      return false
    }

    const provider = getProvider('slack')
    return await provider.sendBlockKitMessage(connection.id, channelId, blocks)
  } catch (error) {
    logger.error('Failed to send daily digest', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    })
    return false
  }
}

/**
 * Send weekly digest for a user
 */
export async function sendWeeklyDigest(userId: string): Promise<boolean> {
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
    const weeklyDigestPrefs = prefs?.weekly_digest

    if (!weeklyDigestPrefs?.enabled) {
      return false
    }

    // Get this week's scheduled tasks
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay()) // Sunday
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Saturday

    const startDateStr = startOfWeek.toISOString().split('T')[0]
    const endDateStr = endOfWeek.toISOString().split('T')[0]

    const { data: schedules } = await supabase
      .from('task_schedule')
      .select(`
        id,
        date,
        start_time,
        end_time,
        tasks:task_id (
          id,
          name,
          priority
        )
      `)
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    // Format tasks for digest
    const tasks = (schedules || []).map((schedule: any) => {
      const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks
      return {
        name: task?.name || 'Unknown task',
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        date: schedule.date,
      }
    })

    const blocks = buildDigestBlocks(tasks, startDateStr, 'weekly')
    const channelId = weeklyDigestPrefs.channel || connection.default_channel_id
    if (!channelId) {
      return false
    }

    const provider = getProvider('slack')
    return await provider.sendBlockKitMessage(connection.id, channelId, blocks)
  } catch (error) {
    logger.error('Failed to send weekly digest', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    })
    return false
  }
}

/**
 * Schedule daily digests for all users with preference enabled
 */
export async function scheduleDailyDigests(): Promise<void> {
  try {
    const supabase = await createClient()

    // Get all users with daily digest enabled
    const { data: connections } = await supabase
      .from('slack_connections')
      .select('user_id, notification_preferences')
      .not('notification_preferences', 'is', null)

    if (!connections) {
      return
    }

    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    for (const connection of connections) {
      const prefs = connection.notification_preferences as any
      const dailyDigestPrefs = prefs?.daily_digest

      if (dailyDigestPrefs?.enabled) {
        const digestTime = dailyDigestPrefs.time || '09:00'
        // Check if it's time to send (within 5 minutes of scheduled time)
        if (Math.abs(getTimeDifference(currentTime, digestTime)) <= 5) {
          await sendDailyDigest(connection.user_id)
        }
      }
    }
  } catch (error) {
    logger.error('Failed to schedule daily digests', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Schedule weekly digests for all users with preference enabled
 */
export async function scheduleWeeklyDigests(): Promise<void> {
  try {
    const supabase = await createClient()

    // Get all users with weekly digest enabled
    const { data: connections } = await supabase
      .from('slack_connections')
      .select('user_id, notification_preferences')
      .not('notification_preferences', 'is', null)

    if (!connections) {
      return
    }

    const now = new Date()
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    for (const connection of connections) {
      const prefs = connection.notification_preferences as any
      const weeklyDigestPrefs = prefs?.weekly_digest

      if (weeklyDigestPrefs?.enabled) {
        const digestDay = (weeklyDigestPrefs.day || 'monday').toLowerCase()
        const digestTime = weeklyDigestPrefs.time || '09:00'

        // Check if it's the right day and time (within 5 minutes)
        if (currentDay === digestDay && Math.abs(getTimeDifference(currentTime, digestTime)) <= 5) {
          await sendWeeklyDigest(connection.user_id)
        }
      }
    }
  } catch (error) {
    logger.error('Failed to schedule weekly digests', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Calculate time difference in minutes
 */
function getTimeDifference(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number)
  const [h2, m2] = time2.split(':').map(Number)
  const minutes1 = h1 * 60 + m1
  const minutes2 = h2 * 60 + m2
  return Math.abs(minutes1 - minutes2)
}

