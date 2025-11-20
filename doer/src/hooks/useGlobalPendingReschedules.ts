import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * Hook to check for ANY pending reschedules globally (all plans + free-mode)
 * Used to show badge in sidebar when user is not on schedule page
 */
export function useGlobalPendingReschedules(userId: string | null) {
  const [hasPending, setHasPending] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkPendingReschedules = useCallback(async () => {
    if (!userId) {
      setHasPending(false)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Check for free-mode pending reschedules
      const freeModeResponse = await fetch('/api/reschedules/pending?planId=')
      const freeModeData = freeModeResponse.ok ? await freeModeResponse.json() : null
      const hasFreeModePending = freeModeData?.success && freeModeData?.proposals?.length > 0

      // Check for plan-based pending reschedules
      // First, get all active plans for the user
      const { data: plans } = await supabase
        .from('plans')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')

      let hasPlanPending = false
      if (plans && plans.length > 0) {
        // Check each plan for pending reschedules
        const checkPromises = plans.map(async (plan) => {
          const response = await fetch(`/api/reschedules/pending?planId=${plan.id}`)
          if (!response.ok) return false
          const data = await response.json()
          return data?.success && data?.proposals?.length > 0
        })
        
        const results = await Promise.all(checkPromises)
        hasPlanPending = results.some(result => result === true)
      }

      setHasPending(hasFreeModePending || hasPlanPending)
    } catch (error) {
      console.error('Error checking global pending reschedules:', error)
      setHasPending(false)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Check on mount and when userId changes
  useEffect(() => {
    checkPendingReschedules()
  }, [checkPendingReschedules])

  // Subscribe to pending_reschedules changes for real-time updates
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('global-pending-reschedules')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_reschedules'
        },
        () => {
          // Debounce refetch to avoid excessive calls
          setTimeout(() => {
            checkPendingReschedules()
          }, 1000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, checkPendingReschedules])

  return { hasPending, loading }
}



















