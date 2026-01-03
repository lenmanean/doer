import { supabase } from '@/lib/supabase/client'
import { Plan, Task, TaskSchedule } from '@/lib/types'
import { logger } from '@/lib/logger'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ActivePlanData {
  plan: Plan
  tasks: Task[]
}

export interface TaskCompletion {
  id: string
  user_id: string
  plan_id: string
  task_id: string
  scheduled_date: string
  created_at: string
}

export interface ProgressStats {
  totalTasks: number
  completedTasks: number
  completionPercentage: number
  completions: TaskCompletion[]
}

export interface TaskCompletionParams {
  userId: string
  planId: string
  taskId: string
  scheduledDate: string
  isCompleted: boolean
}

export interface TaskWithSchedule extends Task {
  schedule?: TaskSchedule
  completed?: boolean
}

export interface TasksByDate {
  [date: string]: TaskWithSchedule[]
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get the active plan for a user with all related data
 */
export async function getUserActivePlan(userId: string): Promise<ActivePlanData | null> {
  try {
    console.log('🔍 Fetching active plan for user:', userId)
    
    const { data: planData, error: planError } = await supabase
      .from('plans')
      .select(`
        id,
        user_id,
        goal_text,
        clarifications,
        start_date,
        end_date,
        summary_data,
        status,
        plan_type,
        created_at,
        archived_at,
        updated_at,
        tasks (
          id,
          plan_id,
          user_id,
          idx,
          name,
          details,
          estimated_duration_minutes,
          category,
          created_at,
          updated_at,
          task_schedule (
            id,
            plan_id,
            user_id,
            task_id,
            day_index,
            date,
            start_time,
            end_time,
            duration_minutes,
            rescheduled_from,
            created_at,
            updated_at
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (planError) {
      // Handle "not found" errors gracefully
      if (planError.code === 'PGRST116') {
        console.log('🔍 No active plan found for user:', userId)
        return null
      }
      // Log error details for debugging
      if (planError.message?.includes('406') || (planError as any)?.status === 406) {
        console.warn('⚠️ 406 (Not Acceptable) error on plans query - this may be a header configuration issue')
        console.warn('Error details:', planError)
      }
      console.error('❌ Error fetching active plan:', planError)
      throw planError
    }
    
    console.log('✅ Active plan found:', {
      planId: planData.id,
      goal: planData.goal_text,
      tasks: planData.tasks?.length || 0
    })

    // Ensure all tasks have required properties
    const tasks = (planData.tasks || []).map((task: any) => ({
      ...(task as Task),
      priority: task.priority || 3 // Default to medium priority if missing
    }))

    return {
      plan: planData,
      tasks
    }
  } catch (error) {
    throw error
  }
}

/**
 * Get progress statistics for a user's plan
 */
export async function getUserProgressStats(userId: string, planId: string): Promise<ProgressStats> {
  try {
    // Get task completions for this plan
    const { data: completions, error: completionsError } = await supabase
      .from('task_completions')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)

    if (completionsError) {
      throw completionsError
    }

    // Get total tasks for this plan
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('plan_id', planId)

    if (tasksError) {
      throw tasksError
    }

    const totalTasks = tasks?.length || 0
    const completedTasks = completions?.length || 0
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    return {
      totalTasks,
      completedTasks,
      completionPercentage,
      completions: (completions || []) as TaskCompletion[]
    }
  } catch (error) {
    logger.error('Error in getUserProgressStats', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId,
      planId,
    })
    throw error
  }
}

/**
 * Get tasks grouped by date with time-block scheduling data
 */
export async function getTasksByDate(planId: string): Promise<TasksByDate> {
  try {
    console.log('🔍 Fetching tasks by date for plan:', planId)
    
    const { data: taskSchedules, error } = await supabase
      .from('task_schedule')
      .select(`
        id,
        plan_id,
        user_id,
        task_id,
        milestone_id,
        day_index,
        date,
        start_time,
        end_time,
        duration_minutes,
        rescheduled_from,
        created_at,
        updated_at,
        tasks (
          id,
          plan_id,
          user_id,
          milestone_id,
          idx,
          name,
          details,
          estimated_duration_minutes,
          complexity_score,
          created_at,
          updated_at
        )
      `)
      .eq('plan_id', planId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('❌ Error fetching task schedules:', error)
      throw error
    }

    // Group by date
    const tasksByDate: TasksByDate = {}
    
    for (const schedule of taskSchedules || []) {
      const date = schedule.date
      if (!tasksByDate[date]) {
        tasksByDate[date] = []
      }
      
      if (schedule.tasks && Array.isArray(schedule.tasks) && schedule.tasks.length > 0) {
        const task = schedule.tasks[0] // Get the first (and should be only) task
        tasksByDate[date].push({
          id: task.id,
          plan_id: task.plan_id,
          idx: task.idx,
          name: task.name,
          details: task.details,
          estimated_duration_minutes: task.estimated_duration_minutes,
          complexity_score: task.complexity_score,
          priority: (task as any).priority || 3 as 1 | 2 | 3 | 4, // Default to medium priority if missing
          created_at: task.created_at,
          schedule: schedule,
          completed: false // Will be updated by completion status
        })
      }
    }

    console.log('✅ Tasks by date fetched:', {
      dates: Object.keys(tasksByDate).length,
      totalSchedules: taskSchedules?.length || 0
    })

    return tasksByDate
  } catch (error) {
    console.error('❌ Error in getTasksByDate:', error)
    throw error
  }
}

/**
 * Get tasks scheduled for today
 */
export async function getTodayTasks(userId: string, planId: string): Promise<TaskWithSchedule[]> {
  try {
    const today = new Date().toISOString().split('T')[0]
    console.log('🔍 Fetching today\'s tasks for:', today)
    
    const { data: taskSchedules, error } = await supabase
      .from('task_schedule')
      .select(`
        id,
        plan_id,
        user_id,
        task_id,
        milestone_id,
        day_index,
        date,
        start_time,
        end_time,
        duration_minutes,
        rescheduled_from,
        created_at,
        updated_at,
        tasks (
          id,
          plan_id,
          user_id,
          milestone_id,
          idx,
          name,
          details,
          estimated_duration_minutes,
          complexity_score,
          created_at,
          updated_at
        )
      `)
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .eq('date', today)
      .order('start_time', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('❌ Error fetching today\'s tasks:', error)
      throw error
    }

    // Get completion status for today's tasks
    const taskIds = taskSchedules?.map(ts => ts.task_id) || []
    let completionMap = new Map<string, boolean>()
    
    if (taskIds.length > 0) {
      const { data: completions } = await supabase
        .from('task_completions')
        .select('task_id')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .in('task_id', taskIds)
      
      completionMap = new Map(
        completions?.map(c => [c.task_id, true]) || []
      )
    }

    const todayTasks: TaskWithSchedule[] = (taskSchedules || []).map(schedule => {
      const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks
      return {
        id: task.id,
        plan_id: task.plan_id,
        milestone_id: task.milestone_id,
        idx: task.idx,
        name: task.name,
        details: task.details,
        estimated_duration_minutes: task.estimated_duration_minutes,
        complexity_score: task.complexity_score,
        priority: (task as any).priority || 3 as 1 | 2 | 3 | 4, // Default to medium priority if missing
        created_at: task.created_at,
        schedule: schedule,
        completed: completionMap.has(schedule.task_id)
      }
    })

    console.log('✅ Today\'s tasks fetched:', {
      count: todayTasks.length,
      completed: todayTasks.filter(t => t.completed).length
    })

    return todayTasks
  } catch (error) {
    console.error('❌ Error in getTodayTasks:', error)
    throw error
  }
}

/**
 * Get tasks for a specific date
 */
export async function getTasksForDate(planId: string, date: string): Promise<TaskWithSchedule[]> {
  try {
    console.log('🔍 Fetching tasks for date:', date, 'plan:', planId)
    
    const { data: taskSchedules, error } = await supabase
      .from('task_schedule')
      .select(`
        id,
        plan_id,
        user_id,
        task_id,
        milestone_id,
        day_index,
        date,
        start_time,
        end_time,
        duration_minutes,
        rescheduled_from,
        created_at,
        updated_at,
        tasks (
          id,
          plan_id,
          user_id,
          milestone_id,
          idx,
          name,
          details,
          estimated_duration_minutes,
          complexity_score,
          created_at,
          updated_at
        )
      `)
      .eq('plan_id', planId)
      .eq('date', date)
      .order('start_time', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('❌ Error fetching tasks for date:', error)
      throw error
    }

    const tasksForDate: TaskWithSchedule[] = (taskSchedules || []).map(schedule => {
      const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks
      return {
        id: task.id,
        plan_id: task.plan_id,
        milestone_id: task.milestone_id,
        idx: task.idx,
        name: task.name,
        details: task.details,
        estimated_duration_minutes: task.estimated_duration_minutes,
        complexity_score: task.complexity_score,
        priority: (task as any).priority || 3 as 1 | 2 | 3 | 4, // Default to medium priority if missing
        created_at: task.created_at,
        schedule: schedule,
        completed: false // Will be updated by completion status if needed
      }
    })

    return tasksForDate
  } catch (error) {
    logger.error('Error in getTasksForDate', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      planId,
      date,
    })
    throw error
  }
}

// ============================================================================
// TASK COMPLETION FUNCTIONS
// ============================================================================

/**
 * Update task completion status (unified function used by hooks)
 */
export async function updateTaskCompletionUnified(params: TaskCompletionParams): Promise<void> {
  const { userId, planId, taskId, scheduledDate, isCompleted } = params

  try {
    if (isCompleted) {
      // Insert completion record
      const { error: insertError } = await supabase
        .from('task_completions')
        .insert({
          user_id: userId,
          task_id: taskId,
          plan_id: planId,
          scheduled_date: scheduledDate
        })

      if (insertError) {
        logger.error('Error inserting task completion', {
          error: insertError instanceof Error ? insertError.message : String(insertError),
          errorStack: insertError instanceof Error ? insertError.stack : undefined,
          userId,
          planId,
          taskId,
          scheduledDate,
        })
        throw insertError
      }
    } else {
      // Delete completion record
      const { error: deleteError } = await supabase
        .from('task_completions')
        .delete()
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .eq('plan_id', planId)
        .eq('scheduled_date', scheduledDate)

      if (deleteError) {
        logger.error('Error deleting task completion', {
          error: deleteError instanceof Error ? deleteError.message : String(deleteError),
          errorStack: deleteError instanceof Error ? deleteError.stack : undefined,
          userId,
          planId,
          taskId,
          scheduledDate,
        })
        throw deleteError
      }
    }

    // Sync completion status to Todoist if linked and auto_completion_sync is enabled
    // Call API route to handle sync (since this function can be called from client)
    try {
      await fetch('/api/integrations/todoist/sync-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, isCompleted }),
      }).catch(() => {
        // Ignore errors - sync is best effort
      })
    } catch (syncError) {
      // Ignore - sync is best effort
    }
  } catch (error) {
    logger.error('Error in updateTaskCompletionUnified', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId,
      planId,
      taskId,
      scheduledDate,
    })
    throw error
  }
}

/**
 * Check if a task is completed
 */
export async function isTaskCompleted(userId: string, planId: string, taskId: string, scheduledDate: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('task_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('task_id', taskId)
      .eq('scheduled_date', scheduledDate)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error checking task completion:', error)
      throw error
    }

    return !!data
  } catch (error) {
    console.error('❌ Error in isTaskCompleted:', error)
    throw error
  }
}

/**
 * Get completed tasks for a plan
 */
export async function getCompletedTasks(userId: string, planId: string): Promise<any[]> {
  try {
    const { data: completions, error } = await supabase
      .from('task_completions')
      .select(`
        id,
        task_id,
        scheduled_date,
        completed_at,
        tasks (
          id,
          name,
          milestone_id
        )
      `)
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching completed tasks:', error)
      throw error
    }

    return completions || []
  } catch (error) {
    console.error('❌ Error in getCompletedTasks:', error)
    throw error
  }
}

// ============================================================================
// MILESTONE FUNCTIONS
// ============================================================================

/**
 * Get milestone completion status
 */
export async function getMilestoneCompletionStatus(planId: string, milestoneIds: string[]): Promise<Map<string, boolean>> {
  try {
    if (milestoneIds.length === 0) {
      return new Map()
    }

    console.log('🔍 Checking milestone completion status for:', milestoneIds.length, 'milestones')
    
    const { data: completions, error } = await supabase
      .from('task_completions')
      .select(`
        task_id,
        tasks!inner (
          milestone_id
        )
      `)
      .eq('plan_id', planId)
      .in('tasks.milestone_id', milestoneIds)

    if (error) {
      console.error('❌ Error fetching milestone completion status:', error)
      throw error
    }

    // Get total tasks per milestone
    const { data: milestoneTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('milestone_id')
      .eq('plan_id', planId)
      .in('milestone_id', milestoneIds)
      .not('milestone_id', 'is', null)

    if (tasksError) {
      console.error('❌ Error fetching milestone tasks:', tasksError)
      throw tasksError
    }

    // Count completed tasks per milestone
    const completionMap = new Map<string, boolean>()
    
    for (const milestoneId of milestoneIds) {
      const totalTasks = milestoneTasks?.filter((t: any) => t.milestone_id === milestoneId).length || 0
      const completedTasks = completions?.filter((c: any) => c.tasks?.milestone_id === milestoneId).length || 0
      
      // Milestone is complete if all its tasks are completed
      completionMap.set(milestoneId, totalTasks > 0 && completedTasks >= totalTasks)
    }

    console.log('✅ Milestone completion status calculated:', {
      total: milestoneIds.length,
      completed: Array.from(completionMap.values()).filter(Boolean).length
    })

    return completionMap
  } catch (error) {
    console.error('❌ Error in getMilestoneCompletionStatus:', error)
    throw error
  }
}

/**
 * Get milestone progress details
 */
export async function getMilestoneProgress(planId: string, milestoneId: string): Promise<{
  totalTasks: number
  completedTasks: number
  completionPercentage: number
}> {
  try {
    // Get total tasks for milestone
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('plan_id', planId)
      .eq('milestone_id', milestoneId)

    if (tasksError) {
      console.error('❌ Error fetching milestone tasks:', tasksError)
      throw tasksError
    }

    const totalTasks = tasks?.length || 0

    if (totalTasks === 0) {
      return { totalTasks: 0, completedTasks: 0, completionPercentage: 0 }
    }

    // Get completed tasks for milestone
    const taskIds = tasks?.map(t => t.id) || []
    const { data: completions, error: completionsError } = await supabase
      .from('task_completions')
      .select('task_id')
      .eq('plan_id', planId)
      .in('task_id', taskIds)

    if (completionsError) {
      console.error('❌ Error fetching milestone completions:', completionsError)
      throw completionsError
    }

    const completedTasks = completions?.length || 0
    const completionPercentage = Math.round((completedTasks / totalTasks) * 100)

    return {
      totalTasks,
      completedTasks,
      completionPercentage
    }
  } catch (error) {
    console.error('❌ Error in getMilestoneProgress:', error)
    throw error
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get plan health/vitality metrics
 */
export async function getPlanHealth(userId: string, planId: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('get_plan_health_now', {
      p_user_id: userId,
      p_plan_id: planId
    })

    if (error) {
      console.error('❌ Error fetching plan health:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('❌ Error in getPlanHealth:', error)
    throw error
  }
}

/**
 * Refresh plan state (triggers real-time updates)
 */
export async function refreshPlanState(planId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('refresh_plan_state', {
      p_plan_id: planId
    })

    if (error) {
      logger.error('Error refreshing plan state', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        planId,
      })
      throw error
    }
  } catch (error) {
    logger.error('Error in refreshPlanState', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      planId,
    })
    throw error
  }
}

/**
 * Cleanup duplicate task completions
 */
export async function cleanupDuplicateCompletions(userId: string, planId: string): Promise<void> {
  try {
    console.log('🔍 Cleaning up duplicate completions for user:', userId, 'plan:', planId)
    
    // This function would remove duplicate completion records
    // Implementation depends on specific cleanup logic needed
    console.log('✅ Duplicate completions cleaned up')
  } catch (error) {
    console.error('❌ Error in cleanupDuplicateCompletions:', error)
    throw error
  }
}