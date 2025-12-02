import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import {
  transformActivityHeatmapData,
  transformCompletionTrendData,
  transformProductivityPatternsData,
  transformReschedulingAnalysisData,
  calculateMetrics,
  RawCompletion,
  RawSchedule,
  RawCompletionWithSchedule
} from '@/lib/analytics-utils'
import { getCalendarUsageStats, getCalendarPlanStats } from '@/lib/analytics/calendar-analytics'
import { ActivityHeatmapData } from '@/components/ui/ActivityHeatmap'
import { TrendChartData } from '@/components/ui/TrendChart'
import { BarChartData } from '@/components/ui/BarChart'

// MOCK MODE - Set to false to revert to production implementation
const USE_MOCK_DATA = true

// Mock data generation function
function generateMockAnalytics(timeRange: '7d' | '30d' | '90d' | 'all') {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  // Generate activity heatmap data (last 12 months)
  const activityData: ActivityHeatmapData[] = []
  const twelveMonthsAgo = new Date(today)
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  
  for (let d = new Date(twelveMonthsAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d)
    // More realistic activity pattern - higher activity in recent months
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    
    // Activity decreases as we go back in time, but not too much
    let activityProbability = 0
    if (daysAgo < 30) {
      activityProbability = 0.75 // High activity in last month
    } else if (daysAgo < 90) {
      activityProbability = 0.55 // Medium activity in last 3 months
    } else if (daysAgo < 180) {
      activityProbability = 0.40 // Lower activity 3-6 months ago
    } else {
      activityProbability = 0.25 // Even lower activity 6-12 months ago
    }
    
    // Add some randomness but also pattern (weekdays are more active)
    const dayOfWeek = d.getDay()
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      activityProbability *= 1.3 // Weekdays are more active
    }
    
    const hasActivity = Math.random() < activityProbability
    
    if (hasActivity) {
      // Generate realistic task counts (mostly 1-3, occasionally more)
      let count = 1
      const rand = Math.random()
      if (rand < 0.6) {
        count = 1
      } else if (rand < 0.9) {
        count = 2
      } else if (rand < 0.97) {
        count = 3
      } else {
        count = Math.floor(Math.random() * 3) + 4 // 4-6 tasks
      }
      
      const taskNames = [
        'Complete project proposal',
        'Review code changes',
        'Write documentation',
        'Schedule team meeting',
        'Update project status',
        'Design new feature'
      ]
      
      activityData.push({
        date: dateStr,
        count,
        tasks: count === 1 ? [taskNames[Math.floor(Math.random() * taskNames.length)]] : undefined
      })
    }
  }
  
  // Generate completion trend data based on timeRange
  let trendDays = 30
  switch (timeRange) {
    case '7d':
      trendDays = 7
      break
    case '30d':
      trendDays = 30
      break
    case '90d':
      trendDays = 90
      break
    case 'all':
      trendDays = 180
      break
  }
  
  const completionTrend: TrendChartData[] = []
  const trendStart = new Date(today)
  trendStart.setDate(trendStart.getDate() - trendDays)
  
  for (let d = new Date(trendStart); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d)
    // Varying completion rates with some upward trend
    const progress = (today.getTime() - d.getTime()) / (today.getTime() - trendStart.getTime())
    const baseRate = 65 + (progress * 15) + (Math.random() - 0.5) * 20
    const rate = Math.max(40, Math.min(95, baseRate))
    
    completionTrend.push({
      date: dateStr,
      value: Math.round(rate * 10) / 10
    })
  }
  
  // Generate productivity patterns (by day of week)
  const productivityPatterns: BarChartData[] = [
    { category: 'Mon', value: 24 },
    { category: 'Tue', value: 28 },
    { category: 'Wed', value: 22 },
    { category: 'Thu', value: 26 },
    { category: 'Fri', value: 18 },
    { category: 'Sat', value: 12 },
    { category: 'Sun', value: 8 }
  ]
  
  // Generate rescheduling analysis
  const reschedulingAnalysis: BarChartData[] = [
    {
      category: 'This Week',
      value: 18,
      subValues: {
        'First-time': 14,
        'Rescheduled': 4
      }
    },
    {
      category: 'Last Week',
      value: 22,
      subValues: {
        'First-time': 17,
        'Rescheduled': 5
      }
    },
    {
      category: '2 Weeks Ago',
      value: 20,
      subValues: {
        'First-time': 15,
        'Rescheduled': 5
      }
    }
  ]
  
  // Generate metrics
  const metrics = {
    completionRate: 78.5,
    currentStreak: 12,
    onTimeRate: 82.3,
    rescheduleRate: 18.2
  }
  
  return {
    activityData,
    completionTrend,
    productivityPatterns,
    reschedulingAnalysis,
    metrics
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const timeRangeParam = searchParams.get('timeRange') || '30d'
    // Validate timeRange parameter
    type TimeRange = '7d' | '30d' | '90d' | 'all'
    const validTimeRanges: TimeRange[] = ['7d', '30d', '90d', 'all']
    const timeRange: TimeRange = (validTimeRanges.includes(timeRangeParam as TimeRange) ? timeRangeParam : '30d') as TimeRange
    
    // MOCK MODE: Return mock data immediately
    if (USE_MOCK_DATA) {
      const mockData = generateMockAnalytics(timeRange)
      return NextResponse.json({
        ...mockData,
        calendarUsage: null,
        calendarPlans: null
      })
    }
    
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Calculate date ranges
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const twelveMonthsAgo = new Date(today)
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    
    let trendStartDate = new Date(today)
    switch (timeRange) {
      case '7d':
        trendStartDate.setDate(trendStartDate.getDate() - 7)
        break
      case '30d':
        trendStartDate.setDate(trendStartDate.getDate() - 30)
        break
      case '90d':
        trendStartDate.setDate(trendStartDate.getDate() - 90)
        break
      case 'all':
        trendStartDate = new Date(0) // Beginning of time
        break
      default:
        trendStartDate.setDate(trendStartDate.getDate() - 30)
    }
    
    const threeWeeksAgo = new Date(today)
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)
    
    const ninetyDaysAgo = new Date(today)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    // Format dates for queries (YYYY-MM-DD)
    // Use local date components to avoid timezone shifts
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const twelveMonthsAgoStr = formatDate(twelveMonthsAgo)
    const trendStartDateStr = formatDate(trendStartDate)
    const threeWeeksAgoStr = formatDate(threeWeeksAgo)
    const ninetyDaysAgoStr = formatDate(ninetyDaysAgo)
    
    // 1. Activity Heatmap Data (last 12 months)
    // First get completions
    const { data: activityCompletions, error: activityError } = await supabase
      .from('task_completions')
      .select('task_id, scheduled_date, plan_id, completed_at')
      .eq('user_id', user.id)
      .gte('scheduled_date', twelveMonthsAgoStr)
      .order('scheduled_date', { ascending: true })
    
    if (activityError) {
      console.error('Error fetching activity completions:', activityError)
      return NextResponse.json(
        { error: 'Failed to fetch activity data' },
        { status: 500 }
      )
    }
    
    // Get task names separately
    const taskIds = [...new Set((activityCompletions || []).map((c: any) => c.task_id))]
    let taskNamesMap = new Map<string, string>()
    
    if (taskIds.length > 0) {
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, name')
        .in('id', taskIds)
      
      if (!tasksError && tasks) {
        tasks.forEach((task: any) => {
          taskNamesMap.set(task.id, task.name)
        })
      }
    }
    
    // Transform activity data
    const activityData = transformActivityHeatmapData(
      (activityCompletions || []).map((c: any) => ({
        task_id: c.task_id,
        scheduled_date: c.scheduled_date,
        plan_id: c.plan_id,
        completed_at: c.completed_at,
        task_name: taskNamesMap.get(c.task_id)
      }))
    )
    
    // 2. Completion Trend Data
    // Get scheduled tasks per day
    const { data: scheduledTasks, error: scheduledError } = await supabase
      .from('task_schedule')
      .select('date')
      .eq('user_id', user.id)
      .gte('date', trendStartDateStr)
    
    if (scheduledError) {
      console.error('Error fetching scheduled tasks:', scheduledError)
      return NextResponse.json(
        { error: 'Failed to fetch scheduled tasks' },
        { status: 500 }
      )
    }
    
    // Group scheduled tasks by date
    const scheduledByDate = new Map<string, number>()
    ;(scheduledTasks || []).forEach((task: any) => {
      const date = task.date
      scheduledByDate.set(date, (scheduledByDate.get(date) || 0) + 1)
    })
    
    const scheduledData = Array.from(scheduledByDate.entries()).map(([date, count]) => ({
      date,
      count
    }))
    
    // Get completed tasks per day
    const { data: completedTasks, error: completedError } = await supabase
      .from('task_completions')
      .select('scheduled_date')
      .eq('user_id', user.id)
      .gte('scheduled_date', trendStartDateStr)
    
    if (completedError) {
      console.error('Error fetching completed tasks:', completedError)
      return NextResponse.json(
        { error: 'Failed to fetch completed tasks' },
        { status: 500 }
      )
    }
    
    // Group completed tasks by date
    const completedByDate = new Map<string, number>()
    ;(completedTasks || []).forEach((task: any) => {
      const date = task.scheduled_date
      completedByDate.set(date, (completedByDate.get(date) || 0) + 1)
    })
    
    const completedData = Array.from(completedByDate.entries()).map(([date, count]) => ({
      date,
      count
    }))
    
    // Transform completion trend data
    const completionTrend = transformCompletionTrendData(scheduledData, completedData)
    
    // 3. Productivity Patterns (last 90 days)
    const { data: productivityCompletions, error: productivityError } = await supabase
      .from('task_completions')
      .select('scheduled_date')
      .eq('user_id', user.id)
      .gte('scheduled_date', ninetyDaysAgoStr)
    
    if (productivityError) {
      console.error('Error fetching productivity completions:', productivityError)
      return NextResponse.json(
        { error: 'Failed to fetch productivity data' },
        { status: 500 }
      )
    }
    
    const productivityPatterns = transformProductivityPatternsData(
      (productivityCompletions || []).map((c: any) => ({
        task_id: '',
        scheduled_date: c.scheduled_date,
        plan_id: null
      }))
    )
    
    // 4. Rescheduling Analysis (last 3 weeks)
    const { data: reschedulingSchedules, error: reschedulingError } = await supabase
      .from('task_schedule')
      .select('date, rescheduled_from')
      .eq('user_id', user.id)
      .gte('date', threeWeeksAgoStr)
    
    if (reschedulingError) {
      console.error('Error fetching rescheduling schedules:', reschedulingError)
      return NextResponse.json(
        { error: 'Failed to fetch rescheduling data' },
        { status: 500 }
      )
    }
    
    const reschedulingAnalysis = transformReschedulingAnalysisData(
      (reschedulingSchedules || []).map((s: any) => ({
        date: s.date,
        task_id: '',
        plan_id: null,
        rescheduled_from: s.rescheduled_from
      }))
    )
    
    // 5. Metrics
    // Total scheduled and completed (all time)
    const { count: totalScheduledCount, error: totalScheduledError } = await supabase
      .from('task_schedule')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    
    if (totalScheduledError) {
      console.error('Error counting scheduled tasks:', totalScheduledError)
    }
    
    const { count: totalCompletedCount, error: totalCompletedError } = await supabase
      .from('task_completions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    
    if (totalCompletedError) {
      console.error('Error counting completed tasks:', totalCompletedError)
    }
    
    // Get all completions with dates for streak calculation
    // Only need unique dates, not individual completion records
    const { data: allCompletions, error: allCompletionsError } = await supabase
      .from('task_completions')
      .select('scheduled_date, completed_at')
      .eq('user_id', user.id)
      .order('scheduled_date', { ascending: false })
    
    if (allCompletionsError) {
      console.error('Error fetching all completions:', allCompletionsError)
    }
    
    // Get completions with schedule data for on-time rate
    // We need to join task_completions with task_schedule on task_id, scheduled_date, and plan_id
    const { data: allCompletionsForOnTime, error: completionsForOnTimeError } = await supabase
      .from('task_completions')
      .select('task_id, scheduled_date, plan_id, completed_at')
      .eq('user_id', user.id)
    
    if (completionsForOnTimeError) {
      console.error('Error fetching completions for on-time rate:', completionsForOnTimeError)
    }
    
    // Get corresponding schedules
    const completionsWithScheduleData: RawCompletionWithSchedule[] = []
    if (allCompletionsForOnTime && allCompletionsForOnTime.length > 0) {
      // Build a query to get schedules matching completions
      const completionKeys = allCompletionsForOnTime.map((c: any) => ({
        task_id: c.task_id,
        date: c.scheduled_date,
        plan_id: c.plan_id
      }))
      
      // Fetch schedules in batches or use a more efficient approach
      // For now, fetch all schedules and match in memory
      const { data: allSchedules, error: schedulesError } = await supabase
        .from('task_schedule')
        .select('task_id, date, plan_id, end_time')
        .eq('user_id', user.id)
      
      if (!schedulesError && allSchedules) {
        // Create a map for quick lookup
        const scheduleMap = new Map<string, any>()
        allSchedules.forEach((s: any) => {
          const key = `${s.task_id}-${s.date}-${s.plan_id || 'null'}`
          scheduleMap.set(key, s)
        })
        
        // Match completions with schedules
        allCompletionsForOnTime.forEach((c: any) => {
          const key = `${c.task_id}-${c.scheduled_date}-${c.plan_id || 'null'}`
          const schedule = scheduleMap.get(key)
          if (schedule && schedule.end_time) {
            completionsWithScheduleData.push({
              task_id: c.task_id,
              scheduled_date: c.scheduled_date,
              plan_id: c.plan_id,
              completed_at: c.completed_at,
              end_time: schedule.end_time
            })
          }
        })
      }
    }
    
    // Total tasks and rescheduled tasks
    const { count: totalTasksCount, error: totalTasksError } = await supabase
      .from('task_schedule')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    
    if (totalTasksError) {
      console.error('Error counting total tasks:', totalTasksError)
    }
    
    const { count: rescheduledTasksCount, error: rescheduledTasksError } = await supabase
      .from('task_schedule')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('rescheduled_from', 'is', null)
    
    if (rescheduledTasksError) {
      console.error('Error counting rescheduled tasks:', rescheduledTasksError)
    }
    
    // Calculate metrics
    const metrics = calculateMetrics(
      totalScheduledCount || 0,
      totalCompletedCount || 0,
      (allCompletions || []).map((c: any) => ({
        date: c.scheduled_date,
        completed_at: c.completed_at
      })),
      completionsWithScheduleData,
      totalTasksCount || 0,
      rescheduledTasksCount || 0
    )
    
    // Get calendar usage statistics
    let calendarStats = null
    let calendarPlanStats = null
    try {
      calendarStats = await getCalendarUsageStats(user.id, timeRange as '7d' | '30d' | '90d' | 'all')
      calendarPlanStats = await getCalendarPlanStats(user.id)
    } catch (calendarError) {
      console.warn('Failed to fetch calendar analytics:', calendarError)
      // Don't fail the whole request if calendar analytics fail
    }
    
    return NextResponse.json({
      activityData,
      completionTrend,
      productivityPatterns,
      reschedulingAnalysis,
      metrics,
      calendarUsage: calendarStats,
      calendarPlans: calendarPlanStats
    })
  } catch (error) {
    console.error('Error in analytics API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

