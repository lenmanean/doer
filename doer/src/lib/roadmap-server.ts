import { createClient } from '@/lib/supabase/server'
import { timeBlockScheduler } from '@/lib/time-block-scheduler'
import { formatDateForDB, toLocalMidnight } from '@/lib/date-utils'
import { getBusySlotsForUser, pushTaskToCalendar } from '@/lib/calendar/google-calendar-sync'

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

  // Fetch busy slots from calendar if connection exists
  let existingSchedules: Array<{ date: string; start_time: string; end_time: string }> = []
  const { data: calendarConnection } = await supabase
    .from('calendar_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single()

  if (calendarConnection) {
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
    
    // Auto-push to Google Calendar if enabled
    if (calendarConnection && insertedSchedules && insertedSchedules.length > 0) {
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('id, auto_push_enabled, selected_calendar_ids')
        .eq('id', calendarConnection.id)
        .single()
      
      if (connection?.auto_push_enabled && connection.selected_calendar_ids?.length > 0) {
        const targetCalendarId = connection.selected_calendar_ids[0] || 'primary'
        
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
        
        // Push each schedule to Google Calendar
        let pushedCount = 0
        const pushErrors: string[] = []
        
        for (const schedule of insertedSchedules) {
          const task = taskMap.get(schedule.task_id)
          if (!task || !schedule.start_time || !schedule.end_time) {
            continue
          }
          
          // Build datetime strings
          const startDateTime = `${schedule.date}T${schedule.start_time}:00`
          const endDateTime = `${schedule.date}T${schedule.end_time}:00`
          
          try {
            const result = await pushTaskToCalendar(
              connection.id,
              targetCalendarId,
              schedule.id,
              task.id,
              planId,
              task.name,
              planName,
              startDateTime,
              endDateTime,
              null, // AI confidence - not available at schedule generation time
              'UTC' // TODO: Get from user preferences
            )
            
            if (result.success) {
              pushedCount++
            } else {
              pushErrors.push(`Task ${task.name}: ${result.error || 'Unknown error'}`)
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            pushErrors.push(`Task ${task.name}: ${errorMessage}`)
            console.warn(`[generateTaskSchedule] Failed to auto-push task ${task.name}:`, errorMessage)
          }
        }
        
        if (pushedCount > 0) {
          console.log(`[generateTaskSchedule] Auto-pushed ${pushedCount}/${insertedSchedules.length} tasks to Google Calendar`)
        }
        
        if (pushErrors.length > 0) {
          console.warn(`[generateTaskSchedule] Auto-push errors: ${pushErrors.join('; ')}`)
        }
      }
    }
  }

  console.log(`✅ Task schedule generated: ${placements.length} placement(s), ${totalScheduledHours.toFixed(2)}h scheduled, ${unscheduledTasks.length} unscheduled`)
}












