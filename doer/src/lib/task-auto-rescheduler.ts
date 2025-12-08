import { formatDateForDB, parseDateFromDB, addDays, isSameDay } from '@/lib/date-utils'
import { isCrossDayTask, parseTimeToMinutes, getCurrentDateTime, shouldSkipPastTaskInstance, calculateDuration } from '@/lib/task-time-utils'
import type { RescheduleProposal } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface OverdueTask {
  task_id: string
  schedule_id: string
  task_name: string
  scheduled_date: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  priority: number | null
  complexity_score: number | null
  status: string
}

export interface RescheduleSlot {
  date: string
  start_time: string
  end_time: string
  day_index: number
  score: number
  context_score: number
  priority_penalty: number
  density_penalty: number
}

export interface RescheduleResult {
  success: boolean
  taskId: string
  taskName: string
  oldDate: string
  oldStartTime: string | null
  oldEndTime: string | null
  newDate: string
  newStartTime: string
  newEndTime: string
  reason: string
  contextScore?: number
}

export interface UserWorkdaySettings {
  workdayStartHour: number
  workdayStartMinute: number
  workdayEndHour: number
  lunchStartHour: number
  lunchEndHour: number
  bufferMinutes: number
  prioritySpacing: 'strict' | 'moderate' | 'loose'
  rescheduleWindowDays: number
}

/**
 * Detect overdue tasks for a plan or free-mode (tasks that passed end_time without completion)
 * @param planId - Plan ID or null for free-mode tasks
 */
export async function detectOverdueTasks(
  supabase: SupabaseClient,
  planId: string | null,
  userId: string,
  checkTime: Date = new Date()
): Promise<OverdueTask[]> {
  try {
    const checkTimeISO = checkTime.toISOString()
    const localTime = new Date(checkTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const localDate = checkTime.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })
    const localTimeStr = checkTime.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: false })
    
    // Get local date in YYYY-MM-DD format (not UTC date)
    const localDateObj = new Date(checkTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const todayDateStr = `${localDateObj.getFullYear()}-${String(localDateObj.getMonth() + 1).padStart(2, '0')}-${String(localDateObj.getDate()).padStart(2, '0')}`
    
    console.log('[detectOverdueTasks] Checking for overdue tasks:', {
      planId: planId || 'free-mode',
      userId,
      checkTimeUTC: checkTimeISO,
      checkTimeLocal: checkTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
      localDate,
      localTime: localTimeStr,
      localHour: localTime.getHours(),
      localMinute: localTime.getMinutes(),
      todayDateStr
    })
    
    // Get all schedules for today and past dates (not future dates)
    // This allows detection of overdue tasks from past days as well as today
    const { data: allSchedules, error: schedulesError } = await supabase
      .from('task_schedule')
      .select('id, date, start_time, end_time, status, plan_id, task_id, user_id, duration_minutes')
      .eq('user_id', userId)
      .lte('date', todayDateStr) // Include today and past dates
    
    if (schedulesError) {
      console.error('[detectOverdueTasks] Error fetching schedules:', schedulesError)
      throw schedulesError
    }
    
    console.log('[detectOverdueTasks] All schedules fetched:', {
      count: allSchedules?.length || 0,
      schedules: allSchedules?.map((s: any) => ({
        id: s.id,
        date: s.date,
        end_time: s.end_time,
        plan_id: s.plan_id,
        status: s.status
      }))
    })
    
    // Filter for free-mode or plan-based tasks
    // Include 'scheduled', 'overdue', and 'rescheduling' statuses
    // Exclude 'pending_reschedule' (already has proposal) and 'rescheduled' (already rescheduled)
    const filteredSchedules = (allSchedules || []).filter((s: any) => {
      if (planId === null) {
        return s.plan_id === null
      } else {
        return s.plan_id === planId
      }
    }).filter((s: any) => 
      ['scheduled', 'overdue', 'rescheduling'].includes(s.status) && 
      s.end_time !== null &&
      s.status !== 'pending_reschedule' // Already has a proposal
    )
    
    console.log('[detectOverdueTasks] Filtered schedules:', {
      planId,
      count: filteredSchedules.length,
      schedules: filteredSchedules.map((s: any) => ({
        id: s.id,
        date: s.date,
        end_time: s.end_time,
        end_time_type: typeof s.end_time,
        localTimeStr,
        localTimeStr_type: typeof localTimeStr,
        is_overdue: s.end_time && s.end_time < localTimeStr,
        status: s.status
      }))
    })
    
    // Get tasks for these schedules
    const taskIds = filteredSchedules.map((s: any) => s.task_id)
    let tasks: any[] = []
    if (taskIds.length > 0) {
      let tasksQuery = supabase
        .from('tasks')
        .select('id, name, user_id, plan_id, priority')
        .in('id', taskIds)
        .eq('user_id', userId)
      
      if (planId === null) {
        tasksQuery = tasksQuery.is('plan_id', null)
      } else {
        tasksQuery = tasksQuery.eq('plan_id', planId)
      }
      
      const { data: tasksData, error: tasksError } = await tasksQuery
      if (tasksError) {
        console.error('[detectOverdueTasks] Error fetching tasks:', tasksError)
        throw tasksError
      }
      tasks = tasksData || []
    }
    
    // Get completions - match by task_id, scheduled_date, AND plan_id (from schedule, not task)
    // This ensures we only match completions that correspond to the specific schedule instance
    // Create a map of schedule_id -> completion for quick lookup
    const completionsMap = new Map<string, any>()
    
    if (taskIds.length > 0) {
      // For each schedule, we need to check if there's a completion with matching plan_id
      // Since task_completions.plan_id is NOT NULL, free-mode tasks can't have completions
      // But we still need to check for completions from when the task was in a plan
      const completionChecks = await Promise.all(
        filteredSchedules.map(async (schedule: any) => {
          let completionQuery = supabase
            .from('task_completions')
            .select('id, task_id, scheduled_date, plan_id')
            .eq('task_id', schedule.task_id)
            .eq('scheduled_date', todayDateStr)
            .eq('user_id', userId)
          
          // Match completion plan_id to schedule plan_id (not task plan_id)
          // This is critical: the schedule's plan_id determines which completion to check
          if (schedule.plan_id === null) {
            // Free-mode schedule: task_completions.plan_id is NOT NULL, so no completions possible
            // But check anyway in case there's a completion from when it was in a plan
            completionQuery = completionQuery.is('plan_id', null)
          } else {
            completionQuery = completionQuery.eq('plan_id', schedule.plan_id)
          }
          
          const { data: completionData } = await completionQuery
          return {
            schedule_id: schedule.id,
            task_id: schedule.task_id,
            completion: completionData?.[0] || null
          }
        })
      )
      
      // Populate the completions map
      completionChecks
        .filter(check => check.completion !== null)
        .forEach(check => {
          completionsMap.set(check.schedule_id, check.completion)
        })
      
      console.log('[detectOverdueTasks] Completions found:', {
        count: completionsMap.size,
        completions: Array.from(completionsMap.entries()).map(([schedule_id, completion]) => ({
          schedule_id,
          completion: {
            id: completion.id,
            task_id: completion.task_id,
            scheduled_date: completion.scheduled_date,
            plan_id: completion.plan_id
          }
        }))
      })
    }
    
    // Combine and filter by time
    const overdueTasks = filteredSchedules
      .map((schedule: any) => {
        const task = tasks.find((t: any) => t.id === schedule.task_id)
        // Match completion by schedule_id, not just task_id
        const completion = completionsMap.get(schedule.id)
      
        if (!task) {
          console.log('[detectOverdueTasks] No task found for schedule:', schedule.id, 'task_id:', schedule.task_id)
          return null
        }
        
        // Check if overdue by time
        // For tasks scheduled for today: compare end_time with current time
        // For tasks scheduled for past dates: they're automatically overdue if not completed
        const scheduleDateStr = schedule.date
        const isPastDate = scheduleDateStr < todayDateStr
        const isToday = scheduleDateStr === todayDateStr
        
        // Normalize end_time to HH:MM:SS format for comparison (remove seconds if present, add if missing)
        const normalizeTime = (timeStr: string | null): string | null => {
          if (!timeStr) return null
          const parts = timeStr.split(':')
          if (parts.length === 2) {
            return `${timeStr}:00` // Add seconds if missing
          }
          return timeStr // Already has seconds
        }
        
        const normalizedEndTime = normalizeTime(schedule.end_time)
        const normalizedLocalTime = normalizeTime(localTimeStr)
        
        // Only mark as overdue if:
        // 1. Date is in the past (regardless of time), OR
        // 2. Date is today AND end_time has passed
        const isOverdueByTime = normalizedEndTime && normalizedLocalTime && (
          isPastDate || // Past dates are automatically overdue
          (isToday && normalizedEndTime < normalizedLocalTime) // Today's tasks are overdue if end_time passed
        )
        // For free-mode tasks (schedule.plan_id === null), task_completions.plan_id is NOT NULL
        // So there can never be a completion for free-mode tasks
        // Map.get() returns undefined (not null) when key doesn't exist, so check for truthiness
        const isCompleted = !!completion
        
        console.log('[detectOverdueTasks] Checking schedule:', {
          schedule_id: schedule.id,
          schedule_plan_id: schedule.plan_id,
          task_name: task.name,
          task_id: schedule.task_id,
          task_plan_id: task.plan_id,
          end_time: schedule.end_time,
          localTimeStr,
          isOverdueByTime,
          completion_found: completion !== null,
          completion_details: completion ? {
            id: completion.id,
            task_id: completion.task_id,
            scheduled_date: completion.scheduled_date,
            plan_id: completion.plan_id
          } : null,
          isCompleted,
          willInclude: isOverdueByTime && !isCompleted
        })
        
        if (isOverdueByTime && !isCompleted) {
          return {
            task_id: task.id,
            schedule_id: schedule.id,
            task_name: task.name,
            scheduled_date: schedule.date,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            duration_minutes: schedule.duration_minutes || null,
            priority: task.priority,
            complexity_score: null,
            status: schedule.status
          }
        }
        return null
      })
      .filter((t) => t !== null) as OverdueTask[]
  
    console.log('[detectOverdueTasks] TypeScript detection result:', {
      found: overdueTasks.length,
      tasks: overdueTasks.map((t: any) => ({
        name: t.task_name,
        date: t.scheduled_date,
        end_time: t.end_time,
        status: t.status
      }))
    })
    
    // Now check for overdue indefinite recurring tasks that don't have schedule entries
    // Query for indefinite recurring tasks
    let indefQuery = supabase
      .from('tasks')
      .select('id, name, priority, is_recurring, is_indefinite, recurrence_days, default_start_time, default_end_time, plan_id')
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .eq('is_indefinite', true)
    
    if (planId === null) {
      indefQuery = indefQuery.is('plan_id', null)
    } else {
      indefQuery = indefQuery.eq('plan_id', planId)
    }
    
    let indefTasks: any[] | null = null
    try {
      const { data: indef, error: indefError } = await indefQuery
      if (indefError) throw indefError
      indefTasks = indef || []
    } catch (indefErr: any) {
      // If default_* columns are not present yet, skip synthesizing indefinite tasks
      if (indefErr?.code === '42703') {
        console.warn('[detectOverdueTasks] Skipping indefinite recurring tasks: default_* columns not found')
        indefTasks = []
      } else {
        console.error('[detectOverdueTasks] Error fetching indefinite recurring tasks:', indefErr)
        indefTasks = []
      }
    }
    
    if (indefTasks && indefTasks.length > 0) {
      console.log(`[detectOverdueTasks] Found ${indefTasks.length} indefinite recurring task(s) to check`)
      
      // Helper function to format date as YYYY-MM-DD
      const fmtLocal = (d: Date) => {
        const y = d.getFullYear()
        const m = (d.getMonth() + 1).toString().padStart(2, '0')
        const da = d.getDate().toString().padStart(2, '0')
        return `${y}-${m}-${da}`
      }
      
      // Helper function to trim seconds from time string
      const trimSeconds = (t: string | null) => {
        if (!t) return t
        const parts = t.split(':')
        return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t
      }
      
      // Check overdue instances for the past 7 days and today
      // This covers recent overdue tasks without going too far back
      const daysToCheck = 7
      const recurringOverdueTasks: OverdueTask[] = []
      
      for (let dayOffset = daysToCheck; dayOffset >= 0; dayOffset--) {
        const checkDate = new Date(localDateObj)
        checkDate.setDate(localDateObj.getDate() - dayOffset)
        const dateKey = fmtLocal(checkDate)
        const dow = checkDate.getDay()
        
        // Skip future dates
        if (dateKey > todayDateStr) continue
        
        for (const t of indefTasks) {
          const days: number[] = (t.recurrence_days || []).map((v: any) => typeof v === 'string' ? parseInt(v, 10) : v)
          const startT = trimSeconds(t.default_start_time)
          const endT = trimSeconds(t.default_end_time)
          
          if (!startT || !endT) continue
          
          const isCrossDay = isCrossDayTask(startT, endT)
          
          // For cross-day tasks, we need to check both the start day and end day
          // For regular tasks, check if this day is in recurrence days
          if (!isCrossDay && !days.includes(dow)) continue
          
          // Determine which date to check for overdue status
          let checkDateKey = dateKey
          let checkEndTime = endT
          let checkStartTime = startT
          let checkDayOfWeek = dow
          
          if (isCrossDay) {
            // For cross-day tasks, we need to check both the start day and end day
            // Calculate previous day for end day check
            const prevDate = new Date(checkDate)
            prevDate.setDate(checkDate.getDate() - 1)
            const prevDateKey = fmtLocal(prevDate)
            const prevDow = prevDate.getDay()
            
            let shouldProcess = false
            
            // Check if this is the end day (task ends here, started yesterday)
            if (days.includes(prevDow)) {
              // This is the end day - task started yesterday and ends today
              checkDateKey = dateKey
              checkEndTime = endT
              checkStartTime = '00:00' // End day portion starts at 00:00
              checkDayOfWeek = dow
              shouldProcess = true
            }
            
            // Check if this is the start day (task starts today, ends tomorrow)
            if (days.includes(dow)) {
              // This is the start day - check if the end time (on next day) has passed
              const nextDate = new Date(checkDate)
              nextDate.setDate(checkDate.getDate() + 1)
              const nextDateKey = fmtLocal(nextDate)
              const nextDateOverdue = shouldSkipPastTaskInstance(nextDateKey, endT, todayDateStr, localTimeStr)
              
              if (nextDateOverdue) {
                // The end time on the next day has passed, so this start day instance is overdue
                checkDateKey = dateKey
                checkEndTime = '23:59' // Start day portion ends at 23:59
                checkStartTime = startT
                checkDayOfWeek = dow
                shouldProcess = true
              }
            }
            
            if (!shouldProcess) {
              // Not a recurrence day for this cross-day task or not overdue
              continue
            }
          }
          
          // Check if this instance is overdue
          const isOverdue = shouldSkipPastTaskInstance(checkDateKey, checkEndTime, todayDateStr, localTimeStr)
          if (!isOverdue) continue
          
          // For cross-day tasks, use the check date and times we determined
          // For regular tasks, use the original date and times
          const scheduleDateKey = checkDateKey
          const scheduleStartTime = checkStartTime
          const scheduleEndTime = isCrossDay && checkEndTime === '23:59' ? '23:59' : checkEndTime
          
          // Check if schedule entry already exists for this task/date/time
          const { data: existingSchedule } = await supabase
            .from('task_schedule')
            .select('id, status')
            .eq('task_id', t.id)
            .eq('date', scheduleDateKey)
            .eq('start_time', scheduleStartTime)
            .eq('end_time', scheduleEndTime)
            .eq('user_id', userId)
            .eq('plan_id', t.plan_id)
            .maybeSingle()
          
          if (existingSchedule) {
            // Schedule entry exists, check if it's already in our overdue list
            const alreadyIncluded = overdueTasks.some(ot => ot.schedule_id === existingSchedule.id)
            if (!alreadyIncluded && ['scheduled', 'overdue', 'rescheduling'].includes(existingSchedule.status)) {
              // Check completion for this existing schedule (use schedule date key)
              const completionKey = `${t.id}-${scheduleDateKey}-${t.plan_id || 'null'}`
              let completionQuery = supabase
                .from('task_completions')
                .select('id')
                .eq('task_id', t.id)
                .eq('scheduled_date', scheduleDateKey)
                .eq('user_id', userId)
              
              if (t.plan_id === null) {
                completionQuery = completionQuery.is('plan_id', null)
              } else {
                completionQuery = completionQuery.eq('plan_id', t.plan_id)
              }
              
              const { data: completionData } = await completionQuery
              const isCompleted = !!completionData?.[0]
              
              if (!isCompleted) {
                // Add to overdue list (use schedule date and times)
                recurringOverdueTasks.push({
                  task_id: t.id,
                  schedule_id: existingSchedule.id,
                  task_name: t.name,
                  scheduled_date: scheduleDateKey,
                  start_time: scheduleStartTime,
                  end_time: scheduleEndTime,
                  duration_minutes: calculateDuration(scheduleStartTime, scheduleEndTime),
                  priority: t.priority,
                  complexity_score: null,
                  status: existingSchedule.status === 'overdue' ? 'overdue' : 'scheduled'
                })
              }
            }
            continue
          }
          
          // Check if this instance is completed (use the schedule date key for completion check)
          const completionKey = `${t.id}-${scheduleDateKey}-${t.plan_id || 'null'}`
          let completionQuery = supabase
            .from('task_completions')
            .select('id')
            .eq('task_id', t.id)
            .eq('scheduled_date', scheduleDateKey)
            .eq('user_id', userId)
          
          if (t.plan_id === null) {
            completionQuery = completionQuery.is('plan_id', null)
          } else {
            completionQuery = completionQuery.eq('plan_id', t.plan_id)
          }
          
          const { data: completionData } = await completionQuery
          const isCompleted = !!completionData?.[0]
          
          // Only create schedule entry if not completed
          if (!isCompleted) {
            // Create schedule entry for this overdue recurring task instance
            const duration = calculateDuration(scheduleStartTime, scheduleEndTime)
            const { data: newSchedule, error: insertError } = await supabase
              .from('task_schedule')
              .insert({
                user_id: userId,
                task_id: t.id,
                plan_id: t.plan_id,
                date: scheduleDateKey,
                start_time: scheduleStartTime,
                end_time: scheduleEndTime,
                duration_minutes: duration,
                day_index: 0,
                status: 'overdue'
              })
              .select('id')
              .single()
            
            if (insertError) {
              console.error(`[detectOverdueTasks] Error creating schedule entry for recurring task ${t.id} on ${scheduleDateKey}:`, insertError)
              continue
            }
            
            console.log(`[detectOverdueTasks] Created schedule entry for overdue recurring task: ${t.name} on ${scheduleDateKey}${isCrossDay ? ' (cross-day)' : ''}`)
            
            // Add to overdue tasks list
            recurringOverdueTasks.push({
              task_id: t.id,
              schedule_id: newSchedule.id,
              task_name: t.name,
              scheduled_date: scheduleDateKey,
              start_time: scheduleStartTime,
              end_time: scheduleEndTime,
              duration_minutes: duration,
              priority: t.priority,
              complexity_score: null,
              status: 'overdue'
            })
          }
        }
      }
      
      if (recurringOverdueTasks.length > 0) {
        console.log(`[detectOverdueTasks] Found ${recurringOverdueTasks.length} overdue recurring task instance(s)`)
        overdueTasks.push(...recurringOverdueTasks)
      }
    }
    
    console.log('[detectOverdueTasks] Final result:', {
      total: overdueTasks.length,
      tasks: overdueTasks.map((t: any) => ({
        name: t.task_name,
        date: t.scheduled_date,
        end_time: t.end_time,
        status: t.status
      }))
    })
    
    return overdueTasks
  } catch (error) {
    console.error('Error in detectOverdueTasks:', error)
    return []
  }
}

/**
 * Get user workday settings from user_settings
 */
async function getUserWorkdaySettings(supabase: SupabaseClient, userId: string): Promise<UserWorkdaySettings> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', userId)
      .single()

    if (error) throw error

    const prefs = data?.preferences || {}
    const workdayPrefs = prefs.workday || {}
    const autoReschedule = prefs.auto_reschedule || {}

    return {
      workdayStartHour: workdayPrefs.workday_start_hour ?? prefs.workday_start_hour ?? 9,
      workdayStartMinute: workdayPrefs.workday_start_minute ?? prefs.workday_start_minute ?? 0,
      workdayEndHour: workdayPrefs.workday_end_hour ?? prefs.workday_end_hour ?? 17,
      lunchStartHour: workdayPrefs.lunch_start_hour ?? prefs.lunch_start_hour ?? 12,
      lunchEndHour: workdayPrefs.lunch_end_hour ?? prefs.lunch_end_hour ?? 13,
      bufferMinutes: autoReschedule.buffer_minutes || 15,
      prioritySpacing: autoReschedule.priority_spacing || 'moderate',
      rescheduleWindowDays: autoReschedule.reschedule_window_days || 3
    }
  } catch (error) {
    console.error('Error fetching user settings, using defaults:', error)
    return {
      workdayStartHour: 9,
      workdayStartMinute: 0,
      workdayEndHour: 17,
      lunchStartHour: 12,
      lunchEndHour: 13,
      bufferMinutes: 15,
      prioritySpacing: 'moderate',
      rescheduleWindowDays: 3
    }
  }
}

/**
 * Get all scheduled tasks for a date range (to calculate slot availability and priority distribution)
 */
async function getScheduledTasksForDateRange(
  supabase: SupabaseClient,
  planId: string | null,
  startDate: string,
  endDate: string,
  userId: string
): Promise<Array<{
  task_id: string
  date: string
  start_time: string | null
  end_time: string | null
  priority: number | null
  duration_minutes: number | null
}>> {
  try {
    let query = supabase
      .from('task_schedule')
      .select(`
        task_id,
        date,
        start_time,
        end_time,
        duration_minutes,
        tasks!inner(priority, user_id)
      `)
      .eq('tasks.user_id', userId) // Filter by user
      .gte('date', startDate)
      .lte('date', endDate)
      .not('start_time', 'is', null)
      .not('end_time', 'is', null)

    // Handle plan-based vs free-mode
    if (planId) {
      query = query.eq('plan_id', planId)
    } else {
      query = query.is('plan_id', null)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map((item: any) => ({
      task_id: item.task_id,
      date: item.date,
      start_time: item.start_time,
      end_time: item.end_time,
      priority: item.tasks?.priority || null,
      duration_minutes: item.duration_minutes
    }))
  } catch (error) {
    console.error('Error fetching scheduled tasks:', error)
    return []
  }
}

/**
 * Calculate time in minutes from midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Format minutes to HH:MM string
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2
}

/**
 * Calculate priority penalty based on nearby tasks
 */
function calculatePriorityPenalty(
  slotStart: number,
  slotEnd: number,
  taskPriority: number,
  scheduledTasks: Array<{ start_time: string | null; end_time: string | null; priority: number | null }>,
  prioritySpacing: 'strict' | 'moderate' | 'loose',
  bufferMinutes: number
): number {
  // Window size based on spacing preference (in hours)
  const windowHours = prioritySpacing === 'strict' ? 2 : prioritySpacing === 'moderate' ? 1.5 : 1
  const windowMinutes = windowHours * 60

  let penalty = 0

  for (const task of scheduledTasks) {
    if (!task.start_time || !task.end_time || !task.priority) continue

    const taskStart = timeToMinutes(task.start_time)
    const taskEnd = timeToMinutes(task.end_time)
    
    // Check if task is within window
    const slotCenter = (slotStart + slotEnd) / 2
    const taskCenter = (taskStart + taskEnd) / 2
    const distance = Math.abs(slotCenter - taskCenter)

    if (distance <= windowMinutes) {
      // Penalty based on priority relationship
      if (task.priority <= taskPriority) {
        // Same or higher priority - stronger penalty
        const penaltyWeight = prioritySpacing === 'strict' ? 1.0 : prioritySpacing === 'moderate' ? 0.7 : 0.5
        const proximityFactor = 1 - (distance / windowMinutes)
        penalty += penaltyWeight * proximityFactor * 10
      } else {
        // Lower priority - lighter penalty
        const proximityFactor = 1 - (distance / windowMinutes)
        penalty += 0.3 * proximityFactor * 5
      }
    }
  }

  return penalty
}

/**
 * Calculate task density penalty (too many tasks clustered together)
 */
function calculateDensityPenalty(
  slotStart: number,
  slotEnd: number,
  scheduledTasks: Array<{ start_time: string | null; end_time: string | null }>,
  bufferMinutes: number
): number {
  const windowSize = 120 // 2 hours window
  const slotCenter = (slotStart + slotEnd) / 2

  let taskCount = 0

  for (const task of scheduledTasks) {
    if (!task.start_time || !task.end_time) continue

    const taskStart = timeToMinutes(task.start_time)
    const taskEnd = timeToMinutes(task.end_time)
    const taskCenter = (taskStart + taskEnd) / 2

    if (Math.abs(slotCenter - taskCenter) <= windowSize) {
      taskCount++
    }
  }

  // Penalty increases with task density
  return Math.min(taskCount * 2, 20)
}

/**
 * Calculate context fit bonus (time of day preferences, complexity matching)
 */
function calculateContextFit(
  slotStart: number,
  slotEnd: number,
  taskPriority: number,
  complexityScore: number | null,
  workdayStartHour: number,
  workdayEndHour: number,
  lunchStartHour: number,
  lunchEndHour: number
): number {
  let bonus = 0
  const slotCenter = (slotStart + slotEnd) / 2
  const slotHour = Math.floor(slotCenter / 60)

  // Morning preference for high-priority tasks
  if (taskPriority === 1 && slotHour < 12) {
    bonus += 5
  }

  // Afternoon preference for lower-priority tasks
  if (taskPriority >= 3 && slotHour >= 14) {
    bonus += 3
  }

  // Avoid lunch hours
  if (slotHour >= lunchStartHour && slotHour < lunchEndHour) {
    bonus -= 3
  }

  // High complexity tasks prefer morning (fresh energy)
  if (complexityScore && complexityScore >= 7 && slotHour < 12) {
    bonus += 2
  }

  return bonus
}

/**
 * Find intelligent reschedule slot for a task
 * @param planId - Plan ID or null for free-mode tasks
 */
export async function findIntelligentRescheduleSlot(
  supabase: SupabaseClient,
  task: OverdueTask,
  planId: string | null,
  userId: string,
  planEndDate: string,
  maxDays: number = 3
): Promise<RescheduleSlot | null> {
  const settings = await getUserWorkdaySettings(supabase, userId)
  const taskDuration = task.duration_minutes || 60
  const taskPriority = task.priority || 3

  // Calculate date range to search
  const today = new Date()
  const endDateObj = parseDateFromDB(planEndDate)
  const maxDate = new Date(Math.min(
    addDays(today, maxDays).getTime(),
    endDateObj.getTime()
  ))

  const scheduledTasks = await getScheduledTasksForDateRange(
    supabase,
    planId,
    formatDateForDB(today),
    formatDateForDB(maxDate),
    userId
  )

  const candidateSlots: RescheduleSlot[] = []

  // Generate candidate slots for each day
  const currentDate = new Date(today)
  while (currentDate <= maxDate) {
    const dateStr = formatDateForDB(currentDate)
    const isToday = isSameDay(currentDate, today)
    const currentTimeMinutes = isToday ? (today.getHours() * 60 + today.getMinutes()) : -1

    // Calculate available time windows (accounting for lunch)
    const workdayStart = settings.workdayStartHour * 60 + settings.workdayStartMinute
    const workdayEnd = settings.workdayEndHour * 60
    const lunchStart = settings.lunchStartHour * 60
    const lunchEnd = settings.lunchEndHour * 60

    // Get tasks scheduled for this date
    const dayTasks = scheduledTasks.filter(t => t.date === dateStr)

    // Generate slots with 15-minute granularity
    for (let slotStart = workdayStart; slotStart + taskDuration <= workdayEnd; slotStart += 15) {
      // Skip if in the past (only for today)
      if (isToday && slotStart < currentTimeMinutes) continue

      const slotEnd = slotStart + taskDuration

      // Skip if overlaps with lunch
      if (timeRangesOverlap(slotStart, slotEnd, lunchStart, lunchEnd)) continue

      // Check for overlaps with existing tasks
      let hasOverlap = false
      for (const dayTask of dayTasks) {
        if (!dayTask.start_time || !dayTask.end_time) continue
        const taskStart = timeToMinutes(dayTask.start_time)
        const taskEnd = timeToMinutes(dayTask.end_time)

        if (timeRangesOverlap(slotStart, slotEnd, taskStart, taskEnd)) {
          hasOverlap = true
          break
        }
      }

      if (hasOverlap) continue

      // Calculate scores
      const baseScore = 100 // Base availability score
      const priorityPenalty = calculatePriorityPenalty(
        slotStart,
        slotEnd,
        taskPriority,
        dayTasks,
        settings.prioritySpacing,
        settings.bufferMinutes
      )
      const densityPenalty = calculateDensityPenalty(
        slotStart,
        slotEnd,
        dayTasks,
        settings.bufferMinutes
      )
      const contextScore = calculateContextFit(
        slotStart,
        slotEnd,
        taskPriority,
        task.complexity_score,
        settings.workdayStartHour,
        settings.workdayEndHour,
        settings.lunchStartHour,
        settings.lunchEndHour
      )

      const finalScore = baseScore - (priorityPenalty * 0.3) - (densityPenalty * 0.2) + (contextScore * 0.1)

      candidateSlots.push({
        date: dateStr,
        start_time: minutesToTime(slotStart),
        end_time: minutesToTime(slotEnd),
        day_index: Math.ceil((currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        score: finalScore,
        context_score: contextScore,
        priority_penalty: priorityPenalty,
        density_penalty: densityPenalty
      })
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  // If no slots found and we're within window, extend plan and try again
  if (candidateSlots.length === 0 && maxDate < endDateObj) {
    // This will be handled by the calling function
    return null
  }

  // Return best scoring slot
  if (candidateSlots.length === 0) return null

  candidateSlots.sort((a, b) => b.score - a.score)
  return candidateSlots[0]
}

/**
 * Create a reschedule proposal (pending user approval)
 */
export async function createRescheduleProposal(
  supabase: SupabaseClient,
  task: OverdueTask,
  newSlot: RescheduleSlot,
  userId: string,
  planId: string | null
): Promise<{ proposalId: string; success: boolean }> {
  try {
    // Check if proposal already exists for this task_schedule_id
    const { data: existingProposal } = await supabase
      .from('pending_reschedules')
      .select('id')
      .eq('task_schedule_id', task.schedule_id)
      .eq('status', 'pending')
      .single()

    if (existingProposal) {
      console.log(`Proposal already exists for task ${task.task_id}, skipping`)
      return { proposalId: existingProposal.id, success: true }
    }

    // Create proposal in pending_reschedules table
    const { data: proposal, error: insertError } = await supabase
      .from('pending_reschedules')
      .insert({
        plan_id: planId, // Can be null for free-mode tasks
        user_id: userId,
        task_schedule_id: task.schedule_id,
        task_id: task.task_id,
        proposed_date: newSlot.date,
        proposed_start_time: newSlot.start_time,
        proposed_end_time: newSlot.end_time,
        proposed_day_index: newSlot.day_index,
        original_date: task.scheduled_date,
        original_start_time: task.start_time,
        original_end_time: task.end_time,
        original_day_index: 0, // We'll get actual day_index from task_schedule
        context_score: newSlot.context_score,
        priority_penalty: newSlot.priority_penalty,
        density_penalty: newSlot.density_penalty,
        reason: 'auto_reschedule_overdue',
        status: 'pending'
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    // Get actual day_index from task_schedule
    const { data: scheduleData } = await supabase
      .from('task_schedule')
      .select('day_index')
      .eq('id', task.schedule_id)
      .single()

    // Update proposal with correct original_day_index
    if (scheduleData) {
      await supabase
        .from('pending_reschedules')
        .update({ original_day_index: scheduleData.day_index })
        .eq('id', proposal.id)
    }

    // Update task_schedule to link to proposal and set status
    const { error: updateError } = await supabase
      .from('task_schedule')
      .update({
        status: 'pending_reschedule',
        pending_reschedule_id: proposal.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', task.schedule_id)

    if (updateError) throw updateError

    return { proposalId: proposal.id, success: true }
  } catch (error) {
    console.error('Error creating reschedule proposal:', error)
    throw error
  }
}

/**
 * Apply an accepted reschedule proposal
 */
export async function applyRescheduleProposal(
  supabase: SupabaseClient,
  proposalId: string,
  userId: string
): Promise<{ success: boolean }> {
  try {
    // Get proposal details
    const { data: proposal, error: proposalError } = await supabase
      .from('pending_reschedules')
      .select('*')
      .eq('id', proposalId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single()

    if (proposalError || !proposal) {
      throw new Error('Proposal not found or already processed')
    }

    // Get current reschedule_count from task_schedule
    const { data: scheduleData } = await supabase
      .from('task_schedule')
      .select('reschedule_count')
      .eq('id', proposal.task_schedule_id)
      .single()

    const rescheduleCount = (scheduleData?.reschedule_count || 0) + 1

    // Apply proposal to task_schedule
    const { error: updateError } = await supabase
      .from('task_schedule')
      .update({
        date: proposal.proposed_date,
        start_time: proposal.proposed_start_time,
        end_time: proposal.proposed_end_time,
        day_index: proposal.proposed_day_index,
        status: 'rescheduled',
        reschedule_count: rescheduleCount,
        last_rescheduled_at: new Date().toISOString(),
        pending_reschedule_id: null, // Clear the link
        reschedule_reason: {
          old_date: proposal.original_date,
          old_start_time: proposal.original_start_time,
          old_end_time: proposal.original_end_time,
          reason: proposal.reason,
          context_score: proposal.context_score,
          priority_penalty: proposal.priority_penalty,
          density_penalty: proposal.density_penalty,
          rescheduled_at: new Date().toISOString(),
          from_proposal: true
        },
        rescheduled_from: proposal.original_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', proposal.task_schedule_id)

    if (updateError) throw updateError

    // Mark proposal as accepted
    const { error: acceptError } = await supabase
      .from('pending_reschedules')
      .update({
        status: 'accepted',
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: userId
      })
      .eq('id', proposalId)

    if (acceptError) throw acceptError

    // Record in scheduling_history
    const taskAdjustment = {
      task_id: proposal.task_id,
      old_date: proposal.original_date,
      old_start_time: proposal.original_start_time,
      old_end_time: proposal.original_end_time,
      new_date: proposal.proposed_date,
      new_start_time: proposal.proposed_start_time,
      new_end_time: proposal.proposed_end_time,
      context_score: proposal.context_score,
      from_proposal: true
    }

    // Check if there's already a history entry for today
    const { data: existingHistory } = await supabase
      .from('scheduling_history')
      .select('id, task_adjustments')
      .eq('plan_id', proposal.plan_id)
      .eq('user_id', userId)
      .eq('adjustment_date', formatDateForDB(new Date()))
      .single()

    if (existingHistory) {
      const adjustments = Array.isArray(existingHistory.task_adjustments)
        ? [...existingHistory.task_adjustments, taskAdjustment]
        : [taskAdjustment]

      await supabase
        .from('scheduling_history')
        .update({
          tasks_rescheduled: adjustments.length,
          task_adjustments: adjustments
        })
        .eq('id', existingHistory.id)
    } else {
      const { data: plan } = await supabase
        .from('plans')
        .select('end_date')
        .eq('id', proposal.plan_id)
        .single()

      await supabase
        .from('scheduling_history')
        .insert({
          plan_id: proposal.plan_id,
          user_id: userId,
          adjustment_date: formatDateForDB(new Date()),
          old_end_date: plan?.end_date || null,
          new_end_date: plan?.end_date || null,
          days_extended: 0,
          tasks_rescheduled: 1,
          task_adjustments: [taskAdjustment],
          reason: {
            trigger: 'user_approved_reschedule',
            message: `User approved reschedule proposal for task`
          }
        })
    }

    return { success: true }
  } catch (error) {
    console.error('Error applying reschedule proposal:', error)
    throw error
  }
}

/**
 * Reject a reschedule proposal
 */
export async function rejectRescheduleProposal(
  supabase: SupabaseClient,
  proposalId: string,
  userId: string
): Promise<{ success: boolean }> {
  try {
    // Get proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('pending_reschedules')
      .select('task_schedule_id')
      .eq('id', proposalId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single()

    if (proposalError || !proposal) {
      throw new Error('Proposal not found or already processed')
    }

    // Mark proposal as rejected
    const { error: rejectError } = await supabase
      .from('pending_reschedules')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: userId
      })
      .eq('id', proposalId)

    if (rejectError) throw rejectError

    // Reset task_schedule status to 'overdue' and clear proposal link
    const { error: updateError } = await supabase
      .from('task_schedule')
      .update({
        status: 'overdue',
        pending_reschedule_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', proposal.task_schedule_id)

    if (updateError) throw updateError

    return { success: true }
  } catch (error) {
    console.error('Error rejecting reschedule proposal:', error)
    throw error
  }
}

/**
 * Reschedule a single overdue task (DEPRECATED - use createRescheduleProposal instead)
 * @deprecated Use createRescheduleProposal for user-approval workflow
 */
export async function rescheduleTask(
  supabase: SupabaseClient,
  task: OverdueTask,
  newSlot: RescheduleSlot,
  userId: string,
  planId: string
): Promise<RescheduleResult> {
  // Legacy function kept for backward compatibility
  // Now redirects to proposal creation
  try {
    const result = await createRescheduleProposal(supabase, task, newSlot, userId, planId)
    
    return {
      success: result.success,
      taskId: task.task_id,
      taskName: task.task_name,
      oldDate: task.scheduled_date,
      oldStartTime: task.start_time,
      oldEndTime: task.end_time,
      newDate: newSlot.date,
      newStartTime: newSlot.start_time,
      newEndTime: newSlot.end_time,
      reason: 'Task passed scheduled end_time without completion',
      contextScore: newSlot.context_score
    }
  } catch (error) {
    console.error('Error rescheduling task:', error)
    throw error
  }
}

/**
 * Get pending reschedule proposals for a user/plan
 * @param planId - Plan ID or null for free-mode tasks
 */
export async function getPendingReschedules(
  supabase: SupabaseClient,
  userId: string,
  planId: string | null
): Promise<any[]> {
  try {
    let query = supabase
      .from('pending_reschedules')
      .select(`
        *,
        tasks!inner (
          id,
          name,
          priority,
          estimated_duration_minutes
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    // Handle plan-based vs free-mode
    if (planId) {
      query = query.eq('plan_id', planId)
    } else {
      query = query.is('plan_id', null)
    }

    const { data, error } = await query

    if (error) throw error

    const proposals = (data || []).map((proposal: any) => ({
      ...proposal,
      task_name: proposal.tasks?.name,
      task_priority: proposal.tasks?.priority,
      task_duration_minutes: proposal.tasks?.estimated_duration_minutes
    }))

    // Filter out proposals for tasks that are already completed
    // Batch query task_completions for all proposals to check completions efficiently
    if (proposals.length === 0) {
      return []
    }

    // Build completion check queries for all proposals
    // We need to check each proposal's task_id, original_date, and plan_id combination
    const completionChecks = await Promise.all(
      proposals.map(async (proposal: any) => {
        let completionQuery = supabase
          .from('task_completions')
          .select('id')
          .eq('user_id', userId)
          .eq('task_id', proposal.task_id)
          .eq('scheduled_date', proposal.original_date)
        
        // Handle plan_id matching (both NULL for free-mode, or both equal)
        if (proposal.plan_id === null) {
          completionQuery = completionQuery.is('plan_id', null)
        } else {
          completionQuery = completionQuery.eq('plan_id', proposal.plan_id)
        }
        
        const { data: completion, error: completionError } = await completionQuery.maybeSingle()
        
        return {
          proposal,
          hasCompletion: !!completion && !completionError,
          error: completionError
        }
      })
    )

    // Filter out proposals that have matching completion records
    const filteredProposals = completionChecks
      .filter(check => {
        if (check.error) {
          console.error('Error checking completion for proposal:', check.proposal.id, check.error)
          // Include the proposal if we can't check (fail open)
          return true
        }
        // Exclude if completion found, include if no completion
        if (check.hasCompletion) {
          console.log(`Filtering out completed task proposal: ${check.proposal.id} (task_id: ${check.proposal.task_id}, original_date: ${check.proposal.original_date})`)
          return false
        }
        return true
      })
      .map(check => check.proposal)

    return filteredProposals
  } catch (error) {
    console.error('Error fetching pending reschedules:', error)
    return []
  }
}

/**
 * Process all overdue tasks for a plan or free-mode (creates proposals, does not apply)
 * @param planId - Plan ID or null for free-mode tasks
 */
export async function rescheduleOverdueTasks(
  supabase: SupabaseClient,
  planId: string | null,
  userId: string
): Promise<RescheduleResult[]> {
  try {
    // Check if auto-reschedule is enabled
    const { data: enabled, error: checkError } = await supabase.rpc('is_auto_reschedule_enabled', {
      p_user_id: userId
    })

    if (checkError || !enabled) {
      console.log('Auto-reschedule is disabled for user')
      return []
    }

    // Detect overdue tasks
    const overdueTasks = await detectOverdueTasks(supabase, planId, userId)
    
    console.log(`[Reschedule] Detected ${overdueTasks.length} overdue task(s) for ${planId || 'free-mode'}`)
    
    if (overdueTasks.length === 0) {
      console.log('[Reschedule] No overdue tasks found')
      return []
    }

    // Get plan end date (or use future date for free-mode tasks)
    let planEndDate: string
    if (planId) {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('end_date')
        .eq('id', planId)
        .single()

      if (planError || !plan) {
        throw new Error('Plan not found')
      }
      planEndDate = plan.end_date
    } else {
      // For free-mode tasks, use 7 days from today as the window
      const futureDate = addDays(new Date(), 7)
      planEndDate = formatDateForDB(futureDate)
    }

    const results: RescheduleResult[] = []
    const settings = await getUserWorkdaySettings(supabase, userId)

    for (const task of overdueTasks) {
      try {
        // Mark as overdue if not already marked
        if (task.status !== 'overdue' && task.status !== 'rescheduling' && task.status !== 'pending_reschedule') {
          await supabase
            .from('task_schedule')
            .update({ status: 'overdue' })
            .eq('id', task.schedule_id)
        }
        
        // Skip if already has a pending proposal
        if (task.status === 'pending_reschedule') {
          console.log(`Task ${task.task_id} already has pending proposal, skipping`)
          continue
        }
        
        // Check if there's already a pending proposal for this schedule
        const { data: existingProposal } = await supabase
          .from('pending_reschedules')
          .select('id')
          .eq('task_schedule_id', task.schedule_id)
          .eq('status', 'pending')
          .single()
        
        if (existingProposal) {
          console.log(`Task ${task.task_id} already has pending proposal (ID: ${existingProposal.id}), skipping`)
          // Update status to pending_reschedule if not already
          if (task.status !== 'pending_reschedule') {
            await supabase
              .from('task_schedule')
              .update({ status: 'pending_reschedule', pending_reschedule_id: existingProposal.id })
              .eq('id', task.schedule_id)
          }
          continue
        }
        
        // Mark as rescheduling only if not already rescheduling
        if (task.status !== 'rescheduling') {
          await supabase
            .from('task_schedule')
            .update({ status: 'rescheduling' })
            .eq('id', task.schedule_id)
        }

        // Find best slot
        let slot = await findIntelligentRescheduleSlot(
          supabase,
          task,
          planId || null,
          userId,
          planEndDate,
          settings.rescheduleWindowDays
        )

        // For free-mode tasks, if no slot found, just use tomorrow
        if (!slot && !planId) {
          const tomorrow = addDays(new Date(), 1)
          const tomorrowStr = formatDateForDB(tomorrow)
          // Create a simple slot for tomorrow at workday start
          slot = {
            date: tomorrowStr,
            start_time: `${settings.workdayStartHour.toString().padStart(2, '0')}:${settings.workdayStartMinute.toString().padStart(2, '0')}`,
            end_time: minutesToTime((settings.workdayStartHour * 60 + settings.workdayStartMinute) + (task.duration_minutes || 60)),
            day_index: 1,
            score: 50,
            context_score: 0,
            priority_penalty: 0,
            density_penalty: 0
          }
        }

        // If no slot found and we have a plan, extend plan and try again
        if (!slot && planId) {
          const newEndDate = addDays(parseDateFromDB(planEndDate), 1)
          await supabase
            .from('plans')
            .update({ end_date: formatDateForDB(newEndDate) })
            .eq('id', planId)

          slot = await findIntelligentRescheduleSlot(
            supabase,
            task,
            planId,
            userId,
            formatDateForDB(newEndDate),
            1
          )
        }

        if (slot) {
          // Create proposal instead of applying directly
          console.log(`[Reschedule] Creating proposal for task ${task.task_name} (${task.task_id})`)
          const proposalResult = await createRescheduleProposal(supabase, task, slot, userId, planId || null)
          if (proposalResult.success) {
            console.log(`[Reschedule] ✅ Proposal created: ${proposalResult.proposalId}`)
            results.push({
              success: true,
              taskId: task.task_id,
              taskName: task.task_name,
              oldDate: task.scheduled_date,
              oldStartTime: task.start_time,
              oldEndTime: task.end_time,
              newDate: slot.date,
              newStartTime: slot.start_time,
              newEndTime: slot.end_time,
              reason: 'Task passed scheduled end_time without completion',
              contextScore: slot.context_score
            })
          } else {
            console.error(`[Reschedule] ❌ Failed to create proposal for task ${task.task_id}`)
          }
        } else {
          console.error(`[Reschedule] ❌ Could not find slot for task ${task.task_id}`)
        }
      } catch (error) {
        console.error(`Error rescheduling task ${task.task_id}:`, error)
        // Reset status on error
        await supabase
          .from('task_schedule')
          .update({ status: 'overdue' })
          .eq('id', task.schedule_id)
      }
    }

    return results
  } catch (error) {
    console.error('Error in rescheduleOverdueTasks:', error)
    throw error
  }
}

