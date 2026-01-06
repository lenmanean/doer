import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { checkTimeOverlap } from '@/lib/task-time-utils'

export interface TaskWithTime {
  schedule_id: string
  task_id: string
  name: string
  details?: string
  priority: number
  milestone_id: string | null
  estimated_duration_minutes: number | null
  complexity_score: number | null
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  day_index: number
  date: string
  completed: boolean
  plan_id?: string | null
}

export interface TasksByDate {
  [date: string]: TaskWithTime[]
}

export function useTaskTimeSchedule(
  planId: string | null | 'free-mode' | 'skip' | 'all-plans',
  dateRange: { start: string; end: string }
) {
  const [tasksWithTime, setTasksWithTime] = useState<TasksByDate>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchLock = useRef(false)
  const latestRequestKeyRef = useRef<string>('')
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch tasks with time data
  const fetchTasks = useCallback(async () => {
    if (fetchLock.current) return
    if (planId === 'skip') return
    
    // Treat null planId as free-mode (no plan exists)
    const isFreeMode = planId === 'free-mode' || planId === null
    const isAllPlans = planId === 'all-plans'
    
    fetchLock.current = true
    setLoading(true)
    
    try {
      const requestKey = `${dateRange.start}|${dateRange.end}|${planId ?? 'null'}`
      latestRequestKeyRef.current = requestKey
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end
      })
      
      // Add all_plans parameter if fetching all tasks
      if (isAllPlans) {
        params.append('all_plans', 'true')
      } else if (!isFreeMode && planId) {
        // Add plan_id parameter only if it exists (for plan-based tasks)
        params.append('plan_id', planId)
      }
      // If isFreeMode is true, we'll fetch free mode tasks (plan_id is null in database)
      
      // Cancel any in-flight request for a previous range
      if (abortRef.current) {
        try { abortRef.current.abort() } catch {}
      }
      const controller = new AbortController()
      abortRef.current = controller

      const response = await fetch(`/api/tasks/time-schedule?${params}`, { signal: controller.signal })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`)
      }
      
      const data = await response.json()

      // Ignore stale responses that don't match the latest request key
      if (latestRequestKeyRef.current !== requestKey) {
        console.warn('Ignoring stale tasks response:', { requestKey, latest: latestRequestKeyRef.current })
        return
      }
      
      // Debug: Log specific problematic tasks
      if (data.tasksByDate) {
        Object.entries(data.tasksByDate).forEach(([date, tasks]) => {
          const problematicTasks = (tasks as any[]).filter(t => 
            t.name.includes('Design wireframes') || 
            t.name.includes('Build homepage') || 
            t.name.includes('Launch the website')
          );
          if (problematicTasks.length > 0) {
            console.log(`🔍 API Response - Date: ${date}`);
            problematicTasks.forEach(task => {
              console.log(`  Task: ${task.name} - day_index: ${task.day_index}`);
            });
          }
        });
      }
      
      // Transform the data to include date in each task
      const transformedData: TasksByDate = {}
      
      for (const [date, tasks] of Object.entries(data.tasksByDate)) {
        transformedData[date] = (tasks as any[]).map(task => ({
          ...task,
          date
        }))
      }
      
      setTasksWithTime(transformedData)
      setError(null)
    } catch (err) {
      console.error('Error fetching tasks with time:', err)
      setError(err as Error)
    } finally {
      fetchLock.current = false
      setLoading(false)
    }
  }, [planId, dateRange.start, dateRange.end])

  // Initial fetch
  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Real-time subscription to task_schedule changes
  useEffect(() => {
    if (planId === 'skip') return
    // Treat null planId as free-mode so we still receive updates
    const isFreeMode = planId === 'free-mode' || planId === null
    const isAllPlans = planId === 'all-plans'
    const channelName = isAllPlans 
      ? 'task-time-schedule-all-plans' 
      : isFreeMode 
        ? 'task-time-schedule-free-mode' 
        : `task-time-schedule-${planId}`
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'task_schedule',
          // When all-plans mode, listen to all changes (no filter)
          // When a plan exists, listen to both plan tasks and calendar events (plan_id = null)
          // When free-mode, only listen to calendar events (plan_id = null)
          filter: isAllPlans 
            ? undefined 
            : isFreeMode 
              ? 'plan_id=is.null' 
              : `plan_id=eq.${planId},plan_id=is.null`
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            console.log('🔁 Task schedule change detected → refreshing')
            fetchTasks()
          }, 500)
        }
      )
      // Listen for completion changes (no plan_id on this table)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'task_completions'
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            console.log('🔁 Task completion change detected → refreshing')
            fetchTasks()
          }, 500)
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks',
          // When all-plans mode, listen to all changes (no filter)
          // When a plan exists, listen to both plan tasks and calendar events (plan_id = null)
          // When free-mode, only listen to calendar events (plan_id = null)
          filter: isAllPlans 
            ? undefined 
            : isFreeMode 
              ? 'plan_id=is.null' 
              : `plan_id=eq.${planId},plan_id=is.null`
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            console.log('🔁 Task change detected → refreshing')
            fetchTasks()
          }, 500)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [planId, fetchTasks])

  // Update task time
  const updateTaskTime = useCallback(async (
    scheduleId: string,
    startTime: string,
    endTime: string,
    date: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/tasks/time-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: scheduleId,
          start_time: startTime,
          end_time: endTime,
          date
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to update task time' }
      }

      // Refresh data after update
      await fetchTasks()
      
      return { success: true }
    } catch (err) {
      console.error('Error updating task time:', err)
      return { success: false, error: 'Network error' }
    }
  }, [fetchTasks])

  // Get tasks for a specific date
  const getTasksForDate = useCallback((date: string): TaskWithTime[] => {
    return tasksWithTime[date] || []
  }, [tasksWithTime])

  // Get tasks for a specific time slot
  const getTasksForTimeSlot = useCallback((
    date: string,
    startTime: string,
    endTime: string
  ): TaskWithTime[] => {
    const dateTasks = tasksWithTime[date] || []
    return dateTasks.filter(task => {
      if (!task.start_time || !task.end_time) return false
      return task.start_time === startTime && task.end_time === endTime
    })
  }, [tasksWithTime])

  // Check for overlaps
  const checkOverlap = useCallback((
    date: string,
    newStart: string,
    newEnd: string,
    excludeTaskId?: string
  ): boolean => {
    const dateTasks = tasksWithTime[date] || []
    const tasksToCheck = dateTasks
      .filter(t => t.start_time && t.end_time)
      .map(t => ({
        id: t.schedule_id,
        start_time: t.start_time!,
        end_time: t.end_time!
      }))
    
    return checkTimeOverlap(tasksToCheck, newStart, newEnd, excludeTaskId)
  }, [tasksWithTime])

  return {
    tasksWithTime,
    loading,
    error,
    updateTaskTime,
    getTasksForDate,
    getTasksForTimeSlot,
    checkOverlap,
    refetch: fetchTasks
  }
}












