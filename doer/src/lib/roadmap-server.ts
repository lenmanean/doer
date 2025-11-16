import { createClient } from '@/lib/supabase/server'
import { timeBlockScheduler } from '@/lib/time-block-scheduler'
import { formatDateForDB, toLocalMidnight } from '@/lib/date-utils'

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

  // Run scheduler
  const { placements, totalScheduledHours, unscheduledTasks } = timeBlockScheduler({
    tasks: tasks.map(t => ({
      id: t.id,
      idx: t.idx,
      name: t.name,
      estimated_duration_minutes: t.estimated_duration_minutes || 60,
      priority: t.priority || 3,
    })),
    startDate,
    endDate,
    workdayStartHour,
    workdayStartMinute,
    workdayEndHour,
    lunchStartHour,
    lunchEndHour,
    allowWeekends,
    // We don't pass existingSchedules because we just cleared them
    existingSchedules: []
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

    const { error: insertError } = await supabase
      .from('task_schedule')
      .insert(scheduleRows)

    if (insertError) {
      console.error('[generateTaskSchedule] Failed inserting schedule:', insertError)
      return
    }
  }

  console.log(`✅ Task schedule generated: ${placements.length} placement(s), ${totalScheduledHours.toFixed(2)}h scheduled, ${unscheduledTasks.length} unscheduled`)
}












