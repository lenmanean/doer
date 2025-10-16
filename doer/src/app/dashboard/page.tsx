'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Calendar, Upload, Activity, Target, Clock, TrendingUp, Award, CheckCircle, Star, Zap, Users, BarChart3, Plus, TrendingDown, ExternalLink } from 'lucide-react'
// import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { useUserRoadmap } from '@/hooks/useUserRoadmap'
import { getTodayTasks, getMilestoneCompletionStatus, getTasksForDate, cleanupDuplicateCompletions } from '@/lib/roadmap-client'
import { supabase } from '@/lib/supabase/client'
import { parseDateFromDB, formatDateForDisplay } from '@/lib/date-utils'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { fetchHealthMetrics } from '@/lib/analytics'
import { useCountUp } from '@/hooks/useCountUp'
import { HealthModal } from '@/components/ui/HealthModal'
import { PulseOrb } from '@/components/ui/PulseOrb'
import { HealthCountdownTimer } from '@/components/ui/HealthCountdownTimer'
// FloatingInsightCard removed - using inline insights instead
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { SwitchPlanModal } from '@/components/ui/SwitchPlanModal'
import { motion, AnimatePresence } from 'framer-motion'

export default function DashboardPage() {
  const router = useRouter()
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
  const [todayTasks, setTodayTasks] = useState<Array<{id: string, text: string, completed: boolean, dbTask?: boolean, scheduled_date?: string}>>([])
  const [tasksGlowing, setTasksGlowing] = useState(false)
  const [milestoneCompletionStatus, setMilestoneCompletionStatus] = useState<{ [milestoneId: string]: boolean }>({})
  const [nextMilestone, setNextMilestone] = useState<any>(null)
  const [nextMilestoneTasks, setNextMilestoneTasks] = useState<Array<any>>([])
  const [recentActivities, setRecentActivities] = useState<Array<any>>([])
  const [milestoneGlowing, setMilestoneGlowing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSwitchPlanModal, setShowSwitchPlanModal] = useState(false)
  
  // Cycling insights state
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0)
  const [cyclingInsights, setCyclingInsights] = useState<string[]>([])
  
  
  // Count-up animation for health score display
  const animatedValue = useCountUp(healthScore, 800)
  
  // Use onboarding protection hook
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  
  // Fetch real roadmap data
  const { roadmapData, loading: roadmapLoading, refetch, updateTask } = useUserRoadmap(user?.id)

  useEffect(() => {
    setIsClient(true)
  }, [])


  // Load today's tasks from the database when roadmap data is available
  useEffect(() => {
    const loadTodayTasks = async () => {
      if (roadmapData && roadmapData.plan) {
        try {
          const tasks = await getTodayTasks(roadmapData.plan.id)
          
          if (tasks && tasks.length > 0) {
            // Convert database tasks to UI format
            const formattedTasks = tasks.map((task: any) => ({
              id: task.id,
              text: task.name,
              completed: task.is_completed,
              dbTask: true, // Flag to identify DB tasks
              scheduled_date: task.scheduled_date // Store actual scheduled date
            }))
            setTodayTasks(formattedTasks)
          }
        } catch (error) {
          console.error('Error loading today tasks:', error)
        }
      }
    }

    if (!roadmapLoading) {
      loadTodayTasks()
    }
  }, [roadmapData, roadmapLoading])

  // Load milestone completion status
  useEffect(() => {
    const loadMilestoneStatus = async () => {
      if (roadmapData && roadmapData.plan) {
        try {
          const status = await getMilestoneCompletionStatus(roadmapData.plan.id)
          setMilestoneCompletionStatus(status)
        } catch (error) {
          console.error('Error loading milestone completion status:', error)
        }
      }
    }

    if (!roadmapLoading) {
      loadMilestoneStatus()
    }
  }, [roadmapData, roadmapLoading])
  
  // Generate cycling insights based on health metrics (memoized to prevent erratic cycling)
  useEffect(() => {
    if (roadmapData?.plan && !loadingHealth) {
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
  }, [roadmapData?.plan, loadingHealth, healthHistory, efficiency, consistency, progress, healthScore])
  
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
      if (roadmapData && roadmapData.plan && roadmapData.milestones) {
        try {
          const status = await getMilestoneCompletionStatus(roadmapData.plan.id)
          
          // Find the first incomplete milestone
          const incomplete = roadmapData.milestones.find((m: any) => !status[m.id])
          
          if (incomplete) {
            setNextMilestone(incomplete)
            
            // Get tasks for this milestone with scheduled dates
            const { data: tasks } = await supabase
              .from('tasks')
              .select(`
                id, 
                name, 
                category, 
                milestone_id,
                task_schedule (
                  date
                )
              `)
              .eq('plan_id', roadmapData.plan.id)
              .eq('milestone_id', incomplete.id)
              .order('idx', { ascending: true })
              .limit(5)
            
            if (tasks) {
              // Get completion status for these tasks
              const taskIds = tasks.map(t => t.id)
              const { data: completions } = await supabase
                .from('task_completions')
                .select('task_id')
                .in('task_id', taskIds)
                .eq('plan_id', roadmapData.plan.id)
              
              const completedIds = new Set(completions?.map(c => c.task_id) || [])
              const tasksWithStatus = tasks.map(t => ({
                ...t,
                is_completed: completedIds.has(t.id)
              }))
              
              setNextMilestoneTasks(tasksWithStatus)
            }
          }
        } catch (error) {
          console.error('Error loading next milestone:', error)
        }
      }
    }

    if (!roadmapLoading) {
      loadNextMilestone()
    }
  }, [roadmapData, roadmapLoading, milestoneCompletionStatus])

  // Load recent activities
  useEffect(() => {
    const loadRecentActivities = async () => {
      if (roadmapData && roadmapData.plan) {
        try {
          const { data: completions } = await supabase
            .from('task_completions')
            .select(`
              task_id,
              completed_at,
              tasks (
                name,
                category
              )
            `)
            .eq('plan_id', roadmapData.plan.id)
            .order('completed_at', { ascending: false })
            .limit(4)
          
          if (completions) {
            setRecentActivities(completions)
          }
        } catch (error) {
          console.error('Error loading recent activities:', error)
        }
      }
    }

    if (!roadmapLoading) {
      loadRecentActivities()
    }
  }, [roadmapData, roadmapLoading])

  // Load health metrics (degrading health model)
  useEffect(() => {
    const loadHealthMetrics = async () => {
      if (user?.id && roadmapData?.plan) {
        try {
          setLoadingHealth(true)
          const metrics = await fetchHealthMetrics(user.id, roadmapData.plan.id)
          
          setHealthScore(metrics.healthScore)
          setHasScheduledTasks(metrics.hasScheduledTasks)
          setProgress(metrics.progressVal)
          setConsistency(metrics.consistencyVal)
          setEfficiency(metrics.efficiencyVal)
          setHealthHistory(metrics.history)
          
          // Set health color based on health score (degrading health model)
          if (!metrics.hasScheduledTasks) {
            setHealthColor('#9ca3af') // gray - no tasks scheduled
          } else if (metrics.healthScore >= 80) {
            setHealthColor('#10b981') // green - excellent health
          } else if (metrics.healthScore >= 60) {
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
  }, [user?.id, roadmapData?.plan?.id])

  // OLD INSIGHTS LOGIC REMOVED - Using new metric-based insights above (lines 118-182)

  // Realtime subscription for auto-refresh when tasks change
  useEffect(() => {
    if (!user?.id || !roadmapData?.plan?.id) return
    
    const channel = supabase
      .channel('plan_update')
      .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'task_completions',
            filter: `plan_id=eq.${roadmapData.plan.id}`
          },
          async (payload) => {
            // Refresh health metrics
            const loadHealthMetrics = async () => {
              try {
                const metrics = await fetchHealthMetrics(user.id, roadmapData.plan.id)
                setHealthScore(metrics.healthScore)
                setHasScheduledTasks(metrics.hasScheduledTasks)
                setProgress(metrics.progressVal)
                setConsistency(metrics.consistencyVal)
                setEfficiency(metrics.efficiencyVal)
                setHealthHistory(metrics.history)
                
                // Set color based on health score (degrading health model)
                if (!metrics.hasScheduledTasks) setHealthColor('#9ca3af')
                else if (metrics.healthScore >= 80) setHealthColor('#10b981')
                else if (metrics.healthScore >= 60) setHealthColor('#f59e0b')
                else setHealthColor('#ef4444')
              } catch (error) {
                console.error('Error refreshing health metrics:', error)
              }
            }
            loadHealthMetrics()
            
            // Reload today's tasks to sync with database
            const tasks = await getTodayTasks(roadmapData.plan.id)
            if (tasks) {
              const formattedTasks = tasks.map((task: any) => ({
                id: task.id,
                text: task.name,
                completed: task.is_completed,
                dbTask: true,
                scheduled_date: task.scheduled_date // Include scheduled date for proper completion tracking
              }))
              setTodayTasks(formattedTasks)
              
              // Check if all today's tasks are completed for glow effect
              const allComplete = formattedTasks.every(t => t.completed)
              if (allComplete && formattedTasks.length > 0) {
                setTasksGlowing(true)
                setTimeout(() => setTasksGlowing(false), 2000)
              }
            }
            
            // Also refetch roadmap data
            refetch()
          })
      .subscribe()
    
    return () => { 
      supabase.removeChannel(channel) 
    }
  }, [user?.id, roadmapData?.plan?.id, refetch])

  // ONE-TIME CLEANUP: Remove duplicate milestone task completions
  // This can be removed after running once
  useEffect(() => {
    const runCleanup = async () => {
      if (roadmapData && roadmapData.plan && user?.id) {
        try {
          const result = await cleanupDuplicateCompletions(user.id, roadmapData.plan.id)
          
          // Refetch data to show clean state
          if (result.removed > 0) {
            await refetch()
            // Reload recent activities
            const { data: completions } = await supabase
              .from('task_completions')
              .select(`
                task_id,
                completed_at,
                tasks (
                  name,
                  category
                )
              `)
              .eq('plan_id', roadmapData.plan.id)
              .order('completed_at', { ascending: false })
              .limit(4)
            
            if (completions) {
              setRecentActivities(completions)
            }
          }
        } catch (error) {
          console.error('Error running cleanup:', error)
        }
      }
    }

    if (!roadmapLoading) {
      runCleanup()
    }
  }, [roadmapData, roadmapLoading, user?.id])


  const toggleTask = async (taskId: any, isMilestoneTask = false) => {
    const task = isMilestoneTask 
      ? nextMilestoneTasks.find(t => t.id === taskId)
      : todayTasks.find(t => t.id === taskId)
    
    // If it's a DB task, update in Supabase
    if (task && (isMilestoneTask || (task as any).dbTask)) {
      const isCompleting = isMilestoneTask ? !task.is_completed : !task.completed
      
      // OPTIMISTIC UPDATE: Update UI immediately for instant feedback
      if (isMilestoneTask) {
        setNextMilestoneTasks(prev => 
          prev.map(t => t.id === taskId ? { ...t, is_completed: isCompleting } : t)
        )
        
        // Update milestone completion status optimistically
        // Only mark milestone as complete if ALL tasks will be complete after this change
        if (task.milestone_id) {
          const updatedTasks = nextMilestoneTasks.map(t => 
            t.id === taskId ? { ...t, is_completed: isCompleting } : t
          )
          const allComplete = updatedTasks.every(t => t.is_completed)
          
          setMilestoneCompletionStatus(prev => ({
            ...prev,
            [task.milestone_id]: allComplete
          }))
        }
      }
      
      try {
        // CRITICAL: Always use the task's actual scheduled date from the database
        // This ensures consistency across all pages and prevents duplicate completions
        let scheduledDate: string
        
        if (isMilestoneTask && task.task_schedule && task.task_schedule.length > 0) {
          // Milestone tasks: use task_schedule date
          scheduledDate = task.task_schedule[0].date
        } else if (!isMilestoneTask && (task as any).scheduled_date) {
          // Daily tasks from Today's Tasks panel: use stored scheduled_date
          scheduledDate = (task as any).scheduled_date
        } else {
          // Fallback (should rarely happen): use today's date
          scheduledDate = new Date().toISOString().split('T')[0]
          console.warn('No scheduled_date found for task, using today as fallback:', taskId)
        }
        
        // Fire and forget the DB update in the background
        updateTask(taskId, isCompleting, roadmapData?.plan?.id, scheduledDate)
          .then(async () => {
            // Background refresh without blocking UI
            if (roadmapData && roadmapData.plan) {
              // Only reload data that changed, not full refetch
              const status = await getMilestoneCompletionStatus(roadmapData.plan.id)
              setMilestoneCompletionStatus(status)
              
              // Update recent activities
              const { data: completions } = await supabase
                .from('task_completions')
                .select(`
                  task_id,
                  completed_at,
                  tasks (
                    name,
                    category
                  )
                `)
                .eq('plan_id', roadmapData.plan.id)
                .order('completed_at', { ascending: false })
                .limit(4)
              
              if (completions) {
                setRecentActivities(completions)
              }
              
              // Check if we need to load next milestone
              const incomplete = roadmapData.milestones.find((m: any) => !status[m.id])
              
              if (incomplete && (!nextMilestone || incomplete.id !== nextMilestone.id)) {
                setNextMilestone(incomplete)
                
                const { data: tasks } = await supabase
                  .from('tasks')
                  .select('id, name, category, milestone_id')
                  .eq('plan_id', roadmapData.plan.id)
                  .eq('milestone_id', incomplete.id)
                  .order('idx', { ascending: true })
                  .limit(5)
                
                if (tasks) {
                  const taskIds = tasks.map(t => t.id)
                  const { data: completions } = await supabase
                    .from('task_completions')
                    .select('task_id')
                    .in('task_id', taskIds)
                    .eq('plan_id', roadmapData.plan.id)
                  
                  const completedIds = new Set(completions?.map(c => c.task_id) || [])
                  const tasksWithStatus = tasks.map(t => ({
                    ...t,
                    is_completed: completedIds.has(t.id)
                  }))
                  
                  setNextMilestoneTasks(tasksWithStatus)
                  
                  // Check if all tasks in this milestone are now complete → trigger glow
                  const allTasksComplete = tasksWithStatus.every(t => t.is_completed)
                  if (allTasksComplete && tasksWithStatus.length > 0) {
                    setMilestoneGlowing(true)
                    setTimeout(() => setMilestoneGlowing(false), 2000)
                  }
                }
              } else if (!incomplete) {
                // All milestones complete!
                setNextMilestone(null)
                setNextMilestoneTasks([])
              }
              
              // Also reload today's tasks to keep in sync
              const tasks = await getTodayTasks(roadmapData.plan.id)
              if (tasks && tasks.length > 0) {
                const formattedTasks = tasks.map((task: any) => ({
                  id: task.id,
                  text: task.name,
                  completed: task.is_completed,
                  dbTask: true,
                  scheduled_date: task.scheduled_date // Include scheduled date for proper completion tracking
                }))
                setTodayTasks(formattedTasks)
              }
            }
          })
          .catch(error => {
            console.error('Error in background update:', error)
            // Revert optimistic update on error
            if (isMilestoneTask) {
              setNextMilestoneTasks(prev => 
                prev.map(t => t.id === taskId ? { ...t, is_completed: !isCompleting } : t)
              )
            }
          })
        
      } catch (error) {
        console.error('Error updating task:', error)
        // Revert optimistic update on error
        if (isMilestoneTask) {
          setNextMilestoneTasks(prev => 
            prev.map(t => t.id === taskId ? { ...t, is_completed: !isCompleting } : t)
          )
        }
        return
      }
    }
    
    if (isMilestoneTask) {
      return // All UI updates happen via refetch above
    }
    
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

  const getCurrentDate = () => {
    const today = new Date()
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  

  // Show loading state while user data is being fetched
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  // Dashboard now uses real data from useUserRoadmap hook

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
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
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaggeredFadeIn>
          {/* Welcome Section */}
          <FadeInWrapper delay={0.1} direction="up">
            <div className="mb-8">
              <h1 className="text-5xl font-bold tracking-tight text-[#d7d2cb] mb-4">
                Welcome back, {profile?.display_name || 'Achiever'}!
              </h1>
              <p className="text-base leading-relaxed text-[#d7d2cb]/70 max-w-prose">
                {roadmapData?.plan 
                  ? "Ready to make progress on your goals? Let's create something amazing together."
                  : "Start your journey by creating your first goal."}
              </p>
            </div>
          </FadeInWrapper>

        {/* Goal Panel and Plan Health - Side by Side */}
        <FadeInWrapper delay={0.2} direction="up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Goal Panel */}
            <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardDescription className="text-base">
                  Current Goal
                </CardDescription>
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
              {roadmapLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-3/4 bg-white/5" />
                  <Skeleton className="h-4 w-full bg-white/5" />
                  <Skeleton className="h-4 w-5/6 bg-white/5" />
                </div>
              ) : !roadmapData?.plan ? (
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
                  <h3 className="text-5xl font-bold text-[#ff7f00] mb-4">
                    {roadmapData.plan.summary_data?.goal_title || roadmapData.goal?.title || 'No goal set'}
                  </h3>
                  <p className="text-sm text-[#d7d2cb]/70">
                    {roadmapData.plan.summary_data?.goal_summary || roadmapData.goal?.description || 'Set your goal to get started on your journey.'}
                  </p>
                  
                  {/* Milestones List */}
                  {roadmapData?.milestones && roadmapData.milestones.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h4 className="text-xs font-semibold text-[#d7d2cb]/60 uppercase tracking-wide mb-2">
                        Plan Milestones
                      </h4>
                      <ul className="space-y-2">
                        {roadmapData.milestones.map((milestone: any, index: number) => {
                          const isCompleted = milestoneCompletionStatus[milestone.id] || false
                          return (
                            <li key={milestone.id} className="flex items-start gap-2 text-sm group">
                              <span className={`font-medium mt-0.5 transition-colors duration-200 ${
                                isCompleted ? 'text-[#ff7f00]/40' : 'text-[#ff7f00]'
                              }`}>
                                {index + 1}.
                              </span>
                              <div className="flex-1">
                                <span className={`transition-colors duration-200 ${
                                  isCompleted 
                                    ? 'text-[#d7d2cb]/40 line-through' 
                                    : 'text-[#d7d2cb]'
                                }`}>
                                  {milestone.name}
                                </span>
                                {milestone.target_date && (
                                  <span className={`ml-2 transition-all duration-200 ${
                                    isCompleted 
                                      ? 'text-[#d7d2cb]/30 opacity-0 group-hover:opacity-100' 
                                      : 'text-[#d7d2cb]/50 opacity-0 group-hover:opacity-100'
                                  }`}>
                                    ({formatDateForDisplay(parseDateFromDB(milestone.target_date), {
                                      month: 'short',
                                      day: 'numeric'
                                    })})
                                  </span>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {/* Date Range and Days Left - Individual Panels */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-[#d7d2cb]/60" />
                    <p className="text-xs text-[#d7d2cb]/60">Start Date</p>
                  </div>
                  {!roadmapData?.plan ? (
                    <Skeleton className="h-5 w-24 bg-white/5" />
                  ) : (
                    <p className="text-sm font-medium text-[#d7d2cb]">
                      {roadmapData.plan.start_date 
                        ? formatDateForDisplay(parseDateFromDB(roadmapData.plan.start_date), {
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
                  {!roadmapData?.plan ? (
                    <Skeleton className="h-5 w-24 bg-white/5" />
                  ) : (
                    <p className="text-sm font-medium text-[#d7d2cb]">
                      {roadmapData.plan.end_date
                        ? formatDateForDisplay(parseDateFromDB(roadmapData.plan.end_date), {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : '—'}
                    </p>
                  )}
                </div>
                
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <p className="text-xs text-[#d7d2cb]/60">Days Remaining</p>
                  </div>
                  {!roadmapData?.plan ? (
                    <Skeleton className="h-5 w-16 bg-white/5" />
                  ) : (
                    <p className="text-sm font-bold text-orange-400">
                      {roadmapData.plan.end_date ? (() => {
                        const endDate = parseDateFromDB(roadmapData.plan.end_date)
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

          {/* Plan Health Orb */}
          <Card className="relative bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm border border-white/10" id="plan-health-orb">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-semibold">Plan Health</CardTitle>
                  <CardDescription>Your plan's overall health</CardDescription>
                </div>
                <button
                  onClick={() => router.push('/health')}
                  className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
                  title="View detailed health metrics"
                >
                  <ExternalLink className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col items-center justify-between pt-10 pb-4 relative min-h-[400px]">
              {!roadmapData?.plan ? (
                <>
                  <div className="flex-1 flex items-center justify-center">
                    <PulseOrb
                      progress={0}
                      consistency={0}
                      efficiency={null}
                      healthHistory={undefined}
                      hasScheduledTasks={false}
                      healthScore={0}
                      noPlan={true}
                      className="scale-75"
                    />
                  </div>
                  <div className="w-full flex justify-center pb-2">
                    <div className="text-[#d7d2cb]/60 text-base font-normal">
                      Create a plan to track your health
                    </div>
                  </div>
                </>
              ) : loadingHealth ? (
                <div className="text-[#d7d2cb]/60">Calculating health…</div>
              ) : (
                <>
                  <div className="flex items-center justify-center" style={{ marginTop: '10px' }}>
                    <PulseOrb
                      progress={progress}
                      consistency={consistency}
                      efficiency={efficiency}
                      healthHistory={healthHistory}
                      hasScheduledTasks={hasScheduledTasks}
                      healthScore={healthScore}
                      showHealthTooltip={true}
                      className="scale-75"
                    />
                  </div>
                  
                  {/* Cycling Health Insights - At bottom of panel */}
                  <div className="w-full flex justify-center pb-2" style={{ marginTop: 'auto', marginBottom: '4px' }}>
                    <AnimatePresence mode="wait">
                      {cyclingInsights.length > 0 && (
                        <motion.div
                          key={currentInsightIndex}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.5 }}
                          className="text-center"
                        >
                          <p className="text-[#d7d2cb]/70 text-base font-medium">
                            {cyclingInsights[currentInsightIndex]}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Health Snapshot Countdown Timer - Simple text under insights */}
                  <div className="w-full mt-1">
                    <HealthCountdownTimer 
                      cronSchedule="0 0 * * *"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          </div>
        </FadeInWrapper>

        {/* Today's Tasks and Stats Grid */}
        <FadeInWrapper delay={0.4} direction="up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Today's Tasks */}
          <div>
            <Card className={`relative transition-all duration-500 ${tasksGlowing ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : ''}`}>
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
              <CardContent>
                {!roadmapData?.plan ? (
                  <div className="text-center py-8">
                    <p className="text-[#d7d2cb]/50 text-sm">
                      No plan
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

          {/* Next Milestone */}
          <div>
            <Card className={`relative transition-all duration-500 ${
              milestoneGlowing ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : ''
            }`}>
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
                  Next Milestone
                </CardTitle>
                <CardDescription>
                  {nextMilestoneTasks.length} milestone tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!roadmapData?.plan ? (
                  <div className="text-center py-8">
                    <p className="text-[#d7d2cb]/50 text-sm">
                      No plan
                    </p>
                    <p className="text-[#d7d2cb]/40 text-xs mt-1">
                      Create a plan to see your milestones
                    </p>
                  </div>
                ) : nextMilestone && nextMilestoneTasks.length > 0 ? (
                  <div className="space-y-3">
                    {/* Milestone Date */}
                    {nextMilestone.target_date && (
                      <div className="group p-3 rounded-lg bg-pink-500/10 border border-pink-500/30 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#d7d2cb] font-semibold">
                            {nextMilestone.name}
                          </span>
                          <span className="text-[#d7d2cb]/60 text-xs opacity-0 group-hover:opacity-100 transition-all duration-200">
                            {formatDateForDisplay(parseDateFromDB(nextMilestone.target_date), {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Milestone Tasks */}
                    {nextMilestoneTasks.map((task) => (
                      <motion.div
                        key={task.id}
                        className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          task.is_completed
                            ? 'bg-purple-500/5 border border-purple-500/20 opacity-60'
                            : 'bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20'
                        }`}
                        onClick={() => toggleTask(task.id, true)}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.1 }}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                          task.is_completed
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-purple-400 hover:border-purple-300'
                        }`}>
                          {task.is_completed && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                          <span className={`text-sm transition-all duration-200 group-hover:-translate-y-1 ${
                            task.is_completed 
                              ? 'text-purple-300/60 line-through' 
                              : 'text-purple-300'
                          }`}>
                            {task.name}
                          </span>
                          {task.task_schedule && task.task_schedule.length > 0 && (
                            <div className="text-xs text-purple-400/60 max-h-0 opacity-0 group-hover:max-h-6 group-hover:opacity-100 group-hover:mt-1 transition-all duration-200 overflow-hidden">
                              {formatDateForDisplay(parseDateFromDB(task.task_schedule[0].date), {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-[#d7d2cb]/60 mb-2">
                      <Target className="w-12 h-12 mx-auto mb-3" />
                    </div>
                    <p className="text-[#d7d2cb]/70 text-sm">
                      {nextMilestone ? 'No tasks for this milestone yet' : 'All milestones completed! 🎉'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          </div>
        </FadeInWrapper>

        {/* Recent Activity */}
        <FadeInWrapper delay={0.5} direction="up">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">
                Recent Activity
              </CardTitle>
              <CardDescription>
                Your latest task completions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities.length > 0 ? (
                <div className="space-y-4">
                  {recentActivities.map((activity: any, index: number) => {
                    const timeAgo = (() => {
                      const now = new Date()
                      const completedAt = new Date(activity.completed_at)
                      const diffMs = now.getTime() - completedAt.getTime()
                      const diffMins = Math.floor(diffMs / 60000)
                      const diffHours = Math.floor(diffMs / 3600000)
                      const diffDays = Math.floor(diffMs / 86400000)
                      
                      if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
                      if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
                      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
                    })()
                    
                    return (
                      <motion.div
                        key={activity.task_id || index}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          duration: 0.3,
                          delay: index * 0.1,
                          ease: "easeOut"
                        }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#d7d2cb]">{activity.tasks.name}</p>
                            {activity.tasks.category === 'milestone_task' && (
                              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30">
                                Milestone
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#d7d2cb]/60">{timeAgo}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-[#d7d2cb]/60 mb-2">
                    <Activity className="w-12 h-12 mx-auto mb-3" />
                  </div>
                  <p className="text-[#d7d2cb]/70 text-sm">
                    No recent activity yet
                  </p>
                  <p className="text-[#d7d2cb]/50 text-xs mt-1">
                    Complete some tasks to see your activity here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Community Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                Community
              </CardTitle>
              <CardDescription>
                Stay connected with updates and discussions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Discord Notifications */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                  <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#d7d2cb]">New Discord message</p>
                    <p className="text-xs text-[#d7d2cb]/60">@general: Great progress everyone!</p>
                    <p className="text-xs text-[#d7d2cb]/50 mt-1">2 minutes ago</p>
                  </div>
                </div>

                {/* News Update */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Star className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#d7d2cb]">Platform Update</p>
                    <p className="text-xs text-[#d7d2cb]/60">New features available in beta</p>
                    <p className="text-xs text-[#d7d2cb]/50 mt-1">1 hour ago</p>
                  </div>
                </div>

                {/* Message Notification */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#d7d2cb]">Direct Message</p>
                    <p className="text-xs text-[#d7d2cb]/60">Sarah shared a helpful tip</p>
                    <p className="text-xs text-[#d7d2cb]/50 mt-1">3 hours ago</p>
                  </div>
                </div>

                {/* Forum Discussion */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#d7d2cb]">Forum Discussion</p>
                    <p className="text-xs text-[#d7d2cb]/60">"Goal tracking strategies" has new replies</p>
                    <p className="text-xs text-[#d7d2cb]/50 mt-1">1 day ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </FadeInWrapper>

        </StaggeredFadeIn>
      </main>

      {/* Delete Plan Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          if (!user?.id || !roadmapData?.plan?.id) return
          
          setIsDeleting(true)
          try {
            // Call the delete_plan_data function
            const { data, error } = await supabase.rpc('delete_plan_data', {
              target_user_id: user.id,
              target_plan_id: roadmapData.plan.id
            })
            
            if (error) {
              console.error('Error deleting plan:', error)
              alert('Failed to delete plan. Please try again.')
              setIsDeleting(false)
              setShowDeleteModal(false)
              return
            }
            
            // Stay on dashboard and show "no plan" state
            setShowDeleteModal(false)
            setIsDeleting(false)
            // Refetch to update UI with "no plan" state
            refetch()
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

      {/* Switch Plan Modal */}
      <SwitchPlanModal
        isOpen={showSwitchPlanModal}
        onClose={() => setShowSwitchPlanModal(false)}
        hasActivePlan={!!roadmapData?.plan}
        currentPlanTitle={roadmapData?.plan?.summary_data?.goal_title || roadmapData?.goal?.title}
        onPlanChanged={() => {
          // Refetch roadmap data when plan is switched/changed
          refetch()
        }}
      />
    </div>
  )
}


