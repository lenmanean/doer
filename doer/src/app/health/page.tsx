'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useUserRoadmap } from '@/hooks/useUserRoadmap'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sidebar } from '@/components/ui/Sidebar'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, TrendingUp, Calendar, Target } from 'lucide-react'
import { useGlobalPendingReschedules } from '@/hooks/useGlobalPendingReschedules'
import { isEmailConfirmed } from '@/lib/email-confirmation'
import { signOutClient } from '@/lib/auth/sign-out-client'

export default function HealthPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useSupabase()
  const { roadmapData, loading } = useUserRoadmap(user?.id || null)
  const [healthMetrics, setHealthMetrics] = useState<any>(null)
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
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading) return
    
    if (!user) {
      router.push('/login')
      return
    }
        
    if (roadmapData?.plan?.id) {
      // Fetch health metrics for the active plan
      fetchHealthMetrics(roadmapData.plan.id)
    }
  }, [user, roadmapData, router, authLoading])

  const fetchHealthMetrics = async (planId: string) => {
    try {
      // This would fetch actual health metrics from the database
      // For now, we'll use mock data
      setHealthMetrics({
        overallScore: 85,
        consistencyScore: 90,
        efficiencyScore: 80,
        progressScore: 85
      })
    } catch (error) {
      console.error('Error fetching health metrics:', error)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff7f00]"></div>
      </div>
    )
  }

  if (!roadmapData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        {/* Sidebar */}
        <Sidebar 
          user={user ? { email: user.email || '' } : undefined}
          onSignOut={handleSignOut}
          currentPath="/health"
        />
        
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#d7d2cb] mb-4">No Active Plan</h2>
            <p className="text-[#d7d2cb]/70 mb-6">You need an active plan to view health metrics.</p>
            <Button onClick={() => router.push('/onboarding')}>
              Create Your First Plan
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <Sidebar 
        user={user ? { email: user.email || '' } : undefined}
        onSignOut={handleSignOut}
        currentPath="/health"
        hasPendingReschedules={hasPendingReschedules}
        emailConfirmed={emailConfirmed}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-4 border-white/20 text-[#d7d2cb] hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-[#d7d2cb]">Health Metrics</h1>
          <p className="text-[#d7d2cb]/70 mt-2">
            Track your progress and performance for: {roadmapData.plan.goal_text}
          </p>
        </div>

        {/* Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#d7d2cb]">Overall Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#d7d2cb]/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#d7d2cb]">{healthMetrics?.overallScore || 0}%</div>
              <p className="text-xs text-[#d7d2cb]/60">
                Based on consistency, efficiency, and progress
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#d7d2cb]">Consistency</CardTitle>
              <Calendar className="h-4 w-4 text-[#d7d2cb]/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#d7d2cb]">{healthMetrics?.consistencyScore || 0}%</div>
              <p className="text-xs text-[#d7d2cb]/60">
                How regularly you complete tasks
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#d7d2cb]">Efficiency</CardTitle>
              <Target className="h-4 w-4 text-[#d7d2cb]/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#d7d2cb]">{healthMetrics?.efficiencyScore || 0}%</div>
              <p className="text-xs text-[#d7d2cb]/60">
                How well you manage your time
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#d7d2cb]">Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#d7d2cb]/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#d7d2cb]">{healthMetrics?.progressScore || 0}%</div>
              <p className="text-xs text-[#d7d2cb]/60">
                Milestone completion rate
              </p>
            </CardContent>
          </Card>
                  </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-[#d7d2cb]">Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-[#d7d2cb]/60">
                Performance trends chart would go here
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-[#d7d2cb]">Task Completion History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-[#d7d2cb]/60">
                Task completion history would go here
              </div>
            </CardContent>
          </Card>
        </div>
            </div>
    </div>
  )
}