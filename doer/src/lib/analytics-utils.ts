import { ActivityHeatmapData } from '@/components/ui/ActivityHeatmap'
import { TrendChartData } from '@/components/ui/TrendChart'
import { BarChartData } from '@/components/ui/BarChart'

// Raw database types
export interface RawCompletion {
  task_id: string
  scheduled_date: string
  plan_id: string | null
  completed_at?: string
  task_name?: string
}

export interface RawSchedule {
  date: string
  task_id: string
  plan_id: string | null
  start_time?: string
  end_time?: string
  rescheduled_from?: string | null
}

export interface RawCompletionWithSchedule extends RawCompletion {
  end_time?: string
  scheduled_date: string
}

// Transform activity heatmap data
export function transformActivityHeatmapData(
  rawData: RawCompletion[]
): ActivityHeatmapData[] {
  // Group by date
  const dateMap = new Map<string, { count: number; tasks: string[] }>()
  
  rawData.forEach(completion => {
    const date = completion.scheduled_date
    if (!dateMap.has(date)) {
      dateMap.set(date, { count: 0, tasks: [] })
    }
    const entry = dateMap.get(date)!
    entry.count++
    if (completion.task_name) {
      entry.tasks.push(completion.task_name)
    }
  })
  
  // Convert to array format
  return Array.from(dateMap.entries()).map(([date, { count, tasks }]) => ({
    date,
    count,
    tasks: tasks.length > 0 ? tasks : undefined
  }))
}

// Transform completion trend data
export function transformCompletionTrendData(
  scheduledData: { date: string; count: number }[],
  completedData: { date: string; count: number }[]
): TrendChartData[] {
  // Create maps for quick lookup
  const scheduledMap = new Map<string, number>()
  scheduledData.forEach(({ date, count }) => {
    scheduledMap.set(date, count)
  })
  
  const completedMap = new Map<string, number>()
  completedData.forEach(({ date, count }) => {
    completedMap.set(date, count)
  })
  
  // Get all unique dates
  const allDates = new Set([
    ...scheduledData.map(d => d.date),
    ...completedData.map(d => d.date)
  ])
  
  // Calculate completion rate for each date
  return Array.from(allDates)
    .sort()
    .map(date => {
      const scheduled = scheduledMap.get(date) || 0
      const completed = completedMap.get(date) || 0
      const rate = scheduled > 0 ? (completed / scheduled) * 100 : 0
      
      return {
        date,
        value: Math.round(rate * 10) / 10 // Round to 1 decimal
      }
    })
}

// Transform productivity patterns data (by day of week)
export function transformProductivityPatternsData(
  completedData: RawCompletion[]
): BarChartData[] {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayCounts = new Map<number, number>()
  
  // Initialize all days to 0
  for (let i = 0; i < 7; i++) {
    dayCounts.set(i, 0)
  }
  
  // Count completions by day of week
  completedData.forEach(completion => {
    // Parse date string with explicit time to avoid timezone issues
    // completion.scheduled_date is in YYYY-MM-DD format from database
    const date = new Date(completion.scheduled_date + 'T00:00:00')
    const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
    dayCounts.set(dayOfWeek, (dayCounts.get(dayOfWeek) || 0) + 1)
  })
  
  // Convert to array format (Monday = 1, Sunday = 0)
  // Reorder to start with Monday
  return [
    { category: 'Mon', value: dayCounts.get(1) || 0 },
    { category: 'Tue', value: dayCounts.get(2) || 0 },
    { category: 'Wed', value: dayCounts.get(3) || 0 },
    { category: 'Thu', value: dayCounts.get(4) || 0 },
    { category: 'Fri', value: dayCounts.get(5) || 0 },
    { category: 'Sat', value: dayCounts.get(6) || 0 },
    { category: 'Sun', value: dayCounts.get(0) || 0 }
  ]
}

// Transform rescheduling analysis data
export function transformReschedulingAnalysisData(
  scheduleData: RawSchedule[]
): BarChartData[] {
  // Group by week
  const now = new Date()
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - now.getDay()) // Start of this week (Sunday)
  thisWeekStart.setHours(0, 0, 0, 0)
  
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(thisWeekStart.getDate() - 7)
  
  const twoWeeksAgoStart = new Date(lastWeekStart)
  twoWeeksAgoStart.setDate(lastWeekStart.getDate() - 7)
  
  const threeWeeksAgoStart = new Date(twoWeeksAgoStart)
  threeWeeksAgoStart.setDate(twoWeeksAgoStart.getDate() - 7)
  
  const weekData = {
    thisWeek: { firstTime: 0, rescheduled: 0 },
    lastWeek: { firstTime: 0, rescheduled: 0 },
    twoWeeksAgo: { firstTime: 0, rescheduled: 0 }
  }
  
  scheduleData.forEach(schedule => {
    // Parse date string directly to avoid timezone issues
    // schedule.date is already in YYYY-MM-DD format from database
    const scheduleDate = new Date(schedule.date + 'T00:00:00') // Add time to avoid timezone shift
    scheduleDate.setHours(0, 0, 0, 0)
    
    const isRescheduled = schedule.rescheduled_from !== null && schedule.rescheduled_from !== undefined
    
    // Compare dates (only count dates within the 3-week window)
    if (scheduleDate >= thisWeekStart) {
      if (isRescheduled) {
        weekData.thisWeek.rescheduled++
      } else {
        weekData.thisWeek.firstTime++
      }
    } else if (scheduleDate >= lastWeekStart) {
      if (isRescheduled) {
        weekData.lastWeek.rescheduled++
      } else {
        weekData.lastWeek.firstTime++
      }
    } else if (scheduleDate >= twoWeeksAgoStart) {
      if (isRescheduled) {
        weekData.twoWeeksAgo.rescheduled++
      } else {
        weekData.twoWeeksAgo.firstTime++
      }
    }
    // Dates before twoWeeksAgoStart are ignored (outside the 3-week window)
  })
  
  return [
    {
      category: 'This Week',
      value: weekData.thisWeek.firstTime + weekData.thisWeek.rescheduled,
      subValues: {
        'First-time': weekData.thisWeek.firstTime,
        'Rescheduled': weekData.thisWeek.rescheduled
      }
    },
    {
      category: 'Last Week',
      value: weekData.lastWeek.firstTime + weekData.lastWeek.rescheduled,
      subValues: {
        'First-time': weekData.lastWeek.firstTime,
        'Rescheduled': weekData.lastWeek.rescheduled
      }
    },
    {
      category: '2 Weeks Ago',
      value: weekData.twoWeeksAgo.firstTime + weekData.twoWeeksAgo.rescheduled,
      subValues: {
        'First-time': weekData.twoWeeksAgo.firstTime,
        'Rescheduled': weekData.twoWeeksAgo.rescheduled
      }
    }
  ]
}

// Calculate metrics
export interface Metrics {
  completionRate: number
  currentStreak: number
  onTimeRate: number
  rescheduleRate: number
}

export function calculateMetrics(
  totalScheduled: number,
  totalCompleted: number,
  completionsByDate: { date: string; completed_at?: string }[],
  completionsWithSchedule: RawCompletionWithSchedule[],
  totalTasks: number,
  rescheduledTasks: number
): Metrics {
  // Completion Rate
  const completionRate = totalScheduled > 0 
    ? Math.round((totalCompleted / totalScheduled) * 100 * 10) / 10
    : 0
  
  // Current Streak
  let currentStreak = 0
  if (completionsByDate.length > 0) {
    // Get unique dates (in case of multiple completions per day)
    const uniqueDates = new Set<string>()
    completionsByDate.forEach(c => {
      // Parse date string to avoid timezone issues
      const dateStr = c.date // Already in YYYY-MM-DD format from database
      uniqueDates.add(dateStr)
    })
    
    // Convert to sorted array (descending)
    const sortedDates = Array.from(uniqueDates).sort((a, b) => {
      // Compare as strings (YYYY-MM-DD format sorts correctly)
      return b.localeCompare(a)
    })
    
    // Get today's date string in YYYY-MM-DD format (local timezone)
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0')
    const todayDay = String(today.getDate()).padStart(2, '0')
    const todayDateStr = `${todayYear}-${todayMonth}-${todayDay}`
    
    // Check if today has a completion
    const todayHasCompletion = uniqueDates.has(todayDateStr)
    
    // Start from today or yesterday
    let checkDate = new Date(today)
    checkDate.setHours(0, 0, 0, 0)
    if (!todayHasCompletion) {
      checkDate.setDate(checkDate.getDate() - 1)
    }
    
    // Count consecutive days with completions
    while (true) {
      const checkYear = checkDate.getFullYear()
      const checkMonth = String(checkDate.getMonth() + 1).padStart(2, '0')
      const checkDay = String(checkDate.getDate()).padStart(2, '0')
      const dateStr = `${checkYear}-${checkMonth}-${checkDay}`
      
      if (uniqueDates.has(dateStr)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }
  
  // On-Time Rate
  let onTimeCount = 0
  let onTimeTotal = 0
  
  completionsWithSchedule.forEach(completion => {
    if (completion.end_time) {
      onTimeTotal++
      const completedAt = completion.completed_at 
        ? new Date(completion.completed_at)
        : null
      
      if (completedAt) {
        // Parse scheduled_date (YYYY-MM-DD format from database)
        const scheduledDate = new Date(completion.scheduled_date + 'T00:00:00')
        scheduledDate.setHours(0, 0, 0, 0)
        
        // Get completion date (from completed_at timestamp)
        const completedDate = new Date(completedAt)
        completedDate.setHours(0, 0, 0, 0)
        
        // Check if completed on the scheduled date (same calendar day)
        if (completedDate.getTime() === scheduledDate.getTime()) {
          // Parse end_time (format: HH:MM:SS or HH:MM)
          const timeParts = completion.end_time.split(':')
          const hours = parseInt(timeParts[0], 10)
          const minutes = parseInt(timeParts[1] || '0', 10)
          
          const endDateTime = new Date(scheduledDate)
          endDateTime.setHours(hours, minutes, 0, 0)
          
          // Check if completed before end_time on the scheduled date
          if (completedAt < endDateTime) {
            onTimeCount++
          }
        }
      }
    }
  })
  
  const onTimeRate = onTimeTotal > 0
    ? Math.round((onTimeCount / onTimeTotal) * 100 * 10) / 10
    : 0
  
  // Reschedule Rate
  const rescheduleRate = totalTasks > 0
    ? Math.round((rescheduledTasks / totalTasks) * 100 * 10) / 10
    : 0
  
  return {
    completionRate,
    currentStreak,
    onTimeRate,
    rescheduleRate
  }
}

