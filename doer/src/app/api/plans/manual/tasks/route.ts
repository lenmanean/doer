import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toLocalMidnight, formatDateForDB, parseDateFromDB, getDayNumber } from '@/lib/date-utils'
import { isCrossDayTask, calculateDuration, splitCrossDayScheduleEntry, validateTaskDuration } from '@/lib/task-time-utils'
import { validateTaskDate, validateTaskTimes } from '@/lib/validation/task-validation'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

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

    // Validate task names (database constraint requires non-empty names)
    const invalidTasks = tasks.filter((task: any, index: number) => !task.name || !task.name.trim())
    if (invalidTasks.length > 0) {
      return NextResponse.json(
        { error: 'All tasks must have a name. Please fill in task names before creating the plan.' },
        { status: 400 }
      )
    }

    // Insert tasks
    const tasksToInsert = tasks.map((task: any, index: number) => {
      // Map priority to category if needed
      // Priority 1-2 -> category A (high priority), 3 -> B (medium), 4 -> C (low)
      let category = task.category
      if (!category && task.priority) {
        if (task.priority <= 2) {
          category = 'A'
        } else if (task.priority === 3) {
          category = 'B'
        } else {
          category = 'C'
        }
      }
      
      return {
        plan_id,
        user_id: user.id,
        idx: index + 1,
        name: task.name.trim(), // Trim whitespace to ensure it passes the constraint
        details: task.details || null,
        estimated_duration_minutes: task.estimated_duration_minutes || 60,
        priority: task.priority || 1,
        category: category || 'B', // Default to medium priority/difficulty
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
    
    // Create task schedule entries using user's selected dates
    const taskScheduleEntries = []
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      const insertedTask = insertedTasks[i]
      
      if (task.scheduled_date && insertedTask) {
        // Validate task scheduled date is within plan range
        const dateValidation = validateTaskDate(task.scheduled_date, {
          isManualTask: true,
          planStartDate: formatDateForDB(planStartDate),
          planEndDate: formatDateForDB(toLocalMidnight(plan.end_date)),
          allowPastDates: true, // Manual tasks can be in the past
        })
        
        if (!dateValidation.valid) {
          console.error(`Task "${task.name}" date validation failed:`, dateValidation.errors)
          return NextResponse.json({
            error: `Task "${task.name}" validation failed`,
            details: dateValidation.errors.join('; ')
          }, { status: 400 })
        }
        
        // Validate task times and duration if provided
        if (task.start_time || task.end_time) {
          const timesValidation = validateTaskTimes(task.start_time, task.end_time, {
            isManualTask: true,
          })
          
          if (!timesValidation.valid) {
            console.error(`Task "${task.name}" time validation failed:`, timesValidation.errors)
            return NextResponse.json({
              error: `Task "${task.name}" validation failed`,
              details: timesValidation.errors.join('; ')
            }, { status: 400 })
          }
        }
        
        // Use toLocalMidnight to handle the date string properly
        const scheduledDate = toLocalMidnight(task.scheduled_date)
        const dayIndex = getDayNumber(scheduledDate, planStartDate)
        
        // Check if this is a cross-day task and handle accordingly
        if (task.start_time && task.end_time && isCrossDayTask(task.start_time, task.end_time)) {
          // Split cross-day task into two schedule entries
          try {
            const splitEntries = splitCrossDayScheduleEntry(
              formatDateForDB(scheduledDate),
              task.start_time,
              task.end_time,
              insertedTask.id,
              user.id,
              plan_id,
              dayIndex
            )
            
            // Calculate day index for the second entry (next day)
            const nextDayDate = toLocalMidnight(splitEntries[1].date)
            const nextDayIndex = getDayNumber(nextDayDate, planStartDate)
            
            // Update the second entry with correct day_index
            splitEntries[1].day_index = nextDayIndex
            
            taskScheduleEntries.push(...splitEntries)
            
            console.log('Scheduling cross-day task (split):', {
              name: insertedTask.name,
              scheduled_date: task.scheduled_date,
              formatted_date: formatDateForDB(scheduledDate),
              day_index: dayIndex,
              next_day_index: nextDayIndex,
              start_time: task.start_time,
              end_time: task.end_time,
              split_entries: 2
            })
          } catch (error: any) {
            console.error('Error splitting cross-day task:', error)
            return NextResponse.json({
              error: 'Failed to create cross-day task',
              details: error.message || 'Invalid cross-day task configuration'
            }, { status: 400 })
          }
        } else {
          // Non-cross-day task - create single schedule entry
          const durationMinutes = (task.start_time && task.end_time)
            ? calculateDuration(task.start_time, task.end_time)
            : (task.estimated_duration_minutes || insertedTask.estimated_duration_minutes)
          
          taskScheduleEntries.push({
            plan_id,
            user_id: user.id,
            task_id: insertedTask.id,
            date: formatDateForDB(scheduledDate),
            day_index: dayIndex,
            start_time: task.start_time || null,
            end_time: task.end_time || null,
            duration_minutes: durationMinutes,
            status: 'scheduled'
          })
          
          console.log('Scheduling task:', {
            name: insertedTask.name,
            scheduled_date: task.scheduled_date,
            formatted_date: formatDateForDB(scheduledDate),
            day_index: dayIndex,
            start_time: task.start_time,
            end_time: task.end_time,
            duration_minutes: durationMinutes
          })
        }
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

