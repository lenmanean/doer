import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toLocalMidnight, formatDateForDB, parseDateFromDB, getDayNumber } from '@/lib/date-utils'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    // ✅ Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const { plan_id, tasks } = body

    if (!plan_id || !tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'Missing required fields: plan_id or tasks array' },
        { status: 400 }
      )
    }

    // Verify the plan exists and belongs to the user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found or does not belong to user' },
        { status: 404 }
      )
    }

    // Verify plan is manual type
    if (plan.plan_type !== 'manual') {
      return NextResponse.json(
        { error: 'Can only add tasks to manual plans' },
        { status: 400 }
      )
    }

    console.log('Adding tasks to manual plan:', plan_id, 'count:', tasks.length)

    // Insert tasks
    const tasksToInsert = tasks.map((task: any, index: number) => {
      // Convert priority to complexity_score if provided
      // Priority 1-4 maps to complexity 8, 6, 4, 2
      let complexity_score = task.complexity_score
      if (!complexity_score && task.priority) {
        complexity_score = (5 - task.priority) * 2
      }
      
      return {
        plan_id,
        user_id: user.id,
        milestone_id: task.milestone_id || null,
        idx: index + 1,
        name: task.name,
        details: task.details || null,
        estimated_duration_minutes: task.estimated_duration_minutes || 60,
        priority: task.priority || 1,
        complexity_score: complexity_score || 5,
      }
    })

    const { data: insertedTasks, error: taskError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select()

    if (taskError) {
      console.error('Task insert error:', taskError)
      return NextResponse.json({ 
        error: 'Failed to create tasks',
        details: taskError.message 
      }, { status: 500 })
    }

    console.log('✅ Tasks created successfully:', insertedTasks.length)

    // For manual plans, use the scheduled_date from user's input directly
    // Convert plan dates to local midnight to avoid timezone issues
    const planStartDate = toLocalMidnight(plan.start_date)
    
    // Helper function to check if task is cross-day (end time < start time)
    const isCrossDayTask = (startTime: string | null, endTime: string | null): boolean => {
      if (!startTime || !endTime) return false
      const [startHour, startMin] = startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin
      return endMinutes < startMinutes
    }
    
    // Create task schedule entries using user's selected dates
    const taskScheduleEntries = []
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      const insertedTask = insertedTasks[i]
      
      if (task.scheduled_date && insertedTask) {
        // Use toLocalMidnight to handle the date string properly
        const scheduledDate = toLocalMidnight(task.scheduled_date)
        const dayIndex = getDayNumber(scheduledDate, planStartDate)
        
        // Check if this is a cross-day task
        const crossDay = isCrossDayTask(task.start_time, task.end_time)
        
        // Calculate duration properly for cross-day tasks
        let durationMinutes = task.estimated_duration_minutes || insertedTask.estimated_duration_minutes
        if (task.start_time && task.end_time) {
          const [startHour, startMin] = task.start_time.split(':').map(Number)
          const [endHour, endMin] = task.end_time.split(':').map(Number)
          const startMinutes = startHour * 60 + startMin
          let endMinutes = endHour * 60 + endMin
          
          // Handle cross-day: if end is before start, add 24 hours
          if (endMinutes < startMinutes) {
            endMinutes += 24 * 60
          }
          
          durationMinutes = endMinutes - startMinutes
        }
        
        taskScheduleEntries.push({
          plan_id,
          user_id: user.id,
          task_id: insertedTask.id,
          // milestone_id removed from system
          date: formatDateForDB(scheduledDate),
          day_index: dayIndex,
          start_time: task.start_time || null,
          end_time: task.end_time || null,
          duration_minutes: durationMinutes,
          status: 'scheduled' // Explicitly set status for new tasks
        })
        
        console.log('Scheduling task:', {
          name: insertedTask.name,
          scheduled_date: task.scheduled_date,
          formatted_date: formatDateForDB(scheduledDate),
          day_index: dayIndex,
          start_time: task.start_time,
          end_time: task.end_time,
          is_cross_day: crossDay,
          duration_minutes: durationMinutes
        })
      } else {
        console.warn('Task missing scheduled_date:', task.name)
      }
    }

    if (taskScheduleEntries.length > 0) {
      const { error: scheduleError } = await supabase
        .from('task_schedule')
        .insert(taskScheduleEntries)

      if (scheduleError) {
        console.error('Error inserting task schedule:', scheduleError)
        return NextResponse.json({ 
          error: 'Failed to create task schedule',
          details: scheduleError.message 
        }, { status: 500 })
      }

      console.log('✅ Task schedule created successfully:', taskScheduleEntries.length, 'entries')
    } else {
      console.warn('No task schedule entries to create')
    }

    return NextResponse.json({
      success: true,
      tasks: insertedTasks
    }, { status: 200 })
    
  } catch (err: any) {
    console.error('Task Creation Error:', err)
    return NextResponse.json({ 
      error: 'Unexpected error during task creation',
      message: err.message || 'Unknown error'
    }, { status: 500 })
  }
}

