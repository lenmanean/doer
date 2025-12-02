'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ActivityHeatmap, ActivityHeatmapData } from '@/components/ui/ActivityHeatmap'
import { MetricCard } from '@/components/ui/MetricCard'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { TrendChart, TrendChartData } from '@/components/ui/TrendChart'
import { BarChart, BarChartData } from '@/components/ui/BarChart'
import { AnalyticsTabs } from '@/components/ui/AnalyticsTabs'
import { useGlobalPendingReschedules } from '@/hooks/useGlobalPendingReschedules'
import { isEmailConfirmed } from '@/lib/email-confirmation'
import { signOutClient } from '@/lib/auth/sign-out-client'
import { supabase } from '@/lib/supabase/client'

export default function AnalyticsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useSupabase()
  const { hasPending: hasPendingReschedules } = useGlobalPendingReschedules(user?.id || null)
  const [emailConfirmed, setEmailConfirmed] = useState(true)

  // Check email confirmation status
  useEffect(() => {
    if (!user) {
      setEmailConfirmed(true)
      return
    }
    
    const checkEmailStatus = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          setEmailConfirmed(isEmailConfirmed(currentUser))
        } else {
          setEmailConfirmed(isEmailConfirmed(user))
        }
      } catch (error) {
        console.error('Error checking email status:', error)
        setEmailConfirmed(isEmailConfirmed(user))
      }
    }
    
    checkEmailStatus()
  }, [user])

  const handleSignOut = async () => {
    try {
      await signOutClient(supabase)
      window.location.href = '/'
    } catch (error) {
      console.error('[AnalyticsPage] Error signing out:', error)
      window.location.href = '/'
    }
  }

  useEffect(() => {
    if (authLoading) return
    
    if (!user) {
      router.push('/login')
      return
    }
  }, [user, router, authLoading])

  // Analytics data state
  const [activityData, setActivityData] = useState<ActivityHeatmapData[]>([])
  const [completionTrend, setCompletionTrend] = useState<TrendChartData[]>([])
  const [productivityPatterns, setProductivityPatterns] = useState<BarChartData[]>([])
  const [reschedulingAnalysis, setReschedulingAnalysis] = useState<BarChartData[]>([])
  const [metrics, setMetrics] = useState({
    completionRate: 0,
    currentStreak: 0,
    onTimeRate: 0,
    rescheduleRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  // Fetch analytics data
  useEffect(() => {
    if (!user) return

    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/analytics?timeRange=${timeRange}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data')
        }
        
        const data = await response.json()
        
        setActivityData(data.activityData || [])
        setCompletionTrend(data.completionTrend || [])
        setProductivityPatterns(data.productivityPatterns || [])
        setReschedulingAnalysis(data.reschedulingAnalysis || [])
        setMetrics(data.metrics || {
          completionRate: 0,
          currentStreak: 0,
          onTimeRate: 0,
          rescheduleRate: 0
        })
      } catch (err) {
        console.error('Error fetching analytics:', err)
        setError(err instanceof Error ? err.message : 'Failed to load analytics data')
        // Set empty data on error
        setActivityData([])
        setCompletionTrend([])
        setProductivityPatterns([])
        setReschedulingAnalysis([])
        setMetrics({
          completionRate: 0,
          currentStreak: 0,
          onTimeRate: 0,
          rescheduleRate: 0
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [user, timeRange])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff7f00]"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar 
        user={user ? { email: user.email || '' } : undefined}
        onSignOut={handleSignOut}
        currentPath="/analytics"
        hasPendingReschedules={hasPendingReschedules}
        emailConfirmed={emailConfirmed}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#d7d2cb] mb-2">Data & Analytics</h1>
          <p className="text-[#d7d2cb]/70">
            Track your progress, productivity patterns, and performance metrics
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 items-start">
          <MetricCard
            title="Completion Rate"
            value={metrics.completionRate}
            trend={0}
            description="Overall task completion"
            color="#22c55e"
          />
          <MetricCard
            title="Current Streak"
            value={metrics.currentStreak}
            trend={0}
            description="Consecutive days with completions"
            color="#3b82f6"
            formatValue={(v) => `${Math.round(v)} days`}
          />
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col">
            <h3 className="text-sm font-medium text-[#d7d2cb]/70 mb-1.5">On-Time Rate</h3>
            <div className="flex items-center gap-2 mb-2">
              <ProgressRing
                percentage={metrics.onTimeRate}
                size={32}
                strokeWidth={3}
                color="#f59e0b"
                showBreakdown={false}
              />
              <span className="text-2xl font-bold text-[#d7d2cb]" style={{ color: '#f59e0b' }}>
                {metrics.onTimeRate}%
              </span>
            </div>
            <p className="text-xs text-[#d7d2cb]/50 leading-tight">Tasks completed on schedule</p>
          </div>
          <MetricCard
            title="Reschedule Rate"
            value={metrics.rescheduleRate}
            trend={0}
            description="Tasks requiring rescheduling"
            color="#ef4444"
          />
        </div>

        {/* Analytics Tabs */}
        <AnalyticsTabs
          activityData={activityData}
          completionTrend={completionTrend}
          productivityPatterns={productivityPatterns}
          reschedulingAnalysis={reschedulingAnalysis}
          timeRange={timeRange}
          onDayClick={(date) => {
            // TODO: Navigate to daily detail view
          }}
          onTimeRangeChange={(range) => {
            setTimeRange(range)
          }}
        />
      </main>
    </div>
  )
}

