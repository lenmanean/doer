import { useCallback, useEffect, useMemo, useState } from 'react'

export type UsageMetric = 'api_credits' | 'integration_actions'

export interface UsageMetricSummary {
  metric: UsageMetric
  cycleStart: string
  cycleEnd: string
  allocation: number
  used: number
  reserved: number
  available: number
  billingCycle: 'monthly' | 'annual'
}

interface UsageSummaryResult {
  metrics: UsageMetricSummary[] | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getMetric: (metric: UsageMetric) => UsageMetricSummary | undefined
}

export function useUsageSummary(userId?: string | null): UsageSummaryResult {
  const [metrics, setMetrics] = useState<UsageMetricSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    if (!userId) {
      setMetrics(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/usage/summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to load usage summary')
      }

      const payload = await response.json()
      setMetrics(payload.metrics ?? [])
    } catch (err) {
      console.error('[useUsageSummary] Failed to fetch usage summary', err)
      setError(err instanceof Error ? err.message : 'Failed to load usage summary')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await fetchSummary()
    }
    if (!cancelled && userId) {
      run()
    }
    return () => {
      cancelled = true
    }
  }, [fetchSummary, userId])

  const getMetric = useMemo(
    () => (metric: UsageMetric) => metrics?.find((entry) => entry.metric === metric),
    [metrics]
  )

  return {
    metrics,
    loading,
    error,
    refresh: fetchSummary,
    getMetric,
  }
}

