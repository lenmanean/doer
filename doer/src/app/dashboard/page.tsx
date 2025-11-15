'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogOut, Calendar, Upload, Activity, Target, Clock, TrendingUp, Award, CheckCircle, Star, Zap, Users, BarChart3, Plus, TrendingDown, ExternalLink, RefreshCw } from 'lucide-react'
// import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { supabase } from '@/lib/supabase/client'
import { parseDateFromDB, formatDateForDisplay } from '@/lib/date-utils'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useCountUp } from '@/hooks/useCountUp'
import { HealthModal } from '@/components/ui/HealthModal'
import { PulseOrb } from '@/components/ui/PulseOrb'
import { HealthCountdownTimer } from '@/components/ui/HealthCountdownTimer'
// FloatingInsightCard removed - using inline insights instead
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { SwitchPlanModal } from '@/components/ui/SwitchPlanModal'
import { motion, AnimatePresence } from 'framer-motion'
import { useGlobalPendingReschedules } from '@/hooks/useGlobalPendingReschedules'
import { Bell } from 'lucide-react'
import { isEmailConfirmed } from '@/lib/email-confirmation'
import { PlanSelectionOverlay, shouldShowPlanOverlay } from '@/components/ui/PlanSelectionOverlay'
// Removed direct import - using API route instead
import { useToast } from '@/components/ui/Toast'

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useToast()
  const [isClient, setIsClient] = useState(false)
  // Health metrics (degrading health model)
  const [healthScore, setHealthScore] = useState(100)
  const [hasScheduledTasks, setHasScheduledTasks] = useState(false)
  const [progress, setProgress] = useState(0)
  const [consistency, setConsistency] = useState(0)
  const [efficiency, setEfficiency] = useState<number | null>(0)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [healthColor, setHealthColor] = useState('#10b981') // Start green
  const [healthHistory, setHealthHistory] = useState<any>(null)
  const [todayTasks, setTodayTasks] = useState<Array<{id: string, text: string, completed: boolean, dbTask?: boolean, scheduled_date?: string, estimated_duration_minutes?: number, complexity_score?: number}>>([])
  const [tasksGlowing, setTasksGlowing] = useState(false)
  const [recentActivities, setRecentActivities] = useState<Array<any>>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [notifications, setNotifications] = useState<Array<any>>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  
  // New plan system state
  const [activePlan, setActivePlan] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [loadPlansError, setLoadPlansError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSwitchPlanModal, setShowSwitchPlanModal] = useState(false)
  
  // Tasks state for Goal Panel
  const [planTasks, setPlanTasks] = useState<Array<{id: string, name: string, idx: number, completed: boolean, schedule_date?: string, start_time?: string, end_time?: string}>>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [hoveredTaskIndex, setHoveredTaskIndex] = useState<number | null>(null)
  
  // Cycling insights state
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0)
  const [cyclingInsights, setCyclingInsights] = useState<string[]>([])
  
  // Smart scheduling state
  const [schedulingStats, setSchedulingStats] = useState<any>(null)
  const [smartSchedulingEnabled, setSmartSchedulingEnabled] = useState(true)
  
  // Count-up animation for health score display
  const animatedValue = useCountUp(healthScore, 800)
  
  // Use onboarding protection hook
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  
  // Also check provider loading state - don't show fallback if provider is still loading
  const { loading: providerLoading } = useSupabase()
  
  // Use global hook to check for pending reschedules (for sidebar badge)
  const { hasPending: hasPendingReschedules } = useGlobalPendingReschedules(user?.id || null)
  
  // State for email confirmation status
  const [emailConfirmed, setEmailConfirmed] = useState(true)
  
  // Plan selection overlay state
  const [showPlanOverlay, setShowPlanOverlay] = useState(false)
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null)
  
  // Track if upgrade notification has been shown to prevent duplicates
  const upgradeNotificationShown = useRef(false)
  
  // Refresh email confirmation status - check immediately and on user changes
  useEffect(() => {
    if (!user) {
      setEmailConfirmed(true) // Default to true if no user
      return
    }
    
    const checkEmailStatus = async () => {
      try {
        // Get fresh user data to ensure we have latest email_confirmed_at
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('[Dashboard] Error getting user for email check:', error)
          // Fallback to checking the user we have
          const confirmed = isEmailConfirmed(user)
          setEmailConfirmed(confirmed)
          return
        }
        
        if (currentUser) {
          const confirmed = isEmailConfirmed(currentUser)
          if (process.env.NODE_ENV === 'development') {
            console.log('[Dashboard] Email confirmation status:', {
              userId: currentUser.id,
              email: currentUser.email,
              confirmed,
              email_confirmed_at: currentUser.email_confirmed_at
            })
          }
          setEmailConfirmed(confirmed)
        } else {
          // Fallback to checking the user we have
          const confirmed = isEmailConfirmed(user)
          setEmailConfirmed(confirmed)
        }
      } catch (error) {
        console.error('[Dashboard] Error checking email status:', error)
        // Fallback to checking the user we have
        const confirmed = isEmailConfirmed(user)
        setEmailConfirmed(confirmed)
      }
    }
    
    // Check immediately
    checkEmailStatus()
    
    // Listen for auth state changes to update email confirmation status
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Dashboard] Auth state changed:', event)
        }
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          const { data: { user: currentUser } } = await supabase.auth.getUser()
          if (currentUser) {
            const confirmed = isEmailConfirmed(currentUser)
            if (process.env.NODE_ENV === 'development') {
              console.log('[Dashboard] Updated email confirmation status:', confirmed)
            }
            setEmailConfirmed(confirmed)
          }
        }
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [user?.id]) // Re-run when user ID changes

  // Check subscription status and show plan overlay if needed
  useEffect(() => {
    if (!user?.id || loading || providerLoading) return

    const checkSubscription = async () => {
      try {
        // Use API route instead of direct client-side call (server-side only function)
        const response = await fetch('/api/subscription', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to check subscription')
        }

        const data = await response.json()
        const hasSubscription = data.subscription !== null
        setHasActiveSubscription(hasSubscription)

        // Show overlay if: no subscription AND hasn't been dismissed AND should show
        if (!hasSubscription && shouldShowPlanOverlay()) {
          setShowPlanOverlay(true)
        }
      } catch (error) {
        console.error('[Dashboard] Error checking subscription:', error)
        // On error, assume no subscription and show overlay if not dismissed
        setHasActiveSubscription(false)
        if (shouldShowPlanOverlay()) {
          setShowPlanOverlay(true)
        }
      }
    }

    checkSubscription()
  }, [user?.id, loading, providerLoading])

  // Success notification for plan upgrade
  useEffect(() => {
    const upgraded = searchParams.get('upgraded')
    const planSlug = searchParams.get('plan')

    if (upgraded === 'true' && planSlug && !upgradeNotificationShown.current) {
      const planName = planSlug === 'pro' ? 'Pro' : 'Basic'
      upgradeNotificationShown.current = true
      
      addToast({
        type: 'success',
        title: 'Plan Upgraded Successfully!',
        description: `Your plan has been successfully upgraded to ${planName}.`,
        duration: 7000,
      })

      // Clear URL params immediately to prevent re-triggering
      router.replace('/dashboard', { scroll: false })
      
      // Reset the ref after a delay to allow for page reloads/navigation
      setTimeout(() => {
        upgradeNotificationShown.current = false
      }, 5000)
    }
  }, [searchParams, router, addToast])

  // Check for overdue tasks and auto-reschedule
  // IMPORTANT: Check BOTH plan tasks AND free-mode tasks
  useEffect(() => {
    if (!user?.id) return
    
    const checkAndRescheduleOverdue = async () => {
      try {
        // Always check free-mode tasks (planId = null)
        console.log('[Dashboard] Checking for overdue free-mode tasks...', { userId: user.id })
        const freeModeResponse = await fetch('/api/tasks/reschedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: null })
        })

        if (freeModeResponse.ok) {
          const freeModeData = await freeModeResponse.json()
          console.log('[Dashboard] Free-mode reschedule check:', {
            success: freeModeData.success,
            resultsCount: freeModeData.results?.length || 0
          })
          if (freeModeData.success && freeModeData.results && freeModeData.results.length > 0) {
            console.log(`✅ Created ${freeModeData.results.length} free-mode reschedule proposal(s)`)
          }
        }

        // Also check plan tasks if there's an active plan
        if (activePlan?.id) {
          console.log('[Dashboard] Checking for overdue plan tasks...', { planId: activePlan.id, userId: user.id })
          const planResponse = await fetch('/api/tasks/reschedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: activePlan.id })
          })

          if (planResponse.ok) {
            const planData = await planResponse.json()
            console.log('[Dashboard] Plan reschedule check:', {
              success: planData.success,
              resultsCount: planData.results?.length || 0
            })
            if (planData.success && planData.results && planData.results.length > 0) {
              console.log(`✅ Created ${planData.results.length} plan reschedule proposal(s)`)
            }
          }
        }

        // Real-time subscription will automatically fetch pending reschedules when proposals change
        // No need to manually refetch here to avoid infinite loops
      } catch (error) {
        console.error('[Dashboard] Error checking overdue tasks:', error)
      }
    }

    // Check immediately on mount
    checkAndRescheduleOverdue()
    
    // Also check every 30 seconds
    const interval = setInterval(checkAndRescheduleOverdue, 30000)

    return () => clearInterval(interval)
  }, [user?.id, activePlan?.id]) // Removed refetchPending to prevent infinite loops

  // Note: Reschedule approval modal only shows on schedule page, not dashboard
  
  // Load plans using the new system with retry logic
  const loadPlans = async (retryCount = 0): Promise<boolean> => {
    if (!user?.id) return false
    
    const MAX_RETRIES = 3
    const TIMEOUT_MS = 15000 // 15 seconds
    
    try {
      setLoadingPlans(true)
      setLoadPlansError(null)
      console.log(`[Dashboard] Loading plans (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`)
      
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
      
      const response = await fetch('/api/plans/list', {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        console.log('[Dashboard] Plans loaded successfully:', {
          count: data.plans?.length || 0,
          plans: data.plans?.map((p: any) => ({ id: p.id, status: p.status }))
        })
        setPlans(data.plans || [])
        
        // Find active plan
        const active = data.plans?.find((plan: any) => plan.status === 'active')
        setActivePlan(active || null)
        setLoadingPlans(false)
        setLoadPlansError(null)
        return true
      } else {
        throw new Error(`Failed to load plans: ${response.status} ${response.statusText}`)
      }
    } catch (error: any) {
      console.error(`[Dashboard] Error loading plans (attempt ${retryCount + 1}):`, error)
      
      // Check if it's a timeout or network error
      const isTimeout = error.name === 'AbortError'
      const isNetworkError = error instanceof TypeError
      
      // Retry with exponential backoff for timeout/network errors
      if ((isTimeout || isNetworkError) && retryCount < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000) // Max 5 seconds
        console.log(`[Dashboard] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return loadPlans(retryCount + 1)
      }
      
      // Max retries reached or non-retryable error
      setLoadingPlans(false)
      
      // Set error state for UI display
      if (isTimeout) {
        setLoadPlansError('The dashboard is taking longer than expected to load. Please check your internet connection.')
      } else if (isNetworkError) {
        setLoadPlansError('Unable to connect to the server. Please check your internet connection.')
      } else {
        setLoadPlansError('Failed to load your plans. Please try again or contact support if the issue persists.')
      }
      
      return false
    }
  }

  // Load tasks for the active plan
  const loadPlanTasks = async () => {
    if (!activePlan?.id || !user?.id) {
      setPlanTasks([])
      return
    }
    
    try {
      setLoadingTasks(true)
      
      // Fetch tasks with their schedule data
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, name, idx')
        .eq('plan_id', activePlan.id)
        .order('idx', { ascending: true })
      
      if (tasksError) {
        console.error('Error loading plan tasks:', tasksError)
        setPlanTasks([])
        return
      }
      
      // Fetch schedule data for each task
      const taskIds = tasks?.map(t => t.id) || []
      const { data: schedules, error: schedulesError } = await supabase
        .from('task_schedule')
        .select('task_id, date, start_time, end_time')
        .eq('plan_id', activePlan.id)
        .in('task_id', taskIds)
      
      if (schedulesError) {
        console.error('Error loading task schedules:', schedulesError)
      }
      
      // Fetch completion status - match by task_id, scheduled_date, and plan_id
      // Note: task_completions uses scheduled_date (not just task_id)
      const { data: completions, error: completionsError } = await supabase
        .from('task_completions')
        .select('task_id, scheduled_date, plan_id')
        .eq('user_id', user.id)
        .eq('plan_id', activePlan.id)
        .in('task_id', taskIds)
      
      if (completionsError) {
        console.error('Error loading task completions:', completionsError)
      }
      
      // Create maps for easy lookup - for multiple schedules per task, get the earliest upcoming date
      const scheduleMap = new Map<string, {date: string, start_time?: string, end_time?: string}>()
      const today = new Date().toISOString().split('T')[0]
      schedules?.forEach(schedule => {
        const existing = scheduleMap.get(schedule.task_id)
        if (!existing) {
          scheduleMap.set(schedule.task_id, {
            date: schedule.date,
            start_time: schedule.start_time,
            end_time: schedule.end_time
          })
        } else {
          // If task has multiple schedules, keep the earliest upcoming one
          const existingDate = existing.date
          const newDate = schedule.date
          if (newDate >= today && (existingDate < today || newDate < existingDate)) {
            scheduleMap.set(schedule.task_id, {
              date: schedule.date,
              start_time: schedule.start_time,
              end_time: schedule.end_time
            })
          }
        }
      })
      
      // Create completion map: key is task_id-scheduled_date (for plan-based tasks)
      const completionMap = new Set<string>()
      completions?.forEach(completion => {
        const key = `${completion.task_id}-${completion.scheduled_date}`
        completionMap.add(key)
      })
      
      // Enrich tasks with schedule and completion data
      const enrichedTasks = tasks?.map(task => {
        const schedule = scheduleMap.get(task.id)
        const scheduleDate = schedule?.date
        // Check completion: match by task_id and scheduled_date
        const completionKey = scheduleDate ? `${task.id}-${scheduleDate}` : null
        const isCompleted = completionKey ? completionMap.has(completionKey) : false
        
        return {
          ...task,
          completed: isCompleted,
          schedule_date: scheduleDate,
          start_time: schedule?.start_time,
          end_time: schedule?.end_time
        }
      }) || []
      
      setPlanTasks(enrichedTasks)
    } catch (error) {
      console.error('Error loading plan tasks:', error)
      setPlanTasks([])
    } finally {
      setLoadingTasks(false)
    }
  }

  // Load scheduling statistics
  const loadSchedulingStats = async (planId: string) => {
    try {
      const response = await fetch(`/api/scheduling/history?planId=${planId}`)
      if (response.ok) {
        const data = await response.json()
        const history = data.history || []
        
        // Calculate stats
        const totalAdjustments = history.length
        const totalDaysExtended = history.reduce((sum: number, entry: any) => sum + (entry.daysExtended || 0), 0)
        const totalTasksRescheduled = history.reduce((sum: number, entry: any) => sum + (entry.tasksRescheduled || 0), 0)
        const lastAdjustment = history.length > 0 ? history[0] : null
        
        setSchedulingStats({
          totalAdjustments,
          totalDaysExtended,
          totalTasksRescheduled,
          lastAdjustment,
          hasBeenAdjusted: totalAdjustments > 0
        })
      }
    } catch (error) {
      console.error('Error loading scheduling stats:', error)
    }
  }

  // Check smart scheduling status
  const checkSmartSchedulingStatus = async () => {
    try {
      const response = await fetch('/api/settings/smart-scheduling')
      if (response.ok) {
        const data = await response.json()
        setSmartSchedulingEnabled(data.smartSchedulingEnabled)
      }
    } catch (error) {
      console.error('Error checking smart scheduling status:', error)
    }
  }

  useEffect(() => {
    setIsClient(true)
    if (user?.id && !providerLoading) {
      // Add a small delay to ensure auth session is fully initialized
      const timer = setTimeout(() => {
        console.log('[Dashboard] User authenticated, loading plans...')
        loadPlans()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [user?.id, providerLoading])

  // Load tasks when active plan changes
  useEffect(() => {
    if (activePlan?.id && !loadingPlans) {
      loadPlanTasks()
    } else {
      setPlanTasks([])
    }
  }, [activePlan?.id, loadingPlans])

  // Load scheduling data when plan is available
  useEffect(() => {
    if (activePlan?.id) {
      loadSchedulingStats(activePlan.id)
      checkSmartSchedulingStatus()
    }
  }, [activePlan?.id])


  // Load today's tasks from the database when active plan is available
  useEffect(() => {
    const loadTodayTasks = async () => {
      if (activePlan && user?.id) {
        try {
          // For now, just set empty tasks since we're using the schedule system
          setTodayTasks([])
        } catch (error) {
          console.error('Error loading today tasks:', error)
        }
      }
    }

    if (!loadingPlans) {
      loadTodayTasks()
    }
  }, [activePlan, loadingPlans])
  
  // Generate cycling insights based on health metrics (memoized to prevent erratic cycling)
  useEffect(() => {
    if (activePlan && !loadingHealth) {
      const insights: string[] = []
      
      // Calculate metric changes from history
      if (healthHistory) {
        // Efficiency change
        if (healthHistory.efficiency && healthHistory.efficiency.length > 1) {
          const latestEff = (healthHistory.efficiency[healthHistory.efficiency.length - 1] as any)?.value || 0
          const earliestEff = (healthHistory.efficiency[0] as any)?.value || 0
          const effChange = latestEff - earliestEff
          if (Math.abs(effChange) > 0.5) {
            insights.push(`Efficiency ${effChange > 0 ? 'up' : 'down'} ${Math.abs(effChange).toFixed(1)}%`)
          }
        }
        
        // Progress change this week
        if (healthHistory.progress && healthHistory.progress.length > 1) {
          const latestProg = (healthHistory.progress[healthHistory.progress.length - 1] as any)?.value || 0
          const earliestProg = (healthHistory.progress[0] as any)?.value || 0
          const progChange = latestProg - earliestProg
          if (Math.abs(progChange) > 0.5) {
            insights.push(`${progChange > 0 ? '+' : ''}${progChange.toFixed(1)}% progress this week`)
          }
        }
        
        // Consistency change
        if (healthHistory.consistency && healthHistory.consistency.length > 1) {
          const latestCons = (healthHistory.consistency[healthHistory.consistency.length - 1] as any)?.value || 0
          const earliestCons = (healthHistory.consistency[0] as any)?.value || 0
          const consChange = latestCons - earliestCons
          if (Math.abs(consChange) > 0.5) {
            insights.push(`${consChange > 0 ? '+' : ''}${consChange.toFixed(1)}% consistency this week`)
          }
        }
      }
      
      // Day streak
      if (consistency >= 30) {
        const dayStreak = Math.round(consistency / 10)
        insights.push(`${dayStreak} day streak`)
      }
      
      // Default insight if none generated
      if (insights.length === 0) {
        insights.push('No insights yet')
      }
      
      setCyclingInsights(insights)
    } else {
      setCyclingInsights(['No insights yet'])
    }
  }, [activePlan, loadingHealth, healthHistory, efficiency, consistency, progress, healthScore])
  
  // Cycle through insights
  useEffect(() => {
    if (cyclingInsights.length > 1) {
      const interval = setInterval(() => {
        setCurrentInsightIndex((prev) => (prev + 1) % cyclingInsights.length)
      }, 3000) // Change insight every 3 seconds
      
      return () => clearInterval(interval)
    }
  }, [cyclingInsights])

  // Load next upcoming milestone and its tasks
  useEffect(() => {
    const loadNextMilestone = async () => {
      if (activePlan) {
        try {
          // Milestones are no longer used - set empty state
          // This function is kept for compatibility but does nothing
        } catch (error) {
          console.error('Error loading next milestone:', error)
        }
      }
    }

    if (!loadingPlans) {
      loadNextMilestone()
    }
  }, [activePlan, loadingPlans])

  // Load notifications (recent activity) - extracted to useCallback so it can be called from multiple places
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setLoadingNotifications(true)
      const allNotifications: any[] = []
      
      // 1. Load recent task completions (both plan-based and free-mode)
      const { data: completions } = await supabase
        .from('task_completions')
        .select(`
          id,
          task_id,
          plan_id,
          completed_at,
          tasks (
            name,
            plan_id
          )
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(10)
      
      if (completions) {
        completions.forEach((completion: any) => {
          allNotifications.push({
            id: completion.id,
            type: 'task_completion',
            message: `Completed task: ${completion.tasks?.name || 'Unknown task'}`,
            timestamp: completion.completed_at,
            planId: completion.plan_id
          })
        })
      }
      
      // 2. Load recent pending reschedule proposals
      try {
        const { data: pendingReschedules, error: rescheduleError } = await supabase
          .from('pending_reschedules')
          .select(`
            id,
            plan_id,
            created_at,
            status,
            task_id,
            tasks (
              name
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (rescheduleError) {
          console.warn('Error loading pending reschedules for notifications:', rescheduleError)
        } else if (pendingReschedules) {
          pendingReschedules.forEach((proposal: any) => {
            // Handle both array and object cases for the join
            const task = Array.isArray(proposal.tasks) ? proposal.tasks[0] : proposal.tasks
            const taskName = task?.name || 'Unknown task'
            allNotifications.push({
              id: proposal.id,
              type: 'reschedule_proposal',
              message: `Reschedule proposal: ${taskName}`,
              timestamp: proposal.created_at,
              planId: proposal.plan_id
            })
          })
        }
      } catch (error) {
        console.warn('Error loading pending reschedules for notifications:', error)
        // Continue loading other notifications even if this fails
      }
      
      // 3. Load recent scheduling history (plan adjustments)
      if (activePlan?.id) {
        const { data: schedulingHistory } = await supabase
          .from('scheduling_history')
          .select('id, adjustment_date, days_extended, tasks_rescheduled, created_at')
          .eq('user_id', user.id)
          .eq('plan_id', activePlan.id)
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (schedulingHistory) {
          schedulingHistory.forEach((history: any) => {
            allNotifications.push({
              id: history.id,
              type: 'schedule_adjustment',
              message: `Plan adjusted: ${history.days_extended} days extended, ${history.tasks_rescheduled} tasks rescheduled`,
              timestamp: history.created_at,
              planId: activePlan.id
            })
          })
        }
      }
      
      // 4. Load recent plan status changes
      const { data: planUpdates } = await supabase
        .from('plans')
        .select('id, goal_text, status, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5)
      
      if (planUpdates) {
        planUpdates.forEach((plan: any) => {
          if (plan.status === 'active' || plan.status === 'completed') {
            allNotifications.push({
              id: `plan-${plan.id}`,
              type: 'plan_status',
              message: plan.status === 'completed' 
                ? `Plan completed: ${plan.goal_text}`
                : `Plan updated: ${plan.goal_text}`,
              timestamp: plan.updated_at,
              planId: plan.id
            })
          }
        })
      }
      
      // Sort all notifications by timestamp (most recent first) and limit to 20
      allNotifications.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      
      setNotifications(allNotifications.slice(0, 20))
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoadingNotifications(false)
    }
  }, [user?.id, activePlan?.id])

  // Load notifications on mount and when active plan changes
  useEffect(() => {
    if (!loadingPlans && user?.id) {
      loadNotifications()
    }
  }, [activePlan, loadingPlans, user?.id, loadNotifications])
  
  // Reload notifications when plan tasks change (to catch completion updates)
  useEffect(() => {
    if (user?.id && !loadingPlans) {
      loadNotifications()
    }
  }, [planTasks.length, user?.id, loadingPlans, loadNotifications])

  // Load health metrics (degrading health model)
  useEffect(() => {
    const loadHealthMetrics = async () => {
      if (user?.id && activePlan) {
        try {
          setLoadingHealth(true)
          // Mock health metrics for now - can be implemented later
          setHealthScore(85)
          setHasScheduledTasks(true)
          setProgress(75)
          setConsistency(80)
          setEfficiency(70)
          setHealthHistory([])
          
          // Set health color based on health score (degrading health model)
          if (!true) { // hasScheduledTasks is true
            setHealthColor('#9ca3af') // gray - no tasks scheduled
          } else if (85 >= 80) {
            setHealthColor('#10b981') // green - excellent health
          } else if (85 >= 60) {
            setHealthColor('#f59e0b') // yellow/orange - health degrading
          } else {
            setHealthColor('#ef4444') // red - critical health
          }
          
        } catch (error) {
          console.error('Error loading health metrics:', error)
          // Set default values on error
          setHealthScore(100)
          setHasScheduledTasks(false)
          setProgress(0)
          setConsistency(0)
          setEfficiency(null)
          setHealthColor('#9ca3af')
        } finally {
          setLoadingHealth(false)
        }
      }
    }

    loadHealthMetrics()
  }, [user?.id, activePlan?.id])

  // OLD INSIGHTS LOGIC REMOVED - Using new metric-based insights above (lines 118-182)

  // Realtime subscription for auto-refresh when tasks change
  useEffect(() => {
    if (!user?.id || !activePlan?.id) return
    
    const channel = supabase
      .channel('plan_update')
      .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'task_completions',
            filter: `plan_id=eq.${activePlan.id}`
          },
          async (payload) => {
            // Refresh health metrics
            const loadHealthMetrics = async () => {
              try {
                // Mock health metrics for now - can be implemented later
                setHealthScore(85)
                setHasScheduledTasks(true)
                setProgress(75)
                setConsistency(80)
                setEfficiency(70)
                setHealthHistory([])
                
                // Set color based on health score (degrading health model)
                if (!true) setHealthColor('#9ca3af') // hasScheduledTasks is true
                else if (85 >= 80) setHealthColor('#10b981')
                else if (85 >= 60) setHealthColor('#f59e0b')
                else setHealthColor('#ef4444')
              } catch (error) {
                console.error('Error refreshing health metrics:', error)
              }
            }
            loadHealthMetrics()
            
            // For now, just set empty tasks since we're using the schedule system
            setTodayTasks([])
            
            // Also reload plans and plan tasks
            loadPlans()
            loadPlanTasks()
          })
      .subscribe()
    
    return () => { 
      supabase.removeChannel(channel) 
    }
  }, [user?.id, activePlan?.id])


  const toggleTask = async (taskId: any, isMilestoneTask = false) => {
    // For now, just toggle the UI state
    // The schedule page handles task completion updates
    if (!isMilestoneTask) {
      setTodayTasks(prevTasks => {
        const updatedTasks = prevTasks.map(task => 
          task.id === taskId ? { ...task, completed: !task.completed } : task
        )
        
        // Check if all tasks are completed
        const allCompleted = updatedTasks.every(task => task.completed)
        if (allCompleted) {
          setTasksGlowing(true)
          // Reset glow after 2 seconds
          setTimeout(() => setTasksGlowing(false), 2000)
        }
        
        return updatedTasks
      })
    }
  }

  const getCurrentDate = () => {
    const today = new Date()
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
  // Show loading state - wait for auth to be resolved on the client
  const authLoading = loading || providerLoading
  
  if (!isClient) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--foreground)]">Loading...</div>
      </div>
    )
  }
  
  // Only block the dashboard while we genuinely don't have a user yet.
  if (authLoading && !user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--foreground)]">Loading...</div>
      </div>
    )
  }
  
  // If loading is false but no user, the hook will handle redirect
  // Don't show loading here - let the hook redirect to login
  if (!authLoading && !user) {
    // Hook will redirect, but show a brief message while redirect happens
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--foreground)]">Redirecting...</div>
      </div>
    )
  }
  
  // Dashboard now uses real data from useUserRoadmap hook

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Custom CSS for sequential glow animation */}
      <style jsx>{`
        @keyframes sequential-glow {
          0%, 30% {
            background-color: #6b7280;
          }
          15% {
            background-color: #ffffff;
          }
          30%, 100% {
            background-color: #6b7280;
          }
        }
        
        .animate-sequential-glow {
          animation: sequential-glow 2.4s infinite ease-in-out;
        }
        
        .glow-dot-1 {
          animation-delay: 0s;
        }
        
        .glow-dot-2 {
          animation-delay: 0.4s;
        }
        
        .glow-dot-3 {
          animation-delay: 0.8s;
        }
      `}</style>
      {/* Sidebar */}
      <Sidebar 
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/dashboard"
        hasPendingReschedules={hasPendingReschedules}
        emailConfirmed={emailConfirmed}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaggeredFadeIn>
          {/* Welcome Section */}
          <FadeInWrapper delay={0.1} direction="up">
            <div className="mb-8">
              <h1 className="text-5xl font-bold tracking-tight text-[#d7d2cb] mb-4">
                Welcome back, {profile?.first_name 
                  ? `${profile.first_name}${profile?.last_name ? ` ${profile.last_name}` : ''}`.trim()
                  : user?.email?.split('@')[0] || 'Achiever'}!
              </h1>
              <p className="text-base leading-relaxed text-[#d7d2cb]/70 max-w-prose">
                {activePlan 
                  ? "Ready to make progress on your plans? Let's create something amazing together."
                  : "Start your journey by creating your first plan."}
              </p>
            </div>
          </FadeInWrapper>

        {/* Goal Panel */}
        <FadeInWrapper delay={0.2} direction="up">
          <div className="mb-8">
            <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CardDescription className="text-base">
                    Current Goal
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSwitchPlanModal(true)}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-1 rounded hover:bg-white/5"
                    title="Switch or manage goals"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="text-[#d7d2cb]/60 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5"
                    title="Delete current goal/plan"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Goal Title */}
              {loadPlansError ? (
                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-red-400 mb-1">Failed to Load Plans</h4>
                        <p className="text-sm text-[#d7d2cb]/70">{loadPlansError}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button 
                      onClick={() => loadPlans(0)}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry Loading Plans
                    </Button>
                  </div>
                </div>
              ) : loadingPlans ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-3/4 bg-white/5" />
                  <Skeleton className="h-4 w-full bg-white/5" />
                  <Skeleton className="h-4 w-5/6 bg-white/5" />
                </div>
              ) : !activePlan ? (
                <div>
                  <h3 className="text-5xl font-bold text-[#d7d2cb]/40 mb-4">
                    No Active Plan
                  </h3>
                  <p className="text-sm text-[#d7d2cb]/40 mb-4">
                    You don't have an active plan. Use the switch button above to create a new plan or select an existing one.
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-5xl font-bold text-[var(--primary)] mb-4">
                    {activePlan.summary_data?.goal_text || activePlan.goal_text || 'No goal set'}
                  </h3>
                  <p className="text-sm text-[#d7d2cb]/70">
                    {activePlan.summary_data?.plan_summary || 'Set your goal to get started on your journey.'}
                  </p>
                  
                  {/* Plan Tasks List */}
                  {loadingTasks ? (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <Skeleton className="h-4 w-32 bg-white/5 mb-3" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full bg-white/5" />
                        <Skeleton className="h-4 w-5/6 bg-white/5" />
                        <Skeleton className="h-4 w-4/6 bg-white/5" />
                      </div>
                    </div>
                  ) : planTasks.length > 0 ? (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h4 className="text-xs font-semibold text-[#d7d2cb]/60 uppercase tracking-wide mb-3">
                        Plan Tasks
                      </h4>
                      <ol className="space-y-2 list-none">
                        {planTasks.map((task, index) => {
                          const handleTaskToggle = async () => {
                            if (!user?.id || !activePlan?.id || !task.schedule_date) return
                            
                            try {
                              const isCurrentlyCompleted = task.completed
                              
                              if (isCurrentlyCompleted) {
                                // Mark as incomplete: delete the completion record
                                const { error } = await supabase
                                  .from('task_completions')
                                  .delete()
                                  .eq('user_id', user.id)
                                  .eq('task_id', task.id)
                                  .eq('plan_id', activePlan.id)
                                  .eq('scheduled_date', task.schedule_date)
                                
                                if (error) {
                                  console.error('Error removing task completion:', error)
                                  return
                                }
                              } else {
                                // Mark as complete: insert a completion record
                                const { error } = await supabase
                                  .from('task_completions')
                                  .insert({
                                    user_id: user.id,
                                    task_id: task.id,
                                    plan_id: activePlan.id,
                                    scheduled_date: task.schedule_date,
                                    completed_at: new Date().toISOString()
                                  })
                                
                                if (error) {
                                  console.error('Error inserting task completion:', error)
                                  return
                                }
                              }
                              
                              // Reload plan tasks and notifications
                              loadPlanTasks()
                              loadNotifications()
                            } catch (error) {
                              console.error('Error toggling task completion:', error)
                            }
                          }
                          
                          return (
                          <li 
                            key={task.id} 
                            className="relative text-sm leading-relaxed flex items-center group cursor-pointer"
                            onMouseEnter={() => setHoveredTaskIndex(index)}
                            onMouseLeave={() => setHoveredTaskIndex(null)}
                            onClick={handleTaskToggle}
                          >
                            <span className="text-[var(--primary)] mr-2 font-semibold">
                              {index + 1}.
                            </span>
                            <span className={`text-[#d7d2cb]/80 ${task.completed ? 'line-through text-[#d7d2cb]/40' : ''}`}>
                              {task.name}
                            </span>
                            
                            {/* Hover Date/Time Display - Inline after task title */}
                            {hoveredTaskIndex === index && (task.schedule_date || task.start_time || task.end_time) && (
                              <AnimatePresence>
                                <motion.span
                                  initial={{ opacity: 0, x: -5 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -5 }}
                                  transition={{ duration: 0.2 }}
                                  className="ml-2 text-xs text-[#d7d2cb]/60 flex items-center gap-2"
                                >
                                  {task.schedule_date && (
                                    <span className="whitespace-nowrap">
                                      {formatDateForDisplay(parseDateFromDB(task.schedule_date), {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  )}
                                  {(task.start_time || task.end_time) && (
                                    <span className="whitespace-nowrap">
                                      {(() => {
                                        const formatTime = (time: string | undefined) => {
                                          if (!time) return ''
                                          const [hours, minutes] = time.split(':')
                                          const hour = parseInt(hours)
                                          const ampm = hour >= 12 ? 'PM' : 'AM'
                                          const hour12 = hour % 12 || 12
                                          return `${hour12}:${minutes} ${ampm}`
                                        }
                                        
                                        if (task.start_time && task.end_time) {
                                          return `${formatTime(task.start_time)} - ${formatTime(task.end_time)}`
                                        } else if (task.start_time) {
                                          return formatTime(task.start_time)
                                        }
                                        return ''
                                      })()}
                                    </span>
                                  )}
                                </motion.span>
                              </AnimatePresence>
                            )}
                          </li>
                          )
                        })}
                      </ol>
                    </div>
                  ) : null}
                </div>
              )}
              
              {/* Date Range and Days Left - Individual Panels */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-[#d7d2cb]/60" />
                    <p className="text-xs text-[#d7d2cb]/60">Start Date</p>
                  </div>
                  {!activePlan ? (
                    <Skeleton className="h-5 w-24 bg-white/5" />
                  ) : (
                    <p className="text-sm font-medium text-[#d7d2cb]">
                      {activePlan.start_date 
                        ? formatDateForDisplay(parseDateFromDB(activePlan.start_date), {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : '—'}
                    </p>
                  )}
                </div>
                
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-[#d7d2cb]/60" />
                    <p className="text-xs text-[#d7d2cb]/60">End Date</p>
                  </div>
                  {!activePlan ? (
                    <Skeleton className="h-5 w-24 bg-white/5" />
                  ) : (
                    <p className="text-sm font-medium text-[#d7d2cb]">
                      {activePlan.end_date
                        ? formatDateForDisplay(parseDateFromDB(activePlan.end_date), {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : '—'}
                    </p>
                  )}
                </div>
                
                <div className="p-3 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-[var(--primary)]" />
                    <p className="text-xs text-[var(--primary)]/70">Days Remaining</p>
                  </div>
                  {!activePlan ? (
                    <Skeleton className="h-5 w-16 bg-[var(--primary)]/5" />
                  ) : (
                    <p className="text-sm font-bold text-[var(--primary)]">
                      {activePlan.end_date ? (() => {
                        const endDate = parseDateFromDB(activePlan.end_date)
                        const today = new Date()
                        const diffTime = endDate.getTime() - today.getTime()
                        const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
                        return `${daysRemaining} days`
                      })() : '—'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </FadeInWrapper>

        {/* Today's Tasks and Recent Activity Grid */}
        <FadeInWrapper delay={0.4} direction="up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Today's Tasks */}
          <div className="flex">
            <Card className={`relative flex flex-col w-full transition-all duration-500 ${tasksGlowing ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : ''}`}>
              {/* External Link Button - Absolute positioned in top-right corner */}
              <button
                onClick={() => router.push('/roadmap')}
                className="absolute top-6 right-6 z-10 text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
                title="View roadmap"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
              
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">
                  Today's Tasks
                </CardTitle>
                <CardDescription>
                  {getCurrentDate()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {!activePlan ? (
                  <div className="text-center py-8">
                    <p className="text-[#d7d2cb]/50 text-sm">
                      No active plan
                    </p>
                    <p className="text-[#d7d2cb]/40 text-xs mt-1">
                      Create a plan to see your tasks
                    </p>
                  </div>
                ) : todayTasks.length > 0 ? (
                  <div className="space-y-3">
                    {todayTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:bg-white/5 ${
                          task.completed 
                            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                            : 'bg-white/5 border-white/10 text-[#d7d2cb]'
                        }`}
                        onClick={() => toggleTask(task.id)}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                          task.completed 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-[#d7d2cb]/30 hover:border-green-400'
                        }`}>
                          {task.completed && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`flex-1 transition-all duration-200 ${
                          task.completed ? 'line-through opacity-70' : ''
                        }`}>
                          {task.text}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-[#d7d2cb]/60 mb-2">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3" />
                    </div>
                    <p className="text-[#d7d2cb]/70 text-sm">
                      No tasks scheduled for today
                    </p>
                    <p className="text-[#d7d2cb]/50 text-xs mt-1">
                      Enjoy your free time or check your roadmap
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="flex">
            <Card className="flex flex-col w-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#d7d2cb]" />
                  <CardTitle className="text-2xl font-semibold">
                    Recent Activity
                  </CardTitle>
                </div>
                <CardDescription>
                  Your recent task completions, reschedules, and plan updates
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {loadingNotifications ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full bg-white/5" />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-[#d7d2cb]/40" />
                    <p className="text-[#d7d2cb]/60 text-sm">
                      No recent activity
                    </p>
                    <p className="text-[#d7d2cb]/40 text-xs mt-1">
                      Complete tasks or make changes to see activity here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {notifications.map((notification) => {
                      const getIcon = () => {
                        switch (notification.type) {
                          case 'task_completion':
                            return <CheckCircle className="w-4 h-4 text-green-400" />
                          case 'reschedule_proposal':
                            return <RefreshCw className="w-4 h-4 text-orange-400" />
                          case 'schedule_adjustment':
                            return <Calendar className="w-4 h-4 text-blue-400" />
                          case 'plan_status':
                            return <Clock className="w-4 h-4 text-purple-400" />
                          default:
                            return <Bell className="w-4 h-4 text-[#d7d2cb]/60" />
                        }
                      }
                      
                      const formatTimeAgo = (timestamp: string) => {
                        const now = new Date()
                        const time = new Date(timestamp)
                        const diffMs = now.getTime() - time.getTime()
                        const diffMins = Math.floor(diffMs / 60000)
                        const diffHours = Math.floor(diffMs / 3600000)
                        const diffDays = Math.floor(diffMs / 86400000)
                        
                        if (diffMins < 1) return 'Just now'
                        if (diffMins < 60) return `${diffMins}m ago`
                        if (diffHours < 24) return `${diffHours}h ago`
                        if (diffDays < 7) return `${diffDays}d ago`
                        return time.toLocaleDateString()
                      }
                      
                      return (
                        <div
                          key={notification.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          <div className="mt-0.5">
                            {getIcon()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#d7d2cb]">
                              {notification.message}
                            </p>
                            <p className="text-xs text-[#d7d2cb]/50 mt-1">
                              {formatTimeAgo(notification.timestamp)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          </div>
        </FadeInWrapper>

        {/* Smart Scheduling Panel - Only show if applicable */}
        {schedulingStats && schedulingStats.hasBeenAdjusted && (
          <FadeInWrapper delay={0.4} direction="up">
            <div className="mb-8">
              <Card className="border-orange-500/20 bg-orange-500/5">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-orange-400" />
                    Smart Scheduling
                  </CardTitle>
                  <CardDescription>
                    Your plan has been automatically adjusted to help you stay on track
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                        <div className="text-2xl font-bold text-orange-400">
                          {schedulingStats.totalAdjustments}
                        </div>
                        <div className="text-sm text-[#d7d2cb]/70">
                          Total Adjustments
                        </div>
                      </div>
                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                        <div className="text-2xl font-bold text-orange-400">
                          {schedulingStats.totalDaysExtended}
                        </div>
                        <div className="text-sm text-[#d7d2cb]/70">
                          Days Extended
                        </div>
                      </div>
                    </div>
                    
                    {schedulingStats.lastAdjustment && (
                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                        <div className="text-sm text-[#d7d2cb]/70 mb-1">Last Adjustment</div>
                        <div className="text-sm text-[#d7d2cb]">
                          {schedulingStats.lastAdjustment.reason?.message || 'Plan was automatically adjusted'}
                        </div>
                        <div className="text-xs text-[#d7d2cb]/60 mt-1">
                          {new Date(schedulingStats.lastAdjustment.adjustmentDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-[#d7d2cb]/60">
                      <RefreshCw className="w-4 h-4" />
                      Smart scheduling is {smartSchedulingEnabled ? 'enabled' : 'disabled'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </FadeInWrapper>
        )}


        </StaggeredFadeIn>
      </main>

      {/* Delete Plan Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          if (!user?.id || !activePlan?.id) return
          
          setIsDeleting(true)
          try {
            // Use the proper API endpoint
            const response = await fetch('/api/plans/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan_id: activePlan.id })
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || 'Failed to delete plan')
            }
            
            const result = await response.json()
            
            // Stay on dashboard and show "no plan" state
            setShowDeleteModal(false)
            setIsDeleting(false)
            // Reload plans to update UI with "no plan" state
            loadPlans()
          } catch (error) {
            console.error('Error deleting plan:', error)
            alert('Failed to delete plan. Please try again.')
            setIsDeleting(false)
            setShowDeleteModal(false)
          }
        }}
        title="Delete Plan"
        description="This will permanently remove all tasks, milestones, and progress data for this plan. Your account will remain active, but you'll need to create a new plan."
        confirmText="Delete Plan"
        isDeleting={isDeleting}
      />

      {/* Reschedule Approval Modal */}

      {/* Switch Plan Modal */}
      <SwitchPlanModal
        isOpen={showSwitchPlanModal}
        onClose={() => setShowSwitchPlanModal(false)}
        hasActivePlan={!!activePlan}
        currentPlanTitle={activePlan?.goal_text}
        onPlanChanged={() => {
          // Reload plans when plan is switched/changed
          loadPlans()
        }}
      />

      {/* Plan Selection Overlay */}
      <PlanSelectionOverlay
        isOpen={showPlanOverlay}
        onClose={() => setShowPlanOverlay(false)}
        userEmail={user?.email}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff7f00] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
