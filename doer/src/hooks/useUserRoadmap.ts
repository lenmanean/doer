import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getUserActivePlan, getUserProgressStats, updateTaskCompletionUnified } from '@/lib/roadmap-client'

/**
 * Centralized live data hook for user roadmap and tasks.
 * Auto-subscribes to all relevant Supabase changes.
 */
export function useUserRoadmap(userId: string | null) {
  const [roadmapData, setRoadmapData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  const fetchLock = useRef(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const refetch = useCallback(async () => {
    if (!userId || fetchLock.current) return
    fetchLock.current = true
    try {
      const planData = await getUserActivePlan(userId)
      if (planData) {
        const stats = await getUserProgressStats(userId, planData.plan.id)
        setRoadmapData({ ...planData, stats })
        setError(null)
      } else {
        // No active plan - this is a valid state, not an error
        setRoadmapData(null)
        setError(null)
      }
    } catch (err) {
      console.error('Error refetching roadmap:', err)
      setError(err as Error)
      setRoadmapData(null)
    } finally {
      fetchLock.current = false
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchInitial = async () => {
      setLoading(true)
      await refetch()
      console.log('✅ useUserRoadmap initialized for user:', userId)
    }

    fetchInitial()
  }, [userId, refetch])

  // 🧠 Real-time synchronization for roadmap and tasks
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`roadmap-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_completions', filter: `user_id=eq.${userId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            console.log('🔁 Task completion change detected → refreshing roadmap')
            refetch()
            setLastUpdate(Date.now())
          }, 600)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            console.log('🔁 Task table change detected → refreshing roadmap')
            refetch()
            setLastUpdate(Date.now())
          }, 800)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones' },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            console.log('🔁 Milestone change detected → refreshing roadmap')
            refetch()
            setLastUpdate(Date.now())
          }, 1000)
        }
      )
      .subscribe()

    return () => {
      console.log('🧹 Cleaning up roadmap sync channel for user:', userId)
      supabase.removeChannel(channel)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [userId, refetch])

  // ✅ Expose unified completion API directly from hook
  const updateTask = useCallback(
    async (taskId: string, isCompleted: boolean, planId?: string, scheduledDate?: string) => {
      if (!userId || !planId || !scheduledDate) {
        console.error('Missing required parameters for task update.')
        return
      }
      await updateTaskCompletionUnified({
        userId,
        planId,
        taskId,
        scheduledDate,
        isCompleted,
      })
    },
    [userId]
  )

  return {
    roadmapData,
    loading,
    error,
    refetch,
    updateTask,
    lastUpdate,
  }
}
