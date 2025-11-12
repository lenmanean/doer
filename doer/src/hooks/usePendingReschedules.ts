import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { RescheduleProposal } from '@/lib/types'

export interface UsePendingReschedulesReturn {
  pendingReschedules: RescheduleProposal[]
  loading: boolean
  hasPending: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function usePendingReschedules(
  userId: string | null,
  planId: string | null | 'free-mode'
): UsePendingReschedulesReturn {
  const [pendingReschedules, setPendingReschedules] = useState<RescheduleProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPendingReschedules = useCallback(async () => {
    if (!userId) {
      setPendingReschedules([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // For free-mode, pass null, otherwise pass the planId
      const planIdParam = planId === 'free-mode' ? null : planId
      const url = planIdParam ? `/api/reschedules/pending?planId=${planIdParam}` : '/api/reschedules/pending?planId='
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Failed to fetch pending reschedules')
      }

      const data = await response.json()

      console.log('[PendingReschedules] Fetched proposals:', {
        success: data.success,
        count: data.proposals?.length || 0,
        planId: planIdParam || 'free-mode'
      })

      if (data.success && data.proposals) {
        setPendingReschedules(data.proposals)
      } else {
        setPendingReschedules([])
      }
    } catch (err) {
      console.error('Error fetching pending reschedules:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setPendingReschedules([])
    } finally {
      setLoading(false)
    }
  }, [userId, planId])

  // Fetch on mount and when userId/planId changes
  useEffect(() => {
    fetchPendingReschedules()
  }, [fetchPendingReschedules])

  // Subscribe to pending_reschedules changes for real-time updates
  useEffect(() => {
    if (!userId) return

    // For free-mode, filter by null plan_id, otherwise filter by plan_id
    const planIdParam = planId === 'free-mode' ? null : planId
    const filter = planIdParam ? `plan_id=eq.${planIdParam}` : 'plan_id=is.null'
    const channelName = planIdParam ? `pending-reschedules-${planIdParam}` : `pending-reschedules-free-mode`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_reschedules',
          filter: filter
        },
        () => {
          // Debounce refetch to avoid excessive calls - increased timeout to prevent loops
          setTimeout(() => {
            fetchPendingReschedules()
          }, 2000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, planId, fetchPendingReschedules])

  return {
    pendingReschedules,
    loading,
    hasPending: pendingReschedules.length > 0,
    error,
    refetch: fetchPendingReschedules
  }
}

