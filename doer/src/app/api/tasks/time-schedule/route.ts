import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkTimeOverlap, calculateDuration, isValidTimeFormat, shouldSkipPastTaskInstance, getCurrentDateTime, isCrossDayTask, parseTimeToMinutes } from '@/lib/task-time-utils'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * GET: Fetch tasks with time data for a specific date range
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const planId = searchParams.get('plan_id')
    const allPlans = searchParams.get('all_plans') === 'true'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    // planId can be null for free mode tasks, but we need date range
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing start_date or end_date parameter' }, { status: 400 })
    }
    
    // Build query for task schedules
    let query = supabase
      .from('task_schedule')
      .select(`
        id,
        date,
        start_time,
        end_time,
        duration_minutes,
        day_index,
        task_id,
        plan_id,
        status,
        reschedule_count,
        last_rescheduled_at,
        reschedule_reason,
        rescheduled_from
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false })
    
    // Filter by plan_id if provided, otherwise get free mode tasks (plan_id is null)
    // If all_plans=true, fetch ALL tasks (all plans + free-mode + calendar events)
    // Security: Use parameterized query to prevent SQL injection
    if (allPlans) {
      // Fetch all tasks - no plan_id filter (includes all plans, free-mode, and calendar events)
      // No additional filter needed - all tasks for the user will be returned
    } else if (planId) {
      // Validate planId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(planId)) {
        return NextResponse.json({ error: 'Invalid plan_id format' }, { status: 400 })
      }
      // Include both current plan and free-mode rows
      query = query.or(`plan_id.is.null,plan_id.eq.${planId}`)
    } else {
      query = query.is('plan_id', null)
    }
    
    // Apply date range filter if provided
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }
    
    const { data: taskSchedules, error } = await query
    
    console.log('Task schedules query result:', { 
      taskSchedules: taskSchedules?.length || 0, 
      error, 
      planId, 
      allPlans,
      startDate, 
      endDate,
      userId: user.id,
      sampleSchedule: taskSchedules?.[0]
    })
    
    if (error) {
      console.error('Error fetching task schedules:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Fetch tasks separately for schedules
    const taskIds = [...new Set(taskSchedules?.map(ts => ts.task_id) || [])]
    let tasksData: any[] = []
    
    if (taskIds.length > 0) {
      console.log('Fetching tasks for IDs:', taskIds)
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, name, details, estimated_duration_minutes, priority, is_recurring, is_indefinite, recurrence_days, recurrence_start_date, recurrence_end_date, is_calendar_event, is_detached, is_deleted_in_calendar')
        .in('id', taskIds)
      
      console.log('Tasks query result:', { tasks, tasksError })
      
      if (tasksError) {
        console.error('Error fetching tasks:', tasksError)
        return NextResponse.json({ error: tasksError.message }, { status: 500 })
      }
      
      // Log task names to debug the "0" issue
      tasks?.forEach((task: any) => {
        console.log('[time-schedule] Task name from DB:', {
          id: task.id,
          name: task.name,
          nameLength: task.name?.length,
          nameChars: task.name?.split('').map((c: string) => c.charCodeAt(0)),
          nameJSON: JSON.stringify(task.name)
        })
      })
      
      tasksData = tasks || []
    }
    
    // Create a map of tasks by ID
    const tasksMap = new Map(tasksData.map(task => [task.id, task]))
    
    // Also fetch task completions for the date range
    // Note: task_completions uses scheduled_date (not date), and presence of record = completed
    let completionsQuery = supabase
      .from('task_completions')
      .select('task_id, scheduled_date, plan_id')
      .eq('user_id', user.id)
    
    if (startDate) {
      completionsQuery = completionsQuery.gte('scheduled_date', startDate)
    }
    if (endDate) {
      completionsQuery = completionsQuery.lte('scheduled_date', endDate)
    }
    
    const { data: completions } = await completionsQuery
    
    // Create a map of completed tasks: key is task_id-scheduled_date-plan_id (to handle free-mode)
    // Presence of record in map = completed
    const completionMap = new Map(
      completions?.map(c => {
        const key = `${c.task_id}-${c.scheduled_date}-${c.plan_id || 'null'}`
        return [key, true]
      }) || []
    )
    
    // Group by date and enrich with completion status
    const tasksByDate: { [date: string]: any[] } = {}
    
    // Use local-date formatting to avoid UTC day shifts
    const fmtLocal = (d: Date) => {
      const y = d.getFullYear()
      const m = (d.getMonth() + 1).toString().padStart(2, '0')
      const da = d.getDate().toString().padStart(2, '0')
      return `${y}-${m}-${da}`
    }
    const parseLocalYMD = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    
    const trimSeconds = (t: string | null) => {
      if (!t) return t
      const parts = t.split(':')
      return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t
    }

    // Track concrete schedule time ranges per (task,date) to avoid only exact duplicates
    const scheduledRangesByTaskDate = new Map<string, Set<string>>()
    for (const schedule of taskSchedules || []) {
      const date = schedule.date
      if (!tasksByDate[date]) {
        tasksByDate[date] = []
      }
      
      const task = tasksMap.get(schedule.task_id)
      if (task) {
        const taskKey = `${task.id}-${date}`
        const rangeKey = `${trimSeconds(schedule.start_time as any)}-${trimSeconds(schedule.end_time as any)}`
        if (!scheduledRangesByTaskDate.has(taskKey)) scheduledRangesByTaskDate.set(taskKey, new Set())
        scheduledRangesByTaskDate.get(taskKey)!.add(rangeKey)
        
        // Check completion: key includes task_id, scheduled_date, and plan_id
        const completionKey = `${schedule.task_id}-${date}-${schedule.plan_id || 'null'}`
        const isCompleted = completionMap.has(completionKey)
        
        tasksByDate[date].push({
          schedule_id: schedule.id,
          task_id: task.id,
          name: task.name,
          details: task.details,
          estimated_duration_minutes: task.estimated_duration_minutes,
          priority: task.priority,
          start_time: trimSeconds(schedule.start_time as any),
          end_time: trimSeconds(schedule.end_time as any),
          duration_minutes: schedule.duration_minutes,
          day_index: schedule.day_index,
          date: date,
          completed: isCompleted,
          is_recurring: task.is_recurring,
          is_indefinite: task.is_indefinite,
          recurrence_days: task.recurrence_days,
          recurrence_start_date: task.recurrence_start_date,
          recurrence_end_date: task.recurrence_end_date,
          plan_id: schedule.plan_id, // Add plan_id from schedule
          status: schedule.status || 'scheduled',
          reschedule_count: schedule.reschedule_count || 0,
          last_rescheduled_at: schedule.last_rescheduled_at,
          reschedule_reason: schedule.reschedule_reason,
          rescheduled_from: schedule.rescheduled_from,
          is_calendar_event: task.is_calendar_event || false,
          is_detached: task.is_detached || false,
          is_deleted_in_calendar: task.is_deleted_in_calendar || false,
        })
      }
    }

    // Generate synthesized instances for indefinite recurring tasks without schedules
    // Only consider tasks that belong to this user and match plan filter
    let indefQuery = supabase
      .from('tasks')
      .select('id, name, details, priority, is_recurring, is_indefinite, recurrence_days, default_start_time, default_end_time, plan_id')
      .eq('user_id', user.id)
      .eq('is_recurring', true)
      .eq('is_indefinite', true)

    if (allPlans) {
      // Fetch all indefinite recurring tasks - no plan_id filter
      // No additional filter needed - all tasks for the user will be returned
    } else if (planId) {
      // Validate planId is a valid UUID format (already validated above, but double-check)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(planId)) {
      // Include both current plan and free-mode indefinite tasks
      indefQuery = indefQuery.or(`plan_id.is.null,plan_id.eq.${planId}`)
      } else {
        indefQuery = indefQuery.is('plan_id', null)
      }
    } else {
      indefQuery = indefQuery.is('plan_id', null)
    }

    let indefTasks: any[] | null = null
    try {
      const { data: indef, error: indefError } = await indefQuery
      if (indefError) throw indefError
      indefTasks = indef
    } catch (indefErr: any) {
      // If default_* columns are not present yet, skip synthesizing indefinite tasks
      if (indefErr?.code === '42703') {
        console.warn('Skipping indefinite synthesis: default_* columns not found')
      } else {
        console.error('Error fetching indefinite tasks:', indefErr)
      }
    }

    const rangeStart = parseLocalYMD(startDate!)
    const rangeEnd = parseLocalYMD(endDate!)
    const rangeStartMinus1 = new Date(rangeStart)
    rangeStartMinus1.setDate(rangeStart.getDate() - 1)
    const rangeEndPlus1 = new Date(rangeEnd)
    rangeEndPlus1.setDate(rangeEnd.getDate() + 1)

    // Get current date/time for filtering past tasks
    const { todayStr, currentTimeStr } = getCurrentDateTime()

    if (indefTasks && indefTasks.length > 0) {
      for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
        const dateKey = fmtLocal(d)
        
        // Skip past dates entirely
        if (dateKey < todayStr) continue
        
        const dow = d.getDay()
        const prev = new Date(d)
        prev.setDate(d.getDate() - 1)
        const prevDow = prev.getDay()
        for (const t of indefTasks) {
          const days: number[] = (t.recurrence_days || []).map((v: any) => typeof v === 'string' ? parseInt(v, 10) : v)
          const startT = trimSeconds(t.default_start_time)
          const endT = trimSeconds(t.default_end_time)
          if (!startT || !endT) continue
          const isCrossDay = isCrossDayTask(startT, endT)
          const startMin = parseTimeToMinutes(startT)
          const endMin = parseTimeToMinutes(endT)
          const ensure = (key: string, s: string, e: string, dur: number) => {
            // Skip if this task instance is in the past
            if (shouldSkipPastTaskInstance(key, e, todayStr, currentTimeStr)) {
              return
            }
            
            const setKey = `${t.id}-${key}`
            const haveSame = scheduledRangesByTaskDate.get(setKey)?.has(`${s}-${e}`) ||
              (tasksByDate[key] || []).some(x => x.task_id === t.id && x.start_time === s && x.end_time === e)
            if (haveSame) return
            if (!tasksByDate[key]) tasksByDate[key] = []
            tasksByDate[key].push({
              schedule_id: `synthetic-${t.id}-${key}-${s}-${e}`,
              task_id: t.id,
              name: t.name,
              details: t.details,
              estimated_duration_minutes: null,
              priority: t.priority,
              start_time: s,
              end_time: e,
              duration_minutes: dur,
              day_index: 0,
              date: key,
              completed: completionMap.get(`${t.id}-${key}`) || false,
              is_recurring: true,
              is_indefinite: true,
              recurrence_days: days,
              plan_id: t.plan_id // Add plan_id from task
            })
          }
          if (!isCrossDay) {
            if (days.includes(dow)) {
              ensure(dateKey, startT, endT, endMin - startMin)
            }
          } else {
            // For cross-day tasks, we need to check both parts
            if (days.includes(dow)) {
              // Start day part: from startT to 23:59
              // Check if the actual end time (on next day) has passed
              const nextDayDateStr = fmtLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
              // Only generate if the task hasn't finished yet (next day's end time hasn't passed)
              if (!shouldSkipPastTaskInstance(nextDayDateStr, endT, todayStr, currentTimeStr)) {
                ensure(dateKey, startT, '23:59', 1440 - startMin)
              }
            }
            if (days.includes(prevDow)) {
              // End day part: from 00:00 to endT
              // Check if today's end time has passed
              if (!shouldSkipPastTaskInstance(dateKey, endT, todayStr, currentTimeStr)) {
                ensure(dateKey, '00:00', endT, endMin)
              }
            }
          }
        }
      }
    }

    // Debug summary for the requested range (focus Fri/Sat/Sun)
    try {
      const dates = [] as string[]
      for (let d = parseLocalYMD(startDate!); d <= parseLocalYMD(endDate!); d.setDate(d.getDate() + 1)) {
        dates.push(fmtLocal(d))
      }
      const summary = dates.reduce((acc: any, day) => {
        const items = (tasksByDate[day] || []).map(t => ({ s: t.start_time, e: t.end_time, name: t.name }))
        acc[day] = items
        return acc
      }, {})
      console.log('Synthesis summary for range:', { startDate, endDate, dates, summary })
    } catch (e) {
      console.warn('Failed to log synthesis summary:', e)
    }
    
    return NextResponse.json({ tasksByDate }, { status: 200 })
    
  } catch (error) {
    console.error('Error in GET /api/tasks/time-schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST: Update task time scheduling (start_time, end_time)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { schedule_id, start_time, end_time, date } = body
    
    if (!schedule_id || !start_time || !end_time || !date) {
      return NextResponse.json({ 
        error: 'Missing required fields: schedule_id, start_time, end_time, date' 
      }, { status: 400 })
    }
    
    // Validate time format
    if (!isValidTimeFormat(start_time) || !isValidTimeFormat(end_time)) {
      return NextResponse.json({ error: 'Invalid time format. Use HH:MM' }, { status: 400 })
    }
    
    // Calculate duration
    const duration = calculateDuration(start_time, end_time)
    
    if (duration <= 0) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }
    
    // Check for overlaps with other tasks on the same date
    const { data: existingTasks, error: fetchError } = await supabase
      .from('task_schedule')
      .select('id, start_time, end_time')
      .eq('date', date)
      .eq('user_id', user.id)
      .not('start_time', 'is', null)
      .not('end_time', 'is', null)
    
    if (fetchError) {
      console.error('Error fetching existing tasks:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    // Check for overlaps (excluding the current task being updated)
    const hasOverlap = checkTimeOverlap(
      existingTasks || [],
      start_time,
      end_time,
      schedule_id
    )
    
    if (hasOverlap) {
      return NextResponse.json({ 
        error: 'Time slot overlaps with another task' 
      }, { status: 409 })
    }

    // Get task_id from schedule to check if it's a calendar event (read-only)
    const { data: schedule, error: scheduleFetchError } = await supabase
      .from('task_schedule')
      .select('task_id')
      .eq('id', schedule_id)
      .eq('user_id', user.id)
      .single()

    if (scheduleFetchError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Check if this is a calendar event task (read-only)
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('is_calendar_event')
      .eq('id', schedule.task_id)
      .eq('user_id', user.id)
      .single()

    if (taskError) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Prevent editing calendar event tasks (they are read-only)
    if (task.is_calendar_event) {
      return NextResponse.json({ 
        error: 'Calendar event tasks are read-only and cannot be edited' 
      }, { status: 403 })
    }
    
    // Update the task schedule
    const { data, error: updateError } = await supabase
      .from('task_schedule')
      .update({
        start_time,
        end_time,
        duration_minutes: duration
      })
      .eq('id', schedule_id)
      .eq('user_id', user.id)
      .select()
      .single()
    
    if (updateError) {
      console.error('Error updating task schedule:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      schedule: data 
    }, { status: 200 })
    
  } catch (error) {
    console.error('Error in POST /api/tasks/time-schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}














