import { createClient } from '@/lib/supabase/server'
import { deterministicScheduler, type TaskInput } from '@/lib/scheduler'

/**
 * Generate task schedule using deterministic scheduler (SERVER-SIDE ONLY)
 * This function must be called from API routes or server components
 */
export async function generateTaskSchedule(planId: string, startDate: Date, endDate: Date) {
  try {
    const supabase = await createClient()
    
    // Get all tasks for the plan with user_id
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, user_id, category, milestone_id')
      .eq('plan_id', planId)

    if (tasksError) throw tasksError

    if (!tasks || tasks.length === 0) {
      console.log('No tasks found for plan, skipping schedule generation')
      return
    }

    // Get user_id from the first task (all tasks should have the same user_id)
    const user_id = tasks[0]?.user_id
    if (!user_id) {
      throw new Error('No user_id found in tasks')
    }

    // Get milestones for the plan
    const { data: milestones, error: milestonesError } = await supabase
      .from('milestones')
      .select('id, name, target_date, idx')
      .eq('plan_id', planId)
      .order('idx', { ascending: true })

    if (milestonesError) {
      console.error('Error fetching milestones:', milestonesError)
      throw milestonesError
    }

    // Prepare milestones for scheduler
    const milestonesForScheduler = milestones?.map(milestone => ({
      id: milestone.id,
      name: milestone.name,
      target_date: milestone.target_date,
      idx: milestone.idx
    })) || []

    console.log('Using deterministic scheduler:', {
      taskCount: tasks.length,
      milestoneCount: milestonesForScheduler.length,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    })

    // Prepare tasks for scheduler with all necessary fields
    const taskInputs = tasks.map(task => ({
      id: task.id,
      est_days: 1, // Default to 1 day since est_days field was removedday since est_days field was removed
      estimated_duration_hours: 2,
      dependency_ids: [], // Default to no dependencies since dependency_ids field was removeddencies since dependency_ids field was removed
      category: task.category,
      milestone_id: task.milestone_id
    }))

    const schedule = deterministicScheduler({
      tasks: taskInputs,
      startDate,
      endDate,
      weeklyHours: 40,
      milestones: milestonesForScheduler
    })
    
    console.log('Scheduler generated:', schedule.length, 'schedule entries')

    // Insert schedule into task_schedule table
    const scheduleInserts = schedule.map(placement => {
      // Find the task to get its milestone_id
      const task = tasks.find(t => t.id === placement.task_id)
      return {
        plan_id: planId,
        user_id: user_id,
        task_id: placement.task_id,
        milestone_id: task?.milestone_id || null, // Include milestone_id for consistency
        day_index: placement.day_index,
        date: placement.date
      }
    })

    console.log('Schedule inserts prepared:', scheduleInserts.length, 'entries')
    console.log('Sample insert:', scheduleInserts[0])

    if (scheduleInserts.length > 0) {
      const { error: scheduleError } = await supabase
        .from('task_schedule')
        .insert(scheduleInserts)

      if (scheduleError) {
        console.error('Error inserting deterministic schedule:', scheduleError)
        throw scheduleError
      }

      console.log(`Generated ${scheduleInserts.length} deterministic schedule entries for plan ${planId}`)
    } else {
      console.log('No schedule entries to insert')
    }

  } catch (error) {
    console.error('Error generating task schedule:', error)
    throw error
  }
}

