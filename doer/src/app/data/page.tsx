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
import { PlansPanel } from '@/components/ui/PlansPanel'
import { UserDataSummary } from '@/components/ui/UserDataSummary'
import { useGlobalPendingReschedules } from '@/hooks/useGlobalPendingReschedules'
import { isEmailConfirmed } from '@/lib/email-confirmation'
import { signOutClient } from '@/lib/auth/sign-out-client'
import { supabase } from '@/lib/supabase/client'

export default function DataPage() {
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
      console.error('[DataPage] Error signing out:', error)
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

  // Mock data for UI development
  const [activityData, setActivityData] = useState<ActivityHeatmapData[]>([])
  const [completionTrend, setCompletionTrend] = useState<TrendChartData[]>([])
  const [productivityPatterns, setProductivityPatterns] = useState<BarChartData[]>([])
  const [reschedulingAnalysis, setReschedulingAnalysis] = useState<BarChartData[]>([])

  useEffect(() => {
    // Generate mock activity data for last 12 months
    const generateActivityData = (): ActivityHeatmapData[] => {
      const data: ActivityHeatmapData[] = []
      const today = new Date()
      
      for (let i = 365; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        
        // Random activity (0-6 tasks per day)
        const count = Math.floor(Math.random() * 7)
        data.push({
          date: dateStr,
          count,
          tasks: count > 0 ? [`Task ${count}`] : undefined
        })
      }
      
      return data
    }

    // Generate mock completion trend (last 30 days)
    const generateCompletionTrend = (): TrendChartData[] => {
      const data: TrendChartData[] = []
      const today = new Date()
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        data.push({
          date: dateStr,
          value: Math.floor(Math.random() * 40) + 60 // 60-100%
        })
      }
      
      return data
    }

    // Generate mock productivity patterns (by day of week)
    const generateProductivityPatterns = (): BarChartData[] => {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      return days.map(day => ({
        category: day,
        value: Math.floor(Math.random() * 30) + 10
      }))
    }

    // Generate mock rescheduling analysis
    const generateReschedulingAnalysis = (): BarChartData[] => {
      return [
        {
          category: 'This Week',
          value: 15,
          subValues: {
            'First-time': 12,
            'Rescheduled': 3
          }
        },
        {
          category: 'Last Week',
          value: 18,
          subValues: {
            'First-time': 14,
            'Rescheduled': 4
          }
        },
        {
          category: '2 Weeks Ago',
          value: 20,
          subValues: {
            'First-time': 16,
            'Rescheduled': 4
          }
        }
      ]
    }

    setActivityData(generateActivityData())
    setCompletionTrend(generateCompletionTrend())
    setProductivityPatterns(generateProductivityPatterns())
    setReschedulingAnalysis(generateReschedulingAnalysis())
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff7f00]"></div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  // Mock metric values
  const completionRate = 85
  const streak = 12
  const onTimeRate = 92
  const rescheduleRate = 8

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar 
        user={user ? { email: user.email || '' } : undefined}
        onSignOut={handleSignOut}
        currentPath="/data"
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

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 items-start">
          <MetricCard
            title="Completion Rate"
            value={completionRate}
            trend={2.5}
            description="Overall task completion"
            color="#22c55e"
          />
          <MetricCard
            title="Current Streak"
            value={streak}
            trend={3}
            description="Consecutive days with completions"
            color="#3b82f6"
            formatValue={(v) => `${Math.round(v)} days`}
          />
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-center">
            <ProgressRing
              percentage={onTimeRate}
              size={75}
              strokeWidth={8}
              color="#f59e0b"
              showBreakdown={true}
              breakdown={[
                { label: 'On-time', value: 85, color: '#22c55e' },
                { label: 'Late', value: 7, color: '#f59e0b' },
                { label: 'Missed', value: 8, color: '#ef4444' }
              ]}
            />
            <div className="ml-3">
              <div className="text-sm font-medium text-[#d7d2cb]/70 mb-1">On-Time Rate</div>
              <div className="text-2xl font-bold text-[#d7d2cb]">{onTimeRate}%</div>
            </div>
          </div>
          <MetricCard
            title="Reschedule Rate"
            value={rescheduleRate}
            trend={-1.2}
            description="Tasks requiring rescheduling"
            color="#ef4444"
          />
        </div>

        {/* Activity Heatmap */}
        <Card className="bg-white/5 border-white/10 mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-[#d7d2cb]">
              Activity Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4 overflow-visible">
            <ActivityHeatmap
              data={activityData}
              onDayClick={(date) => {
                console.log('Clicked date:', date)
                // TODO: Navigate to daily detail view
              }}
            />
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#d7d2cb]">
                Completion Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={completionTrend}
                title=""
                color="#22c55e"
                timeRange="30d"
                onTimeRangeChange={(range) => {
                  console.log('Time range changed:', range)
                  // TODO: Update data based on time range
                }}
              />
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#d7d2cb]">
                Productivity Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={productivityPatterns}
                title=""
                colors={['#3b82f6']}
              />
            </CardContent>
          </Card>
        </div>

        {/* Rescheduling Analysis */}
        <Card className="bg-white/5 border-white/10 mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#d7d2cb]">
              Rescheduling Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={reschedulingAnalysis}
              title=""
              stacked={true}
              colors={['#22c55e', '#f59e0b']}
            />
          </CardContent>
        </Card>

        {/* Plans Panel and User Data Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlansPanel />
          {user?.id && <UserDataSummary userId={user.id} />}
        </div>
      </main>
    </div>
  )
}

