import { createClient } from '@/lib/supabase/server'
import { timeBlockScheduler } from '@/lib/time-block-scheduler'
import { formatDateForDB, toLocalMidnight } from '@/lib/date-utils'
import { getBusySlotsForUser } from '@/lib/calendar/busy-slots'
import { getProvider } from '@/lib/calendar/providers/provider-factory'

/**
 * Generate time-block schedule for all tasks in a plan.
 * Persists entries into task_schedule.
 */
export async function generateTaskSchedule(planId: string, startDateInput: Date, endDateInput: Date) {
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

  const workdayStartHour = Number(prefs.workday_start_hour ?? 9)
  const workdayStartMinute = Number(prefs.workday_start_minute ?? 0)
  const workdayEndHour = Number(prefs.workday_end_hour ?? 17)
  const lunchStartHour = Number(prefs.lunch_start_hour ?? 12)
  const lunchEndHour = Number(prefs.lunch_end_hour ?? 13)
  const allowWeekends = Boolean(prefs.allow_weekends ?? false)

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

  // Get current time to avoid scheduling tasks in the past
  const now = new Date()
  const currentTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0)

  // Fetch busy slots from all calendar providers (provider-agnostic)
  let existingSchedules: Array<{ date: string; start_time: string; end_time: string }> = []
  try {
    const busySlots = await getBusySlotsForUser(userId, startDate, endDate)
    // Convert busy slots to existing schedules format
    existingSchedules = busySlots.map(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return {
        date: formatDateForDB(slotStart),
        start_time: slotStart.toTimeString().slice(0, 5), // HH:MM
        end_time: slotEnd.toTimeString().slice(0, 5), // HH:MM
      }
    })
    
    if (existingSchedules.length > 0) {
      console.log(`[generateTaskSchedule] Found ${existingSchedules.length} busy slots from calendar`)
    }
  } catch (error) {
    console.error('[generateTaskSchedule] Failed to fetch busy slots', error)
    // Continue without busy slots if fetch fails
  }

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
    existingSchedules // Pass busy slots to avoid conflicts
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
                    timezone: 'UTC', // TODO: Get from user preferences
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
  }

  console.log(`✅ Task schedule generated: ${placements.length} placement(s), ${totalScheduledHours.toFixed(2)}h scheduled, ${unscheduledTasks.length} unscheduled`)
}












