import { supabase } from '@/lib/supabase/client'
import { 
  toLocalMidnight, 
  formatDateForDB, 
  parseDateFromDB, 
  getDayNumber 
} from '@/lib/date-utils'
import { deterministicScheduler, type TaskInput, type SchedulePlacement } from '@/lib/scheduler'

export interface TaskCompletion {
  taskId: string
  scheduledDate: string
  completedAt: string
}

/**
 * @deprecated UserProgress table has been removed. This interface is kept for compatibility.
 */
export interface UserProgress {
  id: string
  user_id: string
  plan_id: string
  milestone_id: string | null
  total_tasks: number
  completed_tasks: number
  completion_percentage: number
  last_updated: string
}

export interface SaveRoadmapData {
  startDate: Date
  endDate: Date
  days: number
  milestones: Array<{
    id: string
    title: string
    description: string
    date: Date
  }>
  taskCount: number
  calendarTasks: Array<{
    date: string
    tasks: string[]
  }>
  goalDescription: string
}

/**
 * @deprecated UserProgress type has been removed. This interface is kept for compatibility.
 */
export interface UserProgress {
  milestoneId: string | null
  totalTasks: number
  completedTasks: number
  completionPercentage: number
  lastUpdated: string
}

/**
 * Save the complete roadmap data generated during onboarding
 */
export async function saveOnboardingRoadmap(userId: string, data: SaveRoadmapData) {
  
  try {
    // Normalize dates to local midnight to prevent timezone drift
    const startDate = toLocalMidnight(data.startDate)
    const endDate = toLocalMidnight(data.endDate)
    
    // 1. Create or update the goal
    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        description: data.goalDescription,
        title: data.goalDescription.substring(0, 100), // First 100 chars as title
        deadline: endDate.toISOString(),
      })
      .select()
      .single()

    if (goalError) throw goalError

    // 2. Create the plan (roadmap) using local date formatting
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        goal_id: goal.id,
        user_id: userId,
        title: `Roadmap for ${data.goalDescription.substring(0, 50)}`,
        description: data.goalDescription,
        start_date: formatDateForDB(startDate),
        end_date: formatDateForDB(endDate),
        duration_days: data.days,
        status: 'active',
        plan_type: 'free'
      })
      .select()
      .single()

    if (planError) throw planError

    // 3. Create milestones with proper date handling
    const milestonePromises = data.milestones.map(async (milestone, index) => {
      const milestoneDate = toLocalMidnight(milestone.date)
      const dayNumber = getDayNumber(milestoneDate, startDate)

      const { data: savedMilestone, error } = await supabase
        .from('milestones')
        .insert({
          plan_id: plan.id,
          name: milestone.title,
          rationale: milestone.description,
          day_number: dayNumber,
          target_date: formatDateForDB(milestoneDate),
          status: 'pending',
          priority: index === 0 ? 'high' : 'medium',
          completion_percentage: 0,
          idx: index
        })
        .select()
        .single()

      if (error) throw error
      return savedMilestone
    })

    const savedMilestones = await Promise.all(milestonePromises)

    // 4. Create tasks and schedule them properly
    const taskPromises: PromiseLike<any>[] = []
    
    for (const dayTask of data.calendarTasks) {
      const taskDate = parseDateFromDB(dayTask.date)
      const dayNumber = getDayNumber(taskDate, startDate)
      const taskDateStr = formatDateForDB(taskDate)

      // Find if this date matches any milestone
      const matchingMilestone = savedMilestones.find(m => {
        return m.target_date === taskDateStr
      })

      for (let taskIndex = 0; taskIndex < dayTask.tasks.length; taskIndex++) {
        const taskName = dayTask.tasks[taskIndex]
        const isMilestoneTask = taskName.includes('Milestone')
        
        // Create the task first
        const { data: createdTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            plan_id: plan.id,
            milestone_id: matchingMilestone?.id || null,
            name: taskName,
            category: isMilestoneTask ? 'milestone_task' : 'daily_task',
            idx: taskIndex
          })
          .select()
          .single()

        if (taskError) throw taskError

        // Then create the schedule entry
        const { error: scheduleError } = await supabase
          .from('task_schedule')
          .insert({
            plan_id: plan.id,
            task_id: createdTask.id,
            milestone_id: createdTask.milestone_id, // Include milestone_id for consistency
            day_index: dayNumber,
            date: taskDateStr
          })

        if (scheduleError) throw scheduleError
      }
    }

    return {
      success: true,
      goalId: goal.id,
      planId: plan.id,
      milestoneCount: savedMilestones.length
    }
  } catch (error) {
    console.error('Error saving roadmap:', error)
    throw error
  }
}


/**
 * Get the user's active plan with all details
 */
export async function getUserActivePlan(userId: string) {
  try {
    // Get the active plan with milestones and tasks
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select(`
        id, user_id, goal_text, clarifications, start_date, end_date, summary_data, status, created_at,
        milestones (id, plan_id, idx, name, rationale, target_date, created_at),
        tasks (
          id, plan_id, milestone_id, idx, name, category, user_id, created_at,
          task_schedule (
            id, plan_id, task_id, user_id, date, day_index, created_at
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Handle "no rows" error gracefully - it means user has no active plan
    if (planError) {
      if (planError.code === 'PGRST116') {
        // No active plan found - this is a valid state, not an error
        return null
      }
      throw planError
    }
    
    if (!plan) return null

    return {
      plan,
      goal: { 
        id: plan.id, 
        title: plan.goal_text, 
        description: plan.goal_text 
      },
      milestones: plan.milestones || [],
      tasks: plan.tasks || []
    }
  } catch (error) {
    console.error('Error fetching user plan:', error)
    throw error
  }
}

/**
 * Get tasks grouped by date for calendar display
 */
export async function getTasksByDate(planId: string) {
  try {
    const { data: taskSchedule, error } = await supabase
      .from('task_schedule')
      .select(`
        date,
        tasks:task_id (
          id,
          name,
          category,
          milestone_id
        )
      `)
      .eq('plan_id', planId)
      .order('date', { ascending: true })

    if (error) throw error

    // Group tasks by date
    const tasksByDate: { [date: string]: any[] } = {}
    
    for (const schedule of taskSchedule || []) {
      const date = schedule.date
      if (!tasksByDate[date]) {
        tasksByDate[date] = []
      }
      if (schedule.tasks) {
        tasksByDate[date].push(schedule.tasks)
      }
    }

    return tasksByDate
  } catch (error) {
    console.error('Error fetching tasks by date:', error)
    throw error
  }
}

/**
 * Unified task completion handler
 * Handles insert, delete, and trigger-safe UPSERT operations for all task types.
 */
export async function updateTaskCompletionUnified({
  userId,
  planId,
  taskId,
  scheduledDate,
  isCompleted,
}: {
  userId: string
  planId: string
  taskId: string
  scheduledDate: string
  isCompleted: boolean
}) {
  if (!userId || !planId || !taskId || !scheduledDate) {
    throw new Error('Missing required parameters')
  }

  try {
    if (isCompleted) {
      const { error } = await supabase
        .from('task_completions')
        .upsert(
          [
            {
              user_id: userId,
              plan_id: planId,
              task_id: taskId,
              scheduled_date: scheduledDate,
            },
          ],
          { onConflict: 'user_id,task_id,scheduled_date' }
        )

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('task_completions')
        .delete()
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('task_id', taskId)
        .eq('scheduled_date', scheduledDate)

      if (error) throw error
    }

    console.log(`✅ Task ${isCompleted ? 'completed' : 'uncompleted'} successfully.`)
    return { success: true }
  } catch (err) {
    console.error('❌ Error updating task completion:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * @deprecated Use updateTaskCompletionUnified instead
 * Mark a task as completed
 */
export async function markTaskCompleted(userId: string, taskId: string, scheduledDate: string, planId: string) {
  return updateTaskCompletionUnified({ userId, planId, taskId, scheduledDate, isCompleted: true })
}

/**
 * @deprecated Use updateTaskCompletionUnified instead
 * Mark a task as not completed (remove completion record)
 */
export async function markTaskNotCompleted(userId: string, taskId: string, scheduledDate: string, planId?: string): Promise<void> {
  if (!planId) {
    throw new Error('planId is required')
  }
  const result = await updateTaskCompletionUnified({ userId, planId, taskId, scheduledDate, isCompleted: false })
  if (!result.success) {
    throw new Error(result.error || 'Failed to mark task as not completed')
  }
}

/**
 * Check if a task is completed
 * For milestone tasks, checks if ANY completion record exists (ignoring scheduled_date)
 */
export async function isTaskCompleted(userId: string, taskId: string, scheduledDate: string): Promise<boolean> {
  try {
    // Get the task to check if it's a milestone task
    const { data: task } = await supabase
      .from('tasks')
      .select('category')
      .eq('id', taskId)
      .single()
    
    const isMilestoneTask = task?.category === 'milestone_task'
    
    // Build the query
    let query = supabase
      .from('task_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('task_id', taskId)
    
    // For daily tasks, check the specific scheduled_date
    // For milestone tasks, check if ANY completion exists
    if (!isMilestoneTask) {
      query = query.eq('scheduled_date', scheduledDate)
    }
    
    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') throw error

    return !!data
  } catch (error) {
    console.error('Error checking task completion:', error)
    return false
  }
}

/**
 * Get all completed tasks for a user and plan
 */
export async function getCompletedTasks(userId: string, planId: string): Promise<TaskCompletion[]> {
  try {
    const { data: completions, error } = await supabase
      .from('task_completions')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)

    if (error) throw error

    return completions?.map(completion => ({
      taskId: completion.task_id,
      scheduledDate: completion.scheduled_date,
      completedAt: completion.completed_at
    })) || []
  } catch (error) {
    console.error('Error fetching completed tasks:', error)
    return []
  }
}

/**
 * Get user progress data
 * 
 * @deprecated This function has been removed as user_progress table no longer exists.
 * Use task_completions table directly for progress calculations.
 */
export async function getUserProgress(userId: string, planId: string): Promise<UserProgress | null> {
  console.warn('getUserProgress is deprecated and returns null. Use task_completions for progress tracking.')
  return null
}

/**
 * Get task completion status for a specific date
 */
export async function getTaskCompletionStatus(userId: string, planId: string, date: string): Promise<{ taskId: string, isCompleted: boolean }[]> {
  try {
    const { data, error } = await supabase.rpc('get_task_completion_status', {
      p_user_id: userId,
      p_plan_id: planId,
      p_date: date
    })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching task completion status:', error)
    return []
  }
}

/**
 * @deprecated Use updateTaskCompletionUnified instead
 * Update task completion status - legacy wrapper for backward compatibility
 */
export async function updateTaskCompletion(taskId: string, isCompleted: boolean, userId?: string, planId?: string, scheduledDate?: string) {
  try {
    let finalUserId = userId
    let finalPlanId = planId
    let finalScheduledDate = scheduledDate
    
    // Get current user from Supabase if not provided
    if (!finalUserId || !finalPlanId || !finalScheduledDate) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      // If we don't have the required data, we need to fetch it
      if (!finalScheduledDate) {
        finalScheduledDate = formatDateForDB(toLocalMidnight(new Date()))
      }
      
      if (!finalUserId) {
        finalUserId = user.id
      }
      
      if (!finalPlanId) {
        // Get the active plan
        const { data: plan } = await supabase
          .from('plans')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (!plan) throw new Error('No active plan found')
        finalPlanId = plan.id
      }
    }
    
    // At this point, all values should be defined
    if (!finalUserId || !finalPlanId || !finalScheduledDate) {
      throw new Error('Missing required parameters for task completion update')
    }
    
    // Use the new unified function
    return updateTaskCompletionUnified({
      userId: finalUserId,
      planId: finalPlanId,
      taskId,
      scheduledDate: finalScheduledDate,
      isCompleted
    })
  } catch (error) {
    console.error('Error updating task:', error)
    throw error
  }
}

/**
 * Get user progress statistics
 */
export async function getUserProgressStats(userId: string, planId: string) {

  try {
    // Get all tasks for the plan
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, plan_id, milestone_id, idx, name, category, user_id, created_at')
      .eq('plan_id', planId)

    if (tasksError) throw tasksError

    const totalTasks = tasks?.length || 0
    // Note: Current schema doesn't support task completion tracking
    // These values are placeholders until completion tracking is implemented
    const completedTasks = 0
    const progressPercentage = 0

    // Get milestones
    const { data: milestones, error: milestonesError } = await supabase
      .from('milestones')
      .select('id, plan_id, idx, name, rationale, target_date, created_at')
      .eq('plan_id', planId)

    if (milestonesError) throw milestonesError

    const totalMilestones = milestones?.length || 0
    // Note: Current schema doesn't support milestone completion tracking
    const completedMilestones = 0

    return {
      totalTasks,
      completedTasks,
      progressPercentage,
      totalMilestones,
      completedMilestones,
      milestoneProgress: totalMilestones > 0 
        ? Math.round((completedMilestones / totalMilestones) * 100) 
        : 0
    }
  } catch (error) {
    console.error('Error fetching progress stats:', error)
    throw error
  }
}

/**
 * Get tasks for a specific date
 */
export async function getTasksForDate(planId: string, date: string) {
  try {
    const { data: tasks, error } = await supabase
      .from('task_schedule')
      .select(`
        *,
        tasks (
          id,
          name,
          category,
          milestone_id
        )
      `)
      .eq('plan_id', planId)
      .eq('date', date)
      .order('day_index', { ascending: true })

    if (error) throw error

    // Get completion status for each task
    const taskIds = tasks?.map((schedule: any) => schedule.tasks.id) || []
    let completions: any[] = []
    
    if (taskIds.length > 0) {
      const { data: completionData, error: completionError } = await supabase
        .from('task_completions')
        .select('task_id, completed_at')
        .in('task_id', taskIds)
        .eq('scheduled_date', date)
      
      if (!completionError) {
        completions = completionData || []
      }
    }

    // Transform the data to match the expected format
    return tasks?.map((schedule: any) => ({
      id: schedule.tasks.id,
      name: schedule.tasks.name,
      category: schedule.tasks.category,
      milestone_id: schedule.tasks.milestone_id,
      scheduled_date: schedule.date,
      day_index: schedule.day_index,
      is_completed: completions.some(completion => completion.task_id === schedule.tasks.id)
    })) || []
  } catch (error) {
    console.error('Error fetching tasks for date:', error)
    throw error
  }
}

/**
 * Get tasks for today
 */
export async function getTodayTasks(planId: string) {
  const today = formatDateForDB(toLocalMidnight(new Date()))
  return getTasksForDate(planId, today)
}

/**
 * Get milestone completion status for all milestones in a plan
 * A milestone is considered complete if all its associated milestone_task category tasks are completed
 */
export async function getMilestoneCompletionStatus(planId: string): Promise<{ [milestoneId: string]: boolean }> {
  try {
    // Fast path: Use v_user_progress view for live milestone completion data
    const { data: progressData, error: progressError } = await supabase
      .from('v_user_progress')
      .select('milestone_id, completion_percentage')
      .eq('plan_id', planId)
      .not('milestone_id', 'is', null)

    if (!progressError && progressData && progressData.length > 0) {
      const completionStatus: { [milestoneId: string]: boolean } = {}
      progressData.forEach(progress => {
        completionStatus[progress.milestone_id] = parseFloat(progress.completion_percentage as any) >= 100
      })
      return completionStatus
    }
    
    // Get all milestone tasks for the plan (only milestone_task category)
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, milestone_id')
      .eq('plan_id', planId)
      .eq('category', 'milestone_task')
      .not('milestone_id', 'is', null)

    if (tasksError) throw tasksError

    // Get all task completions for the plan
    const { data: completions, error: completionsError } = await supabase
      .from('task_completions')
      .select('task_id')
      .eq('plan_id', planId)

    if (completionsError) throw completionsError

    // Create a set of completed task IDs for quick lookup
    const completedTaskIds = new Set(completions?.map(c => c.task_id) || [])
    
    console.log('Found milestone tasks:', tasks?.length || 0)
    console.log('Milestone tasks details:', tasks)
    console.log('Found completions:', completions?.length || 0)
    console.log('Completion details:', completions)
    console.log('Completed task IDs:', Array.from(completedTaskIds))

    // Group tasks by milestone
    const milestoneTasksMap: { [milestoneId: string]: { total: number, completed: number } } = {}
    
    tasks?.forEach(task => {
      if (!task.milestone_id) return
      
      if (!milestoneTasksMap[task.milestone_id]) {
        milestoneTasksMap[task.milestone_id] = { total: 0, completed: 0 }
      }
      
      milestoneTasksMap[task.milestone_id].total++
      
      if (completedTaskIds.has(task.id)) {
        milestoneTasksMap[task.milestone_id].completed++
        console.log(`Task ${task.id} is completed for milestone ${task.milestone_id}`)
      } else {
        console.log(`Task ${task.id} is NOT completed for milestone ${task.milestone_id}`)
      }
    })

    // Determine completion status for each milestone
    const completionStatus: { [milestoneId: string]: boolean } = {}
    
    Object.keys(milestoneTasksMap).forEach(milestoneId => {
      const { total, completed } = milestoneTasksMap[milestoneId]
      // A milestone is complete if it has tasks and all of them are completed
      completionStatus[milestoneId] = total > 0 && completed === total
      
      // Debug logging
      console.log(`Milestone ${milestoneId}: ${completed}/${total} tasks completed, status: ${completionStatus[milestoneId]}`)
    })

    console.log('getMilestoneCompletionStatus returning:', completionStatus)
    return completionStatus
  } catch (error) {
    console.error('Error fetching milestone completion status:', error)
    return {}
  }
}

/**
 * Clean up duplicate task completions for milestone tasks
 * For each milestone task, keeps only the most recent completion record
 * and deletes any older duplicates
 */
export async function cleanupDuplicateCompletions(userId: string, planId: string): Promise<{ removed: number }> {
  try {
    // Get all milestone tasks for the plan
    const { data: milestoneTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('plan_id', planId)
      .eq('category', 'milestone_task')

    if (tasksError) throw tasksError

    if (!milestoneTasks || milestoneTasks.length === 0) {
      return { removed: 0 }
    }

    const taskIds = milestoneTasks.map(t => t.id)
    let totalRemoved = 0

    // For each milestone task, find and remove duplicate completions
    for (const taskId of taskIds) {
      const { data: completions, error: completionsError } = await supabase
        .from('task_completions')
        .select('id, completed_at')
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .eq('plan_id', planId)
        .order('completed_at', { ascending: false })

      if (completionsError) throw completionsError

      if (completions && completions.length > 1) {
        // Keep the most recent (first), delete the rest
        const toDelete = completions.slice(1).map(c => c.id)
        
        const { error: deleteError } = await supabase
          .from('task_completions')
          .delete()
          .in('id', toDelete)

        if (deleteError) throw deleteError

        totalRemoved += toDelete.length
      }
    }

    console.log(`Cleaned up ${totalRemoved} duplicate completion records`)
    return { removed: totalRemoved }
  } catch (error) {
    console.error('Error cleaning up duplicate completions:', error)
    throw error
  }
}
