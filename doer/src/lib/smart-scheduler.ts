import { supabase } from '@/lib/supabase/client'
import { timeBlockScheduler } from '@/lib/time-block-scheduler'
import { 
  toLocalMidnight, 
  formatDateForDB, 
  parseDateFromDB, 
  addDays,
  daysBetween 
} from '@/lib/date-utils'
import { logger } from '@/lib/logger'

export interface ReschedulingResult {
  newEndDate: Date
  daysExtended: number
  taskAdjustments: Array<{
    taskId: string
    oldDate: string
    newDate: string
    newStartTime?: string
    newEndTime?: string
    duration?: number
  }>
  reason: {
    missedDates: string[]
    incompleteTasks: number
    trigger: 'automatic' | 'manual'
    message: string
  }
}

export interface MissedTask {
  taskId: string
  taskName: string
  scheduledDate: string
  daysOverdue: number
}

/**
 * Detect missed tasks for a plan on a specific date
 */
export async function detectMissedTasks(
  planId: string, 
  checkDate: Date = new Date()
): Promise<MissedTask[]> {
  try {
    const { data, error } = await supabase.rpc('detect_missed_tasks', {
      p_plan_id: planId,
      p_check_date: formatDateForDB(checkDate)
    })

    if (error) throw error

    return data?.map((task: any) => ({
      taskId: task.task_id,
      taskName: task.task_name,
      scheduledDate: task.scheduled_date,
      daysOverdue: task.days_overdue
    })) || []
  } catch (error) {
    logger.error('Error detecting missed tasks', error as Error, { planId, checkDate: formatDateForDB(checkDate) })
    return []
  }
}

/**
 * Calculate how many days to extend the plan based on missed tasks
 * Strategy: Extend by the number of days with missed tasks
 */
export function calculateExtension(missedTasks: MissedTask[]): number {
  if (missedTasks.length === 0) return 0

  // Get unique missed dates
  const missedDates = new Set(missedTasks.map(task => task.scheduledDate))
  
  // Extend by number of days with missed tasks
  return missedDates.size
}

/**
 * Analyze a plan and determine what rescheduling is needed
 */
export async function analyzeAndReschedule(
  planId: string,
  userId: string,
  missedDate?: string
): Promise<ReschedulingResult | null> {
  try {
    // Check if smart scheduling is enabled for this user
    const { data: settingsEnabled, error: settingsError } = await supabase.rpc(
      'is_smart_scheduling_enabled',
      { p_user_id: userId }
    )
    
    if (settingsError) throw settingsError
    if (!settingsEnabled) {
      logger.debug('Smart scheduling disabled for user', { userId })
      return null
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, start_date, end_date, original_end_date')
      .eq('id', planId)
      .eq('status', 'active')
      .single()

    if (planError) throw planError
    if (!plan) return null

    // Detect missed tasks
    const checkDate = missedDate ? parseDateFromDB(missedDate) : new Date()
    const missedTasks = await detectMissedTasks(planId, checkDate)
    
    if (missedTasks.length === 0) {
      logger.debug('No missed tasks found for plan', { planId, userId })
      return null
    }

    // Calculate extension needed
    const daysExtended = calculateExtension(missedTasks)
    if (daysExtended === 0) return null

    // Calculate new end date
    const currentEndDate = parseDateFromDB(plan.end_date)
    const newEndDate = addDays(currentEndDate, daysExtended)

    // Get all remaining tasks (not completed, scheduled after the missed date)
    const { data: remainingTasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id, name, category, milestone_id,
        task_schedule!inner (
          id, date, day_index
        )
      `)
      .eq('plan_id', planId)
      .gt('task_schedule.date', missedTasks[0].scheduledDate)
      .order('task_schedule.date', { ascending: true })

    if (tasksError) throw tasksError

    // Milestones removed from system - focusing on task-based scheduling

    // Redistribute remaining tasks using AI scheduler
    const taskAdjustments = await redistributeTasks(
      remainingTasks || [],
      plan.start_date,
      newEndDate,
      planId
    )

    // Milestones removed from system

    // Prepare reason for history
    const missedDates = Array.from(new Set(missedTasks.map(t => t.scheduledDate)))
    const reason = {
      missedDates,
      incompleteTasks: missedTasks.length,
      trigger: 'automatic' as const,
      message: `Plan adjusted due to ${missedDates.length} missed day(s) with ${missedTasks.length} incomplete tasks`
    }

    return {
      newEndDate,
      daysExtended,
      taskAdjustments,
      reason
    }
  } catch (error) {
    console.error('Error analyzing rescheduling:', error)
    throw error
  }
}

/**
 * Redistribute remaining tasks using time-block scheduler
 */
async function redistributeTasks(
  tasks: any[],
  startDate: string,
  newEndDate: Date,
  planId: string
): Promise<Array<{ taskId: string; oldDate: string; newDate: string; newStartTime?: string; newEndTime?: string; duration?: number }>> {
  if (tasks.length === 0) return []

  try {
    const startDateObj = parseDateFromDB(startDate)
    
    // Get user settings for workday hours
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', tasks[0]?.user_id)
      .single()

    const prefs = userSettings?.preferences || {}
    const workdayPrefs = prefs.workday || {}
    const workdayStartHour = workdayPrefs.workday_start_hour ?? prefs.workday_start_hour ?? 9
    const workdayEndHour = workdayPrefs.workday_end_hour ?? prefs.workday_end_hour ?? 17
    const lunchStartHour = workdayPrefs.lunch_start_hour ?? prefs.lunch_start_hour ?? 12
    const lunchEndHour = workdayPrefs.lunch_end_hour ?? prefs.lunch_end_hour ?? 13

    // Fetch task details including durations
    const { data: tasksWithDurations } = await supabase
      .from('tasks')
      .select('id, name, estimated_duration_minutes, complexity_score, milestone_id, priority, idx')
      .in('id', tasks.map(t => t.id))

    if (!tasksWithDurations) return []

    // Map tasks to include required properties with defaults
    const mappedTasks = tasksWithDurations.map((task: any, index: number) => ({
      ...task,
      priority: task.priority || 3,
      idx: task.idx ?? index
    }))

    const lunchMinutes = Math.max(0, lunchEndHour - lunchStartHour) * 60
    const baseWorkdayMinutes = Math.max(60, (workdayEndHour - workdayStartHour) * 60 - lunchMinutes)
    const weekdayMaxMinutes = Math.max(120, Math.round(baseWorkdayMinutes * 0.6))

    let weekendStartHour = Math.max(workdayStartHour, 9)
    let weekendEndHour = Math.min(workdayEndHour + 2, 20)
    if (weekendEndHour <= weekendStartHour) {
      weekendStartHour = workdayStartHour
      weekendEndHour = workdayEndHour
    }
    const weekendCapacityMinutes = Math.max(60, (weekendEndHour - weekendStartHour) * 60 - lunchMinutes)
    const weekendMaxMinutes = Math.min(480, Math.max(180, weekendCapacityMinutes))

    // Use time-block scheduler to redistribute
    const newSchedule = timeBlockScheduler({
      tasks: mappedTasks,
      startDate: startDateObj,
      endDate: newEndDate,
      workdayStartHour,
      workdayStartMinute: 0,
      workdayEndHour,
      lunchStartHour,
      lunchEndHour,
      allowWeekends: true,
      weekendStartHour,
      weekendStartMinute: 0,
      weekendEndHour,
      weekendLunchStartHour: lunchStartHour,
      weekendLunchEndHour: lunchEndHour,
      weekdayMaxMinutes,
      weekendMaxMinutes
    })

    // Map to adjustment format
    const adjustments: Array<{ taskId: string; oldDate: string; newDate: string; newStartTime?: string; newEndTime?: string; duration?: number }> = []
    
    for (const task of tasks) {
      const currentSchedule = task.task_schedule[0]
      const newScheduleItem = newSchedule.placements.find(s => s.task_id === task.id)
      
      if (newScheduleItem && newScheduleItem.date !== currentSchedule.date) {
        adjustments.push({
          taskId: task.id,
          oldDate: currentSchedule.date,
          newDate: newScheduleItem.date,
          newStartTime: newScheduleItem.start_time,
          newEndTime: newScheduleItem.end_time,
          duration: newScheduleItem.duration_minutes
        })
      }
    }

    return adjustments
  } catch (error) {
    logger.error('Error redistributing tasks', error as Error, { planId, taskCount: tasks.length })
    return []
  }
}

/**
 * Shift milestone dates proportionally
 */
function shiftMilestones(
  milestones: any[],
  daysExtended: number
): Array<{ milestoneId: string; oldDate: string; newDate: string }> {
  const adjustments: Array<{ milestoneId: string; oldDate: string; newDate: string }> = []

  for (const milestone of milestones) {
    const oldDate = milestone.target_date
    const oldDateObj = parseDateFromDB(oldDate)
    const newDateObj = addDays(oldDateObj, daysExtended)
    const newDate = formatDateForDB(newDateObj)

    adjustments.push({
      milestoneId: milestone.id,
      oldDate,
      newDate
    })
  }

  return adjustments
}

/**
 * Apply rescheduling changes to the database
 */
export async function applyScheduleChanges(
  planId: string,
  userId: string,
  result: ReschedulingResult
): Promise<boolean> {
  try {
    // Fetch current plan to get original_end_date
    const { data: currentPlan, error: planFetchError } = await supabase
      .from('plans')
      .select('end_date, original_end_date')
      .eq('id', planId)
      .eq('user_id', userId)
      .single()

    if (planFetchError || !currentPlan) {
      logger.error('Error fetching plan for schedule changes', planFetchError as Error, { planId, userId })
      return false
    }

    // Prepare task adjustments as JSONB
    const taskAdjustmentsJson = result.taskAdjustments.map(adj => ({
      taskId: adj.taskId,
      oldDate: adj.oldDate,
      newDate: adj.newDate,
      newStartTime: adj.newStartTime || null,
      newEndTime: adj.newEndTime || null,
      duration: adj.duration || null,
    }))

    // Call the database function that handles the transaction server-side
    const { data, error } = await supabase.rpc('apply_schedule_changes_transaction', {
      p_plan_id: planId,
      p_user_id: userId,
      p_new_end_date: formatDateForDB(result.newEndDate),
      p_original_end_date: currentPlan.end_date,
      p_task_adjustments: taskAdjustmentsJson,
      p_days_extended: result.daysExtended,
      p_reason: result.reason
    })

    if (error) {
      logger.error('Error applying schedule changes', error as Error, { planId, userId })
      return false
    }

    return data === true
  } catch (error) {
    logger.error('Error applying schedule changes', error as Error, { planId, userId })
    return false
  }
}

/**
 * Get scheduling history for a plan
 */
export async function getSchedulingHistory(planId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('scheduling_history')
      .select('*')
      .eq('plan_id', planId)
      .order('adjustment_date', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching scheduling history:', error)
    return []
  }
}

/**
 * Check day capacity for duration-aware redistribution
 */
async function checkDayCapacity(planId: string, date: string): Promise<number> {
  try {
    const { data: schedules } = await supabase
      .from('task_schedule')
      .select('duration_minutes')
      .eq('plan_id', planId)
      .eq('date', date)
    
    const totalMinutes = schedules?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0
    const availableMinutes = (8 * 60) - totalMinutes // 8-hour day
    return Math.max(0, availableMinutes)
  } catch (error) {
    console.error('Error checking day capacity:', error)
    return 0
  }
}

/**
 * Check if a plan needs rescheduling (for daily cron job)
 */
export async function checkPlanForRescheduling(planId: string): Promise<boolean> {
  try {
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, status')
      .eq('id', planId)
      .eq('status', 'active')
      .single()

    if (planError || !plan) return false

    // Check if smart scheduling is enabled
    const { data: settingsEnabled, error: settingsError } = await supabase.rpc(
      'is_smart_scheduling_enabled',
      { p_user_id: plan.user_id }
    )
    
    if (settingsError || !settingsEnabled) return false

    // Check for missed tasks
    const missedTasks = await detectMissedTasks(planId)
    return missedTasks.length > 0
  } catch (error) {
    console.error('Error checking plan for rescheduling:', error)
    return false
  }
}

/**
 * Process rescheduling for a single plan (used by cron job)
 */
export async function processPlanRescheduling(planId: string): Promise<boolean> {
  try {
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id')
      .eq('id', planId)
      .eq('status', 'active')
      .single()

    if (planError || !plan) return false

    // Analyze and reschedule
    const result = await analyzeAndReschedule(planId, plan.user_id)
    
    if (!result) return false

    // Apply changes
    const success = await applyScheduleChanges(planId, plan.user_id, result)
    
    if (success) {
      logger.info('Processed rescheduling for plan', { planId, reason: result.reason.message })
    }

    return success
  } catch (error) {
    logger.error('Error processing rescheduling for plan', error as Error, { planId })
    return false
  }
}









