import { supabase } from '@/lib/supabase/client'

/**
 * @deprecated This function is no longer used and references legacy analytics_*_7d views.
 * The analytics snapshot system has been replaced by the real-time vitality metrics.
 * Use fetchHealthMetrics() instead which calls get_vitality_now() RPC function.
 * 
 * Kept for reference only in case legacy views need to be accessed for debugging.
 */
/*
export async function fetchAnalytics(userId: string, planId?: string) {
  // If no planId provided, try to get the user's active plan
  let activePlanId = planId
  
  if (!activePlanId) {
    const { data: plans } = await supabase
      .from('plans')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
    
    activePlanId = plans?.[0]?.id
  }
  
  // If still no plan, return empty data
  if (!activePlanId) {
    const emptyNormalized = Array.from({ length: 7 }, (_, i) => ({
      week: `Day ${i + 1}`,
      value: 0
    }))
    
    return {
      progress: emptyNormalized,
      consistency: emptyNormalized,
      efficiency: emptyNormalized
    }
  }

  const { data: progress } = await supabase
    .from('analytics_progress_7d')
    .select('day, value')
    .eq('user_id', userId)
    .eq('plan_id', activePlanId)
    .order('day', { ascending: true })

  const { data: consistency } = await supabase
    .from('analytics_consistency_7d')
    .select('day, value')
    .eq('user_id', userId)
    .eq('plan_id', activePlanId)
    .order('day', { ascending: true })

  const { data: efficiency } = await supabase
    .from('analytics_efficiency_7d')
    .select('day, value')
    .eq('user_id', userId)
    .eq('plan_id', activePlanId)
    .order('day', { ascending: true })

  // Normalize to Day 1 – Day 7 with integer percentages
  // Ensure all arrays have exactly 7 days of data
  const normalize = (rows: any[]) => {
    const normalized = []
    for (let i = 0; i < 7; i++) {
      const row = rows?.[i]
      normalized.push({
        week: `Day ${i + 1}`,
        value: Math.round(row?.value ?? 0)
      })
    }
    return normalized
  }

  return {
    progress: normalize(progress || []),
    consistency: normalize(consistency || []),
    efficiency: normalize(efficiency || [])
  }
}
*/

/**
 * Fetch health metrics for the dashboard health panel
 * Uses the degrading health model: plans start at 100% health and degrade with poor habits
 * 
 * @param userId - User ID to fetch metrics for
 * @param planId - Plan ID to fetch metrics for (required)
 * @returns Health metrics with degrading health model
 */
export async function fetchHealthMetrics(userId: string, planId?: string) {
  if (!planId) {
    console.warn('fetchHealthMetrics called without planId, returning defaults')
    return { 
      healthScore: 100,  // New plans start at 100%
      hasScheduledTasks: false,  // Gray state until tasks scheduled
      progressVal: 0, 
      consistencyVal: 0, 
      efficiencyVal: null,
      totalCompletions: 0,
      currentStreakDays: 0,
      penalties: {
        lateCompletions: 0,
        overdueTasks: 0,
        consistencyGaps: 0,
        progressLag: 0
      },
      bonuses: {
        ontimeCompletions: 0,
        earlyCompletions: 0,
        streakBonus: 0
      },
      history: {
        progress: [],
        consistency: [],
        efficiency: []
      }
    }
  }

  // Use existing get_vitality_now function from database
  const { data, error } = await supabase.rpc('get_vitality_now', {
    p_user_id: userId,
    p_plan_id: planId,
  })
  
  if (error) {
    console.error('Error fetching health metrics:', error)
    throw error
  }
  
  const metrics = data || {}
  
  // Map vitality_score to healthScore for frontend consistency
  return {
    healthScore: metrics.vitality_score ?? 100,
    hasScheduledTasks: metrics.has_scheduled_tasks ?? false,
    progressVal: metrics.progress ?? 0,
    consistencyVal: metrics.consistency ?? 0,
    efficiencyVal: metrics.efficiency ?? null,
    totalCompletions: metrics.total_completions ?? 0,
    currentStreakDays: metrics.current_streak_days ?? 0,
    penalties: {
      lateCompletions: metrics.penalties?.late_completions ?? 0,
      overdueTasks: metrics.penalties?.overdue_tasks ?? 0,
      consistencyGaps: metrics.penalties?.consistency_gaps ?? 0,
      progressLag: metrics.penalties?.progress_lag ?? 0
    },
    bonuses: {
      ontimeCompletions: metrics.bonuses?.ontime_completions ?? 0,
      earlyCompletions: metrics.bonuses?.early_completions ?? 0,
      streakBonus: metrics.bonuses?.streak_bonus ?? 0
    },
    history: {
      progress: [],
      consistency: [],
      efficiency: []
    }
  }
}

/**
 * Helper function to group snapshots by date for client-side display
 * 
 * @deprecated This function is deprecated as analytics_snapshots table has been removed.
 * Will be replaced by new persistence system.
 */
export function groupSnapshotsByDate(snapshots: any[]) {
  const grouped: Record<string, Record<string, number>> = {}
  
  snapshots.forEach(snapshot => {
    if (!grouped[snapshot.snapshot_date]) {
      grouped[snapshot.snapshot_date] = {}
    }
    
    const value = typeof snapshot.value === 'string' ? parseFloat(snapshot.value) : snapshot.value
    grouped[snapshot.snapshot_date][snapshot.metric] = value
  })
  
  return grouped
}

/**
 * Helper function to pivot snapshots by plan for multi-plan display
 * Groups by plan_id and snapshot_date
 * 
 * @deprecated This function is deprecated as analytics_snapshots table has been removed.
 * Will be replaced by new persistence system.
 */
export function groupSnapshotsByPlan(snapshots: any[]) {
  const grouped: Record<string, Record<string, Record<string, number>>> = {}
  
  snapshots.forEach(snapshot => {
    if (!grouped[snapshot.plan_id]) {
      grouped[snapshot.plan_id] = {}
    }
    if (!grouped[snapshot.plan_id][snapshot.snapshot_date]) {
      grouped[snapshot.plan_id][snapshot.snapshot_date] = {}
    }
    
    const value = typeof snapshot.value === 'string' ? parseFloat(snapshot.value) : snapshot.value
    grouped[snapshot.plan_id][snapshot.snapshot_date][snapshot.metric] = value
  })
  
  return grouped
}

/**
 * Fetch analytics timeline data for the dashboard timeline panel
 * 
 * TEMPORARY STUB: Returns empty arrays while new persistence system is being installed.
 * This function previously read from analytics_snapshots table which has been removed.
 * 
 * @deprecated This will be replaced by the new persistence system
 */
export async function fetchAnalyticsTimeline(userId: string) {
  return {
    progress: [],
    consistency: [],
    efficiency: []
  }
}

/**
 * Fetch health history for the past N days
 * Queries health_snapshots table for historical health data
 * 
 * @param userId - User ID to fetch history for
 * @param planId - Plan ID to fetch history for
 * @param days - Number of days to fetch (default: 7)
 * @returns Chronologically sorted health snapshot data
 */
export async function fetchHealthHistory(userId: string, planId: string, days: number = 7) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const { data, error } = await supabase
    .from('health_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })
  
  if (error) {
    console.error('Error fetching health history:', error)
    return []
  }
  
  return data || []
}

/**
 * Fetch weekly health analytics for the past N weeks
 * Groups health snapshots by week (Sunday-start) and computes averages
 * 
 * @param userId - User ID to fetch analytics for
 * @param planId - Plan ID to fetch analytics for
 * @param weeks - Number of weeks to fetch (default: 4)
 * @returns Weekly averages and penalty/bonus totals
 */
export async function fetchWeeklyHealthAnalytics(userId: string, planId: string, weeks: number = 4) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (weeks * 7))
  
  const { data, error } = await supabase
    .from('health_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })
  
  if (error) {
    console.error('Error fetching weekly health analytics:', error)
    return []
  }
  
  if (!data || data.length === 0) {
    return []
  }
  
  // Group by Sunday-start weeks in JavaScript
  const weeklyData: Record<string, any[]> = {}
  
  data.forEach(snapshot => {
    const date = new Date(snapshot.snapshot_date)
    // Get the Sunday of the week
    const sunday = new Date(date)
    sunday.setDate(date.getDate() - date.getDay())
    const weekKey = sunday.toISOString().split('T')[0]
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = []
    }
    weeklyData[weekKey].push(snapshot)
  })
  
  // Compute weekly averages
  const weeklyAnalytics = Object.entries(weeklyData).map(([weekStart, snapshots]) => {
    const count = snapshots.length
    
    return {
      week_start: weekStart,
      avg_health_score: snapshots.reduce((sum, s) => sum + (parseFloat(s.health_score) || 0), 0) / count,
      avg_progress: snapshots.reduce((sum, s) => sum + (parseFloat(s.progress) || 0), 0) / count,
      avg_consistency: snapshots.reduce((sum, s) => sum + (parseFloat(s.consistency) || 0), 0) / count,
      avg_efficiency: snapshots.reduce((sum, s) => sum + (parseFloat(s.efficiency) || 0), 0) / count || null,
      total_late_penalty: snapshots.reduce((sum, s) => sum + (parseFloat(s.late_completion_penalty) || 0), 0),
      total_overdue_penalty: snapshots.reduce((sum, s) => sum + (parseFloat(s.overdue_penalty) || 0), 0),
      total_consistency_gap_penalty: snapshots.reduce((sum, s) => sum + (parseFloat(s.consistency_gap_penalty) || 0), 0),
      total_progress_lag_penalty: snapshots.reduce((sum, s) => sum + (parseFloat(s.progress_lag_penalty) || 0), 0),
      total_ontime_bonus: snapshots.reduce((sum, s) => sum + (parseFloat(s.ontime_completion_bonus) || 0), 0),
      total_early_bonus: snapshots.reduce((sum, s) => sum + (parseFloat(s.early_completion_bonus) || 0), 0),
      total_streak_bonus: snapshots.reduce((sum, s) => sum + (parseFloat(s.streak_bonus) || 0), 0),
      days_in_week: count
    }
  })
  
  return weeklyAnalytics
}

/**
 * Fetch health insights by comparing recent vs previous period
 * Analyzes last 7 days vs previous 7 days to determine trend
 * 
 * @param userId - User ID to fetch insights for
 * @param planId - Plan ID to fetch insights for
 * @returns Trend analysis with message and percentage change
 */
export async function fetchHealthInsights(userId: string, planId: string) {
  // Fetch 14 days of history
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 14)
  
  const { data, error } = await supabase
    .from('health_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })
  
  if (error) {
    console.error('Error fetching health insights:', error)
    return {
      trend: 'neutral',
      message: 'Unable to determine trend',
      change: 0
    }
  }
  
  if (!data || data.length < 2) {
    return {
      trend: 'neutral',
      message: 'Not enough data to determine trend',
      change: 0
    }
  }
  
  // Split into two periods: last 7 days vs previous 7 days
  const midpoint = new Date()
  midpoint.setDate(midpoint.getDate() - 7)
  const midpointStr = midpoint.toISOString().split('T')[0]
  
  const previousPeriod = data.filter(s => s.snapshot_date < midpointStr)
  const recentPeriod = data.filter(s => s.snapshot_date >= midpointStr)
  
  if (previousPeriod.length === 0 || recentPeriod.length === 0) {
    return {
      trend: 'neutral',
      message: 'Not enough data in both periods',
      change: 0
    }
  }
  
  // Calculate average health scores for each period
  const previousAvg = previousPeriod.reduce((sum, s) => sum + (parseFloat(s.health_score) || 0), 0) / previousPeriod.length
  const recentAvg = recentPeriod.reduce((sum, s) => sum + (parseFloat(s.health_score) || 0), 0) / recentPeriod.length
  
  // Calculate percentage change
  const change = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0
  
  // Determine trend with ±5% threshold
  let trend: 'improving' | 'declining' | 'neutral' = 'neutral'
  let message = 'Your health is stable'
  
  if (change > 5) {
    trend = 'improving'
    message = `Your health has improved by ${change.toFixed(1)}% over the last week`
  } else if (change < -5) {
    trend = 'declining'
    message = `Your health has declined by ${Math.abs(change).toFixed(1)}% over the last week`
  } else {
    message = 'Your health remains stable with minor fluctuations'
  }
  
  return {
    trend,
    message,
    change: parseFloat(change.toFixed(1))
  }
}
