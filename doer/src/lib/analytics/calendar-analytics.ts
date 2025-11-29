/**
 * Calendar Integration Analytics
 * Provides analytics for calendar events (stored as tasks with plan_id = null, is_calendar_event = true)
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface CalendarUsageStats {
  total_events: number
  total_time_minutes: number
  total_time_hours: number
  average_duration_minutes: number
  events_by_day: Record<string, number>
  events_by_weekday: Record<string, number>
  busiest_day: string | null
  busiest_weekday: string | null
  most_active_calendar: string | null
  calendars_connected: number
  sync_frequency: {
    total_syncs: number
    successful_syncs: number
    failed_syncs: number
    last_sync_at: string | null
  }
  detached_tasks_count: number
  active_events_count: number
  upcoming_events_count: number
  past_events_count: number
}

export interface CalendarPlanStats {
  plan_id: string
  plan_name: string
  provider: 'google' | 'outlook' | 'apple'
  calendar_names: string[]
  total_events: number
  total_time_minutes: number
  events_this_week: number
  events_this_month: number
  average_events_per_week: number
}

/**
 * Get calendar usage statistics for a user
 */
export async function getCalendarUsageStats(
  userId: string,
  timeRange: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<CalendarUsageStats> {
  const supabase = await createClient()

  try {
    // Calculate date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let startDate = new Date(today)
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        break
      case 'all':
        startDate = new Date(0) // Beginning of time
        break
    }

    const startDateStr = startDate.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    // Get all calendar event tasks (plan_id = null, is_calendar_event = true)
    const { data: calendarTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, estimated_duration_minutes, is_detached, calendar_event_id, plan_id')
      .eq('user_id', userId)
      .is('plan_id', null)
      .eq('is_calendar_event', true)

    if (tasksError) {
      logger.error('Failed to fetch calendar tasks', tasksError as Error, { userId, planIds })
      throw tasksError
    }

    // Get task schedules for date analysis
    const taskIds = (calendarTasks || []).map(t => t.id)
    let schedules: any[] = []
    
    if (taskIds.length > 0) {
      const { data: taskSchedules, error: schedulesError } = await supabase
        .from('task_schedule')
        .select('task_id, date, start_time, end_time, duration_minutes')
        .in('task_id', taskIds)
        .gte('date', startDateStr)
        .lte('date', todayStr)

      if (schedulesError) {
        logger.error('Failed to fetch task schedules', schedulesError as Error, { userId })
        // Continue without schedules - we can still calculate some stats
      } else {
        schedules = taskSchedules || []
      }
    }

    // Calculate statistics
    const totalEvents = calendarTasks?.length || 0
    const totalTimeMinutes = (calendarTasks || []).reduce((sum, task) => {
      return sum + (task.estimated_duration_minutes || 0)
    }, 0)
    const totalTimeHours = totalTimeMinutes / 60
    const averageDurationMinutes = totalEvents > 0 ? totalTimeMinutes / totalEvents : 0

    // Events by day
    const eventsByDay: Record<string, number> = {}
    schedules.forEach(schedule => {
      const date = schedule.date
      eventsByDay[date] = (eventsByDay[date] || 0) + 1
    })

    // Events by weekday
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const eventsByWeekday: Record<string, number> = {}
    schedules.forEach(schedule => {
      const date = new Date(schedule.date)
      const weekday = weekdayNames[date.getDay()]
      eventsByWeekday[weekday] = (eventsByWeekday[weekday] || 0) + 1
    })

    // Find busiest day and weekday
    const busiestDay = Object.entries(eventsByDay).reduce((max, [date, count]) => {
      return count > max.count ? { date, count } : max
    }, { date: '', count: 0 })
    const busiestDayStr = busiestDay.date || null

    const busiestWeekday = Object.entries(eventsByWeekday).reduce((max, [day, count]) => {
      return count > (eventsByWeekday[max] || 0) ? day : max
    }, '')
    const busiestWeekdayStr = busiestWeekday || null

    // Get calendar connection info
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('id, provider, selected_calendar_ids')
      .eq('user_id', userId)

    const calendarsConnected = connections?.length || 0

    // Get most active calendar (by event count per calendar connection)
    // Get calendar connections to map calendar_event_id to calendar names
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('id, provider, selected_calendar_ids')
      .eq('user_id', userId)

    // Get calendar events to map to calendar names
    const calendarEventIds = (calendarTasks || []).map(t => t.calendar_event_id).filter(Boolean)
    let calendarEventCounts: Record<string, number> = {}
    
    if (calendarEventIds.length > 0 && connections && connections.length > 0) {
      const { data: calendarEvents, error: eventsError } = await supabase
        .from('calendar_events')
        .select('id, calendar_id, calendar_connection_id')
        .in('id', calendarEventIds)
      
      if (!eventsError && calendarEvents) {
        // Map calendar_id to calendar name via connections
        const connectionMap = new Map(connections.map(c => [c.id, c]))
        const calendarNameMap = new Map<string, string>()
        
        calendarEvents.forEach(event => {
          const connection = connectionMap.get(event.calendar_connection_id)
          if (connection && connection.selected_calendar_ids?.includes(event.calendar_id)) {
            calendarNameMap.set(event.id, event.calendar_id)
          }
        })
        
        // Count events by calendar
        calendarEvents.forEach(event => {
          const calendarName = calendarNameMap.get(event.id) || 'Unknown'
          calendarEventCounts[calendarName] = (calendarEventCounts[calendarName] || 0) + 1
        })
      }
    }
    
    const mostActiveCalendar = Object.entries(calendarEventCounts).reduce((max, [name, count]) => {
      return count > (calendarEventCounts[max] || 0) ? name : max
    }, '')
    const mostActiveCalendarStr = mostActiveCalendar || null

    // Get sync frequency stats
    const connectionIds = connections?.map(c => c.id) || []
    let syncStats = {
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      last_sync_at: null as string | null,
    }

    if (connectionIds.length > 0) {
      const { data: syncLogs, error: syncLogsError } = await supabase
        .from('calendar_sync_logs')
        .select('status, created_at, completed_at')
        .in('calendar_connection_id', connectionIds)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (!syncLogsError && syncLogs) {
        syncStats.total_syncs = syncLogs.length
        syncStats.successful_syncs = syncLogs.filter(log => log.status === 'completed').length
        syncStats.failed_syncs = syncLogs.filter(log => log.status === 'failed').length
        if (syncLogs.length > 0) {
          syncStats.last_sync_at = syncLogs[0].completed_at || syncLogs[0].created_at
        }
      }
    }

    // Count detached tasks
    const detachedTasksCount = (calendarTasks || []).filter(t => t.is_detached).length

    // Count active, upcoming, and past events
    const now = new Date()
    const activeEventsCount = schedules.filter(s => {
      if (!s.start_time || !s.end_time) return false
      const start = new Date(`${s.date}T${s.start_time}`)
      const end = new Date(`${s.date}T${s.end_time}`)
      return start <= now && now <= end
    }).length

    const upcomingEventsCount = schedules.filter(s => {
      if (!s.start_time) return false
      const start = new Date(`${s.date}T${s.start_time}`)
      return start > now
    }).length

    const pastEventsCount = schedules.filter(s => {
      if (!s.end_time) return false
      const end = new Date(`${s.date}T${s.end_time}`)
      return end < now
    }).length

    return {
      total_events: totalEvents,
      total_time_minutes: totalTimeMinutes,
      total_time_hours: Math.round(totalTimeHours * 10) / 10,
      average_duration_minutes: Math.round(averageDurationMinutes),
      events_by_day: eventsByDay,
      events_by_weekday: eventsByWeekday,
      busiest_day: busiestDayStr,
      busiest_weekday: busiestWeekdayStr,
      most_active_calendar: mostActiveCalendarStr,
      calendars_connected: calendarsConnected,
      sync_frequency: syncStats,
      detached_tasks_count: detachedTasksCount,
      active_events_count: activeEventsCount,
      upcoming_events_count: upcomingEventsCount,
      past_events_count: pastEventsCount,
    }
  } catch (error) {
    logger.error('Error calculating calendar usage stats', error as Error, { userId, timeRange })
    throw error
  }
}

/**
 * Get statistics for each calendar connection
 * Note: Integration plans are no longer used, so this returns stats per calendar connection
 */
export async function getCalendarPlanStats(userId: string): Promise<CalendarPlanStats[]> {
  const supabase = await createClient()

  try {
    // Get all calendar connections
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('id, provider, selected_calendar_ids')
      .eq('user_id', userId)

    if (connectionsError) {
      logger.error('Failed to fetch calendar connections', connectionsError as Error, { userId })
      throw connectionsError
    }

    if (!connections || connections.length === 0) {
      return []
    }

    const stats: CalendarPlanStats[] = []

    for (const connection of connections) {
      // Get calendar event tasks for this connection (plan_id = null, is_calendar_event = true)
      // We need to find tasks linked to calendar events from this connection
      const { data: calendarEvents, error: eventsError } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('calendar_connection_id', connection.id)
        .limit(1000) // Limit to avoid performance issues

      if (eventsError) {
        logger.warn('Failed to fetch calendar events for connection', { connectionId: connection.id, error: eventsError })
        continue
      }

      const eventIds = (calendarEvents || []).map(e => e.id)
      
      if (eventIds.length === 0) {
        continue
      }

      // Get tasks linked to these calendar events
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, estimated_duration_minutes')
        .eq('user_id', userId)
        .is('plan_id', null)
        .eq('is_calendar_event', true)
        .in('calendar_event_id', eventIds)

      if (tasksError) {
        logger.warn('Failed to fetch tasks for connection', { connectionId: connection.id, error: tasksError })
        continue
      }

      const totalEvents = tasks?.length || 0
      const totalTimeMinutes = (tasks || []).reduce((sum, task) => {
        return sum + (task.estimated_duration_minutes || 0)
      }, 0)

      // Get schedules for this week and month
      const taskIds = (tasks || []).map(t => t.id)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)

      let eventsThisWeek = 0
      let eventsThisMonth = 0

      if (taskIds.length > 0) {
        const { data: schedules, error: schedulesError } = await supabase
          .from('task_schedule')
          .select('date')
          .in('task_id', taskIds)
          .is('plan_id', null)
          .gte('date', monthAgo.toISOString().split('T')[0])

        if (!schedulesError && schedules) {
          eventsThisWeek = schedules.filter(s => {
            const date = new Date(s.date)
            return date >= weekAgo
          }).length

          eventsThisMonth = schedules.length
        }
      }

      // Calculate average events per week (based on last 4 weeks)
      const fourWeeksAgo = new Date(today)
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

      let averageEventsPerWeek = 0
      if (taskIds.length > 0) {
        const { data: recentSchedules, error: recentError } = await supabase
          .from('task_schedule')
          .select('date')
          .in('task_id', taskIds)
          .is('plan_id', null)
          .gte('date', fourWeeksAgo.toISOString().split('T')[0])

        if (!recentError && recentSchedules) {
          averageEventsPerWeek = Math.round((recentSchedules.length / 4) * 10) / 10
        }
      }

      const providerName = connection.provider === 'google' ? 'Google Calendar'
        : connection.provider === 'outlook' ? 'Microsoft Outlook'
        : 'Apple Calendar'

      stats.push({
        plan_id: connection.id, // Use connection ID as identifier
        plan_name: `${providerName} - ${connection.selected_calendar_ids?.join(', ') || 'Calendar'}`,
        provider: connection.provider as 'google' | 'outlook' | 'apple',
        calendar_names: connection.selected_calendar_ids || [],
        total_events: totalEvents,
        total_time_minutes: totalTimeMinutes,
        events_this_week: eventsThisWeek,
        events_this_month: eventsThisMonth,
        average_events_per_week: averageEventsPerWeek,
      })
    }

    return stats
  } catch (error) {
    logger.error('Error calculating calendar plan stats', error as Error, { userId })
    throw error
  }
}

