import { createClient } from '@/lib/supabase/server'
import { timeBlockScheduler } from '@/lib/time-block-scheduler'
import { formatDateForDB, toLocalMidnight, applyTimeBuffer } from '@/lib/date-utils'
import { getBusySlotsForUser } from '@/lib/calendar/busy-slots'
import { getProvider } from '@/lib/calendar/providers/provider-factory'
import { getProvider as getTaskManagementProvider } from '@/lib/task-management/providers/provider-factory'
import { detectTaskDependencies } from '@/lib/goal-analysis'

/**
 * Generate time-block schedule for all tasks in a plan.
 * Persists entries into task_schedule.
 */
export async function generateTaskSchedule(planId: string, startDateInput: Date, endDateInput: Date, timezoneOffset?: number, userLocalTime?: Date, requireStartDate?: boolean, workdayStartHourOverride?: number, workdayEndHourOverride?: number, preferredDaysOfWeek?: ('weekday' | 'weekend')[]) {
  const supabase = await createClient()

  // Fetch plan (to get user_id and canonical dates)
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, user_id, start_date, end_date')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    console.error('[generateTaskSchedule] Plan not found:', planError)
    return
  }

  const userId: string = plan.user_id

  // Normalize dates to local midnight
  const startDate = toLocalMidnight(plan.start_date ?? startDateInput)
  const endDate = toLocalMidnight(plan.end_date ?? endDateInput)

  // Fetch tasks for this plan
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, idx, name, estimated_duration_minutes, priority')
    .eq('plan_id', planId)
    .order('idx', { ascending: true })

  if (tasksError || !tasks || tasks.length === 0) {
    console.warn('[generateTaskSchedule] No tasks to schedule for plan:', planId, tasksError)
    return
  }

  // Fetch user scheduling preferences
  const { data: settings } = await supabase
    .from('user_settings')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()

  const prefs = (settings?.preferences as any) ?? {}
  const workdayPrefs = prefs.workday || {}

  // Use overrides if provided (e.g., for evening availability), otherwise use user settings
  const workdayStartHour = workdayStartHourOverride ?? Number(workdayPrefs.workday_start_hour ?? prefs.workday_start_hour ?? 9)
  const workdayStartMinute = Number(workdayPrefs.workday_start_minute ?? prefs.workday_start_minute ?? 0)
  const workdayEndHour = workdayEndHourOverride ?? Number(workdayPrefs.workday_end_hour ?? prefs.workday_end_hour ?? 17)
  const lunchStartHour = Number(workdayPrefs.lunch_start_hour ?? prefs.lunch_start_hour ?? 12)
  const lunchEndHour = Number(workdayPrefs.lunch_end_hour ?? prefs.lunch_end_hour ?? 13)
  const allowWeekends = Boolean(workdayPrefs.allow_weekends ?? prefs.allow_weekends ?? false)
  
  // Get user timezone (default to UTC if not set)
  // TODO: Add timezone to user_settings preferences
  const userTimezone = prefs.timezone || process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'UTC'

  // Remove any existing schedule for this plan (full-regeneration)
  const { error: deleteError } = await supabase
    .from('task_schedule')
    .delete()
    .eq('plan_id', planId)

  if (deleteError) {
    console.error('[generateTaskSchedule] Failed clearing previous schedule:', deleteError)
    // Continue; we'll try to insert new entries anyway
  }

  // Determine weekend handling:
  const singleDay = startDate.getTime() === endDate.getTime()
  const startIsWeekend = [0, 6].includes(startDate.getDay())
  // If it's a single-day plan or the start date is a weekend, allow weekends to avoid zero capacity
  const effectiveAllowWeekends = allowWeekends || singleDay || startIsWeekend

  // Determine if we should force using the start date
  // Force start date if:
  // 1. Start date is today and user requested "today" (handled by caller passing forceStartDate)
  // 2. Start date is a weekend and it's a single-day plan
  const forceStartDate = singleDay && startIsWeekend

  // Get current time to avoid scheduling tasks in the past
  // Use passed userLocalTime if provided (timezone-adjusted), otherwise use server time
  let currentTime: Date
  if (userLocalTime) {
    // Use the timezone-adjusted Date directly - it represents user's local time
    // Extract components using UTC methods since it's timezone-adjusted
    const userLocalYear = userLocalTime.getUTCFullYear()
    const userLocalMonth = userLocalTime.getUTCMonth()
    const userLocalDate = userLocalTime.getUTCDate()
    const userLocalHour = userLocalTime.getUTCHours()
    const userLocalMinute = userLocalTime.getUTCMinutes()
    // Create Date using UTC constructor to preserve the timezone-adjusted representation
    currentTime = new Date(Date.UTC(userLocalYear, userLocalMonth, userLocalDate, userLocalHour, userLocalMinute, 0, 0))
  } else if (timezoneOffset !== undefined && timezoneOffset !== 0) {
    // Fallback: calculate userLocalTime if not provided
    const now = new Date()
    const userLocalTimeMs = now.getTime() - (timezoneOffset * 60 * 1000)
    const calculatedUserLocalTime = new Date(userLocalTimeMs)
    const userLocalYear = calculatedUserLocalTime.getUTCFullYear()
    const userLocalMonth = calculatedUserLocalTime.getUTCMonth()
    const userLocalDate = calculatedUserLocalTime.getUTCDate()
    const userLocalHour = calculatedUserLocalTime.getUTCHours()
    const userLocalMinute = calculatedUserLocalTime.getUTCMinutes()
    currentTime = new Date(Date.UTC(userLocalYear, userLocalMonth, userLocalDate, userLocalHour, userLocalMinute, 0, 0))
  } else {
    // No timezone offset - use server's local time
  const now = new Date()
    currentTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0)
  }
  
  // Apply time buffer to current time
  const bufferedCurrentTime = applyTimeBuffer(currentTime)
  console.log('⏰ Time buffer applied:', {
    original: currentTime.toISOString(),
    originalHour: currentTime.getUTCHours(),
    originalMinute: currentTime.getUTCMinutes(),
    buffered: bufferedCurrentTime.toISOString(),
    bufferedHour: bufferedCurrentTime.getUTCHours(),
    bufferedMinute: bufferedCurrentTime.getUTCMinutes(),
    timezoneOffset: timezoneOffset,
    isTimezoneAdjusted: !!userLocalTime
  })
  
  // Use buffered time for scheduling
  currentTime = bufferedCurrentTime
  
  // Detect task dependencies
  const taskDependencies = detectTaskDependencies(
    tasks.map(t => ({ name: t.name, idx: t.idx }))
  )
  console.log(`🔗 Task dependencies detected: ${taskDependencies.size} task(s) have dependencies`)

  // Fetch existing task schedules from task_schedule table (excluding current plan)
  let existingTaskSchedules: Array<{ date: string; start_time: string; end_time: string }> = []
  try {
    const { data: taskSchedules, error: taskSchedulesError } = await supabase
      .from('task_schedule')
      .select('date, start_time, end_time')
      .eq('user_id', userId)
      .neq('plan_id', planId) // Exclude current plan being generated
      .gte('date', formatDateForDB(startDate))
      .lte('date', formatDateForDB(endDate))
      .not('start_time', 'is', null)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (taskSchedulesError) {
      console.error('[generateTaskSchedule] Failed to fetch existing task schedules', taskSchedulesError)
    } else if (taskSchedules && taskSchedules.length > 0) {
      existingTaskSchedules = taskSchedules.map(schedule => ({
        date: schedule.date,
        start_time: schedule.start_time || '',
        end_time: schedule.end_time || '',
      }))
      console.log(`[generateTaskSchedule] Found ${existingTaskSchedules.length} existing task schedules`)
    }
  } catch (error) {
    console.error('[generateTaskSchedule] Error fetching existing task schedules', error)
    // Continue without existing task schedules if fetch fails
  }

  // Fetch busy slots from all calendar providers (provider-agnostic)
  let calendarBusySlots: Array<{ date: string; start_time: string; end_time: string }> = []
  try {
    const busySlots = await getBusySlotsForUser(userId, startDate, endDate)
    // Convert busy slots to existing schedules format
    calendarBusySlots = busySlots.map(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return {
        date: formatDateForDB(slotStart),
        start_time: slotStart.toTimeString().slice(0, 5), // HH:MM
        end_time: slotEnd.toTimeString().slice(0, 5), // HH:MM
      }
    })
    
    if (calendarBusySlots.length > 0) {
      console.log(`[generateTaskSchedule] Found ${calendarBusySlots.length} busy slots from calendar`)
    }
  } catch (error) {
    console.error('[generateTaskSchedule] Failed to fetch busy slots', error)
    // Continue without busy slots if fetch fails
  }

  // Combine existing task schedules with calendar busy slots
  const existingSchedules = [...existingTaskSchedules, ...calendarBusySlots]
  
  if (existingSchedules.length > 0) {
    console.log(`[generateTaskSchedule] Total existing schedules (tasks + calendar): ${existingSchedules.length}`)
  }

  // Build availability object with preferred days of week if provided
  const availability = preferredDaysOfWeek && preferredDaysOfWeek.length > 0
    ? {
        busySlots: [],
        timeOff: [],
        preferredDaysOfWeek
      }
    : undefined

  // Run scheduler
  const { placements, totalScheduledHours, unscheduledTasks } = timeBlockScheduler({
    tasks: tasks.map(t => ({
      id: t.id,
      idx: t.idx,
      name: t.name,
      estimated_duration_minutes: t.estimated_duration_minutes || 60,
      priority: t.priority || 3,
      // Map to a reasonable complexity score if missing: invert priority to complexity
      // Priority 1 (highest) -> complexity 8, 2 -> 6, 3 -> 4, 4 -> 2
      complexity_score: typeof (t as any).complexity_score === 'number'
        ? (t as any).complexity_score
        : (5 - (t.priority || 3)) * 2,
    })),
    startDate,
    endDate,
    workdayStartHour,
    workdayStartMinute,
    workdayEndHour,
    lunchStartHour,
    lunchEndHour,
    allowWeekends: effectiveAllowWeekends,
    currentTime,
    existingSchedules, // Pass busy slots to avoid conflicts
    forceStartDate, // Force using start date when appropriate
    taskDependencies, // Pass detected dependencies to enforce ordering
    requireStartDate, // If true, schedule tasks on day 0 starting from workday start, even if current time is after workday end
    availability // Pass user's preferred days of week from goal text
  })

  // Persist placements
  if (placements.length > 0) {
    const scheduleRows = placements.map(p => ({
      plan_id: planId,
      user_id: userId,
      task_id: p.task_id,
      day_index: p.day_index,
      date: formatDateForDB(toLocalMidnight(p.date)),
      start_time: p.start_time,
      end_time: p.end_time,
      duration_minutes: p.duration_minutes,
      status: 'scheduled',
    }))

    const { data: insertedSchedules, error: insertError } = await supabase
      .from('task_schedule')
      .insert(scheduleRows)
      .select('id, date, start_time, end_time, task_id')

    if (insertError) {
      console.error('[generateTaskSchedule] Failed inserting schedule:', insertError)
      return
    }
    
    // Auto-push to calendar providers if enabled (provider-agnostic)
    if (insertedSchedules && insertedSchedules.length > 0) {
      // Fetch all calendar connections with auto-push enabled
      const { data: connections } = await supabase
        .from('calendar_connections')
        .select('id, provider, auto_push_enabled, selected_calendar_ids')
        .eq('user_id', userId)
        .eq('auto_push_enabled', true)
      
      if (connections && connections.length > 0) {
        // Fetch plan details for metadata
        const { data: planDetails } = await supabase
          .from('plans')
          .select('goal_text, summary_data')
          .eq('id', planId)
          .single()
        
        const planName = planDetails?.summary_data?.goal_title || planDetails?.goal_text || null
        
        // Fetch task details
        const taskIds = [...new Set(insertedSchedules.map(s => s.task_id))]
        const { data: taskDetails } = await supabase
          .from('tasks')
          .select('id, name')
          .in('id', taskIds)
        
        const taskMap = new Map((taskDetails || []).map(t => [t.id, t]))
        
        // Push to each enabled connection
        let totalPushedCount = 0
        const pushErrors: string[] = []
        
        for (const connection of connections) {
          if (!connection.selected_calendar_ids || connection.selected_calendar_ids.length === 0) {
            continue
          }
          
          const targetCalendarId = connection.selected_calendar_ids[0] || 'primary'
          
          try {
            // Get provider instance
            const calendarProvider = getProvider(connection.provider as 'google' | 'outlook' | 'apple')
            
            // Push each schedule to the calendar
            for (const schedule of insertedSchedules) {
              const task = taskMap.get(schedule.task_id)
              if (!task || !schedule.start_time || !schedule.end_time) {
                continue
              }
              
              // Build datetime strings
              const startDateTime = `${schedule.date}T${schedule.start_time}:00`
              const endDateTime = `${schedule.date}T${schedule.end_time}:00`
              
              try {
                const result = await calendarProvider.pushTaskToCalendar(
                  connection.id,
                  targetCalendarId,
                  {
                    taskScheduleId: schedule.id,
                    taskId: task.id,
                    planId: planId,
                    taskName: task.name,
                    planName,
                    startTime: startDateTime,
                    endTime: endDateTime,
                    aiConfidence: null, // AI confidence - not available at schedule generation time
                    timezone: userTimezone,
                  }
                )
                
                if (result.success) {
                  totalPushedCount++
                } else {
                  pushErrors.push(`Task ${task.name} (${connection.provider}): ${result.error || 'Unknown error'}`)
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                pushErrors.push(`Task ${task.name} (${connection.provider}): ${errorMessage}`)
                console.warn(`[generateTaskSchedule] Failed to auto-push task ${task.name} to ${connection.provider}:`, errorMessage)
              }
            }
          } catch (providerError) {
            console.error(`[generateTaskSchedule] Failed to get provider for ${connection.provider}:`, providerError)
            pushErrors.push(`${connection.provider}: Provider error`)
          }
        }
        
        if (totalPushedCount > 0) {
          console.log(`[generateTaskSchedule] Auto-pushed ${totalPushedCount} task(s) to calendar(s)`)
        }
        
        if (pushErrors.length > 0) {
          console.warn(`[generateTaskSchedule] Auto-push errors: ${pushErrors.join('; ')}`)
        }
      }
    }

    // Auto-push to task management providers if enabled
    if (insertedSchedules && insertedSchedules.length > 0) {
      // Fetch all task management connections with auto-push enabled
      const { data: taskConnections } = await supabase
        .from('task_management_connections')
        .select('id, provider, auto_push_enabled, default_project_id')
        .eq('user_id', userId)
        .eq('auto_push_enabled', true)
      
      if (taskConnections && taskConnections.length > 0) {
        // Fetch plan details for metadata
        const { data: planDetails } = await supabase
          .from('plans')
          .select('goal_text, summary_data')
          .eq('id', planId)
          .single()
        
        const planName = planDetails?.summary_data?.goal_title || planDetails?.goal_text || null
        
        // Fetch task details
        const taskIds = [...new Set(insertedSchedules.map(s => s.task_id))]
        const { data: taskDetails } = await supabase
          .from('tasks')
          .select('id, name, details, estimated_duration_minutes, priority')
          .in('id', taskIds)
        
        const taskMap = new Map((taskDetails || []).map(t => [t.id, t]))
        
        // Push to each enabled connection
        let totalPushedCount = 0
        const pushErrors: string[] = []
        
        for (const connection of taskConnections) {
          try {
            // Get provider instance using factory
            const taskProvider = getTaskManagementProvider(connection.provider as 'todoist' | 'asana' | 'trello')
            
            // Push each schedule to the task management tool
            for (const schedule of insertedSchedules) {
              const task = taskMap.get(schedule.task_id)
              if (!task) {
                continue
              }
              
              // Calculate duration from schedule if available
              let durationMinutes = task.estimated_duration_minutes || null
              if (schedule.start_time && schedule.end_time) {
                const start = new Date(`${schedule.date}T${schedule.start_time}`)
                const end = new Date(`${schedule.date}T${schedule.end_time}`)
                durationMinutes = Math.round((end.getTime() - start.getTime()) / 1000 / 60)
              }
              
              try {
                const result = await taskProvider.pushTask(
                  connection.id,
                  {
                    taskScheduleId: schedule.id,
                    taskId: task.id,
                    planId: planId,
                    taskName: task.name,
                    taskDetails: task.details || undefined,
                    planName,
                    priority: task.priority || 3,
                    dueDate: schedule.date,
                    durationMinutes: durationMinutes || undefined,
                    projectId: connection.default_project_id || undefined,
                  }
                )
                
                if (result.success) {
                  totalPushedCount++
                  
                  // Create link record
                  const { error: linkError } = await supabase
                    .from('task_management_links')
                    .insert({
                      user_id: userId,
                      connection_id: connection.id,
                      task_id: task.id,
                      plan_id: planId,
                      task_schedule_id: schedule.id,
                      external_task_id: result.external_task_id,
                      external_project_id: connection.default_project_id || null,
                      sync_status: 'synced',
                      last_synced_at: new Date().toISOString(),
                    })
                  
                  if (linkError) {
                    console.warn(`[generateTaskSchedule] Failed to create task management link for task ${task.name}:`, linkError)
                  }
                } else {
                  pushErrors.push(`Task ${task.name} (${connection.provider}): ${result.error || 'Unknown error'}`)
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                pushErrors.push(`Task ${task.name} (${connection.provider}): ${errorMessage}`)
                console.warn(`[generateTaskSchedule] Failed to auto-push task ${task.name} to ${connection.provider}:`, errorMessage)
              }
            }
          } catch (providerError) {
            console.error(`[generateTaskSchedule] Failed to get provider for ${connection.provider}:`, providerError)
            pushErrors.push(`${connection.provider}: Provider error`)
          }
        }
        
        if (totalPushedCount > 0) {
          console.log(`[generateTaskSchedule] Auto-pushed ${totalPushedCount} task(s) to task management tool(s)`)
        }
        
        if (pushErrors.length > 0) {
          console.warn(`[generateTaskSchedule] Auto-push errors: ${pushErrors.join('; ')}`)
        }
      }
    }
  }

  console.log(`✅ Task schedule generated: ${placements.length} placement(s), ${totalScheduledHours.toFixed(2)}h scheduled, ${unscheduledTasks.length} unscheduled`)
}












