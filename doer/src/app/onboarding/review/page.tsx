// src/app/onboarding/review/page.tsx
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Task } from '@/lib/types'
import { formatDateForDisplay, parseDateFromDB, formatTimeForDisplay } from '@/lib/date-utils'
import { CheckCircle, RotateCcw, ChevronDown, ChevronUp, Plus, Save, X, Trash2, Sparkles, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useToast } from '@/components/ui/Toast'
import { PlanSelectionModal } from '@/components/ui/PlanSelectionModal'
import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { StrengthenPlanModal } from '@/components/ui/StrengthenPlanModal'
import type { ReviewPlanData } from '@/lib/types/roadmap'

export default function ReviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, supabase, loading: authLoading } = useSupabase()
  const { addToast } = useToast()
  const [plan, setPlan] = useState<ReviewPlanData | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [editedPlan, setEditedPlan] = useState<ReviewPlanData | null>(null)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [clarificationPhase, setClarificationPhase] = useState<'idle' | 'loading' | 'questions' | 'freeText' | 'review'>('idle')
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  const [clarificationQuestions, setClarificationQuestions] = useState<Array<{ text: string; options: string[]; type?: 'single' | 'multiple' }>>([])
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string | string[]>>({})
  const [clarificationOtherTexts, setClarificationOtherTexts] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [additionalInfoText, setAdditionalInfoText] = useState('')
  const [clarificationError, setClarificationError] = useState<{ title: string; message: string } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isRequestInFlightRef = useRef(false)
  const [showPlanSelectionModal, setShowPlanSelectionModal] = useState(false)
  const [hasBasicPlan, setHasBasicPlan] = useState(false)
  const [showStrengthenPlanModal, setShowStrengthenPlanModal] = useState(false)
  const [dontShowAgainPreference, setDontShowAgainPreference] = useState(false)

  const wrapSortTasksChronologically = (items: Task[]) => {
    return [...items].sort((a, b) => {
      const dateA = a.scheduled_date ? new Date(a.scheduled_date) : null
      const dateB = b.scheduled_date ? new Date(b.scheduled_date) : null
      if (dateA && dateB) {
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime()
        }
      } else if (dateA) {
        return -1
      } else if (dateB) {
        return 1
      }

      const timeA = a.start_time ? parseTimeString(a.start_time) : ''
      const timeB = b.start_time ? parseTimeString(b.start_time) : ''
      if (timeA && timeB) {
        const [hA, mA] = timeA.split(':').map(Number)
        const [hB, mB] = timeB.split(':').map(Number)
        return hA === hB ? mA - mB : hA - hB
      }

      return (a.idx || 0) - (b.idx || 0)
    })
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    // Load plan and tasks directly from DB (no client storage fallbacks)
    const bootstrap = async () => {
      try {
        const planId = searchParams.get('plan')
        if (!planId) {
          // If no planId specified, fetch latest active plan for user
          const { data: latestPlan, error: planErr } = await supabase
            .from('plans')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (planErr) throw planErr
          if (!latestPlan) {
            router.replace('/onboarding')
            return
          }
          setPlan(latestPlan as any)
          // Fetch tasks with their schedule information
          const { data: fetchedTasks, error: tasksErr } = await supabase
            .from('tasks')
            .select(`
              *,
              task_schedule (
                id,
                date,
                start_time,
                end_time,
                duration_minutes
              )
            `)
            .eq('user_id', user.id)
            .eq('plan_id', latestPlan.id)
            .order('idx', { ascending: true })
          if (tasksErr) throw tasksErr
          // Merge schedule data into tasks
          const tasksWithSchedule = (Array.isArray(fetchedTasks) ? fetchedTasks : []).map((task: any) => {
            const schedules = Array.isArray(task.task_schedule) ? task.task_schedule : []
            const primarySchedule = schedules[0] || null
            return {
              ...task,
              scheduled_date: primarySchedule?.date || null,
              start_time: primarySchedule?.start_time || null,
              end_time: primarySchedule?.end_time || null,
              estimated_duration_minutes: primarySchedule?.duration_minutes || task.estimated_duration_minutes || 0,
              schedule_id: primarySchedule?.id || null,
              schedules: schedules // Keep all schedules for split tasks
            }
          })
          setTasks(wrapSortTasksChronologically(tasksWithSchedule as any))
    } else {
          const { data: dbPlan, error: dbErr } = await supabase
            .from('plans')
            .select('*')
            .eq('user_id', user.id)
            .eq('id', planId)
            .maybeSingle()
          if (dbErr) throw dbErr
          if (!dbPlan) {
            router.replace('/onboarding')
            return
          }
          setPlan(dbPlan as any)
          // Fetch tasks with their schedule information
          const { data: fetchedTasks, error: tasksErr } = await supabase
            .from('tasks')
            .select(`
              *,
              task_schedule (
                id,
                date,
                start_time,
                end_time,
                duration_minutes
              )
            `)
            .eq('user_id', user.id)
            .eq('plan_id', planId)
            .order('idx', { ascending: true })
          if (tasksErr) throw tasksErr
          // Merge schedule data into tasks
          const tasksWithSchedule = (Array.isArray(fetchedTasks) ? fetchedTasks : []).map((task: any) => {
            const schedules = Array.isArray(task.task_schedule) ? task.task_schedule : []
            const primarySchedule = schedules[0] || null
            return {
              ...task,
              scheduled_date: primarySchedule?.date || null,
              start_time: primarySchedule?.start_time || null,
              end_time: primarySchedule?.end_time || null,
              estimated_duration_minutes: primarySchedule?.duration_minutes || task.estimated_duration_minutes || 0,
              schedule_id: primarySchedule?.id || null,
              schedules: schedules // Keep all schedules for split tasks
            }
          })
          setTasks(wrapSortTasksChronologically(tasksWithSchedule as any))
        }
      } catch (error) {
        console.error('Failed to load plan for review:', error)
        router.replace('/onboarding')
      } finally {
    setLoading(false)
      }
    }
    bootstrap()
  }, [authLoading, user, supabase, router, searchParams])

  // Fetch user preference for strengthen plan modal
  useEffect(() => {
    if (!user || loading || authLoading) return

    const fetchPreference = async () => {
      try {
        const response = await fetch('/api/preferences/strengthen-plan-modal')
        if (response.ok) {
          const data = await response.json()
          setDontShowAgainPreference(data.dont_show_again || false)
        }
      } catch (error) {
        console.error('Error fetching strengthen plan modal preference:', error)
        // Default to false (show modal) if error
        setDontShowAgainPreference(false)
      }
    }

    fetchPreference()
  }, [user, loading, authLoading])

  // Check subscription on page load and show modal if user has basic plan
  useEffect(() => {
    if (!user || loading || authLoading) return

    const checkSubscription = async () => {
      try {
        const subscriptionCheck = await fetch('/api/subscription/check')
        if (subscriptionCheck.ok) {
          const subscriptionData = await subscriptionCheck.json()
          if (subscriptionData.hasBasicPlan) {
            setHasBasicPlan(true)
            setShowPlanSelectionModal(true)
          }
        }
      } catch (error) {
        console.error('[Review] Error checking subscription:', error)
        // Don't show modal if check fails
      }
    }

    checkSubscription()
  }, [user, loading, authLoading])

  // Load user's time format preference
  useEffect(() => {
    if (!user) return
    const loadTimeFormat = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('preferences')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!error && data?.preferences?.time_format) {
          setTimeFormat(data.preferences.time_format)
        }
      } catch (error) {
        console.error('Error loading time format preference:', error)
      }
    }
    loadTimeFormat()
  }, [user, supabase])

  // Error boundary: Reset state on unmount to prevent stale state
  useEffect(() => {
    return () => {
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Cleanup on unmount
      setClarificationQuestions([])
      setClarificationAnswers({})
      setCurrentQuestionIndex(0)
      setIsGeneratingQuestions(false)
      setIsRegenerating(false)
      isRequestInFlightRef.current = false
    }
  }, [])

  // Helper function to format time string (HH:MM) to user's preferred format
  const formatTimeString = (timeStr: string | null | undefined): string => {
    if (!timeStr) return ''
    // Parse HH:MM format
    const [hours, minutes] = timeStr.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return timeStr
    // Create a date object with today's date and the time
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    return formatTimeForDisplay(date, timeFormat)
  }

  // Helper function to convert formatted time back to HH:MM for time inputs
  const parseTimeString = (timeStr: string | null | undefined): string => {
    if (!timeStr) return ''
    // If already in HH:MM format, return as-is
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr
    // Parse 12-hour format (e.g., "9:00 AM" or "09:30 PM")
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (match) {
      let hour = parseInt(match[1], 10)
      const minute = parseInt(match[2], 10)
      const period = match[3].toUpperCase()
      if (period === 'PM' && hour !== 12) hour += 12
      if (period === 'AM' && hour === 12) hour = 0
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    }
    return timeStr
  }

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Calculate total duration in minutes
  const totalDurationMinutes = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : []
    return safeTasks.reduce((sum, task) => sum + (task?.estimated_duration_minutes ?? 0), 0)
  }, [tasks])

  // Calculate total days - always call hooks, even if plan is null
  const startDate = useMemo(() => {
    if (!plan?.start_date) return null
    return parseDateFromDB(plan.start_date)
  }, [plan?.start_date])
  
  const endDate = useMemo(() => {
    if (!plan?.end_date) return null
    return parseDateFromDB(plan.end_date)
  }, [plan?.end_date])
  
  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }, [startDate, endDate])

  const handleTaskToggle = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null)
      setEditingTask(null)
    } else {
      setExpandedTaskId(taskId)
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        setEditingTask(task)
      }
    }
  }

  const handleTaskSave = async () => {
    if (!editingTask || !user || !supabase || !plan) {
      return
    }

    try {
      // Check if this is a new task (temp ID)
      const isNewTask = editingTask.id.startsWith('temp-')
      
      let taskId = editingTask.id
      
      // If new task, create it in the database first
      if (isNewTask) {
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            plan_id: plan.id,
            user_id: user.id,
            idx: editingTask.idx || tasks.length,
            name: editingTask.name || '',
            details: editingTask.details || null,
            estimated_duration_minutes: editingTask.estimated_duration_minutes || 60,
            priority: editingTask.priority || 1,
          })
          .select()
          .single()

        if (createError) throw createError
        if (!newTask) throw new Error('Failed to create task')
        
        taskId = newTask.id
      } else {
        // Update existing task metadata
        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            name: editingTask.name || '',
            details: editingTask.details || null,
            estimated_duration_minutes: editingTask.estimated_duration_minutes || 60,
            priority: editingTask.priority || 1,
          })
          .eq('id', editingTask.id)
          .eq('user_id', user.id)

        if (updateError) throw updateError
      }

      // Handle schedule updates
      if (editingTask.scheduled_date && editingTask.start_time && editingTask.end_time) {
        const scheduleId = (editingTask as any).schedule_id

        if (scheduleId) {
          // Update existing schedule via API
          const response = await fetch('/api/tasks/time-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schedule_id: scheduleId,
              start_time: editingTask.start_time,
              end_time: editingTask.end_time,
              date: editingTask.scheduled_date.includes('T') 
                ? editingTask.scheduled_date.split('T')[0] 
                : editingTask.scheduled_date
            })
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to update task schedule')
          }
        } else {
          // Create new schedule entry
          // First, calculate day_index from start_date
          const startDate = parseDateFromDB(plan.start_date)
          const scheduledDate = new Date(editingTask.scheduled_date.includes('T') 
            ? editingTask.scheduled_date.split('T')[0] 
            : editingTask.scheduled_date)
          const dayIndex = Math.floor((scheduledDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

          const { error: scheduleError } = await supabase
            .from('task_schedule')
            .insert({
              plan_id: plan.id,
              user_id: user.id,
              task_id: taskId,
              day_index: dayIndex,
              date: editingTask.scheduled_date.includes('T') 
                ? editingTask.scheduled_date.split('T')[0] 
                : editingTask.scheduled_date,
              start_time: editingTask.start_time,
              end_time: editingTask.end_time,
              duration_minutes: editingTask.estimated_duration_minutes || calculateDuration(editingTask.start_time, editingTask.end_time)
            })

          if (scheduleError) throw scheduleError
        }
      }

      // Refresh tasks from database
      const { data: fetchedTasks, error: tasksErr } = await supabase
        .from('tasks')
        .select(`
          *,
          task_schedule (
            id,
            date,
            start_time,
            end_time,
            duration_minutes
          )
        `)
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .order('idx', { ascending: true })

      if (tasksErr) throw tasksErr

      // Merge schedule data into tasks
      const tasksWithSchedule = (Array.isArray(fetchedTasks) ? fetchedTasks : []).map((task: any) => {
        const schedules = Array.isArray(task.task_schedule) ? task.task_schedule : []
        const primarySchedule = schedules[0] || null
        return {
          ...task,
          scheduled_date: primarySchedule?.date || null,
          start_time: primarySchedule?.start_time || null,
          end_time: primarySchedule?.end_time || null,
          estimated_duration_minutes: primarySchedule?.duration_minutes || task.estimated_duration_minutes || 0,
          schedule_id: primarySchedule?.id || null,
          schedules: schedules
        }
      })

      setTasks(wrapSortTasksChronologically(tasksWithSchedule as any))
      setEditingTask(null)
      setExpandedTaskId(null)

      addToast({
        type: 'success',
        title: 'Task Saved',
        description: 'Task changes have been saved successfully.',
      })
    } catch (error) {
      console.error('Error saving task:', error)
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save task changes. Please try again.',
      })
    }
  }

  const handleTaskCancel = () => {
    setEditingTask(null)
    setExpandedTaskId(null)
  }

  // Calculate duration from start and end times
  const calculateDuration = (startTime: string | null, endTime: string | null): number => {
    if (!startTime || !endTime) return 0
    const [startHours, startMins] = startTime.split(':').map(Number)
    const [endHours, endMins] = endTime.split(':').map(Number)
    const startTotal = startHours * 60 + startMins
    const endTotal = endHours * 60 + endMins
    return Math.max(0, endTotal - startTotal)
  }

  const handleTaskInputChange = (field: keyof Task, value: any) => {
    if (editingTask) {
      const updated = { ...editingTask, [field]: value }
      // Auto-calculate duration when start_time or end_time changes
      if (field === 'start_time' || field === 'end_time') {
        const newStartTime = field === 'start_time' ? value : updated.start_time
        const newEndTime = field === 'end_time' ? value : updated.end_time
        updated.estimated_duration_minutes = calculateDuration(newStartTime, newEndTime)
      }
      setEditingTask(updated)
    }
  }

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete))
      // Update sessionStorage
      const planData = sessionStorage.getItem('generatedPlan')
      if (planData) {
        try {
          const parsed = JSON.parse(planData)
          parsed.tasks = parsed.tasks.filter((t: Task) => t.id !== taskToDelete)
          sessionStorage.setItem('generatedPlan', JSON.stringify(parsed))
        } catch (error) {
          console.error('Error updating session storage:', error)
        }
      }
      setTaskToDelete(null)
      setShowDeleteConfirm(false)
      setEditingTask(null)
      setExpandedTaskId(null)
    }
  }

  const handleAddNewTask = () => {
    if (!plan) return
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      plan_id: plan.id,
      idx: tasks.length,
      name: '',
      details: '',
      estimated_duration_minutes: 60,
      priority: 1 as const,
      created_at: new Date().toISOString(),
      scheduled_date: '',
      start_time: '',
      end_time: ''
    }
    setTasks(prevTasks => [...prevTasks, newTask])
      setEditingTask(newTask)
      setExpandedTaskId(newTask.id)
  }

  const handleEditPlan = () => {
    if (!plan) return
    setIsEditingPlan(true)
    setEditedPlan({
      ...plan,
      goal_text: plan.summary_data?.goal_text || plan.goal_text,
      start_date: plan.start_date,
      end_date: plan.end_date,
      summary_data: {
        ...plan.summary_data,
        goal_text: plan.summary_data?.goal_text || plan.goal_text,
        goal_summary: plan.summary_data?.plan_summary || '',
      },
    })
  }

  const handlePlanSave = async () => {
    if (!editedPlan || !user || !supabase || !plan) {
      return
    }

    try {
      // Parse summary_data if it's a string
      let summaryData: any = plan.summary_data
      if (typeof summaryData === 'string') {
        try {
          summaryData = JSON.parse(summaryData)
        } catch {
          summaryData = {}
        }
      }

      // Prepare updated summary_data
      const updatedSummaryData = {
        ...summaryData,
        goal_text: editedPlan.goal_text,
        plan_summary: editedPlan.plan_summary || summaryData?.plan_summary || ''
      }

      // Update plan in database
      const { error: updateError } = await supabase
        .from('plans')
        .update({
          start_date: editedPlan.start_date,
          end_date: editedPlan.end_date,
          summary_data: updatedSummaryData
        })
        .eq('id', plan.id)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // Refresh plan from database
      const { data: refreshedPlan, error: fetchError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', plan.id)
        .eq('user_id', user.id)
        .single()

      if (fetchError) throw fetchError
      if (!refreshedPlan) throw new Error('Failed to refresh plan data')

      setPlan(refreshedPlan as any)
      setIsEditingPlan(false)
      setEditedPlan(null)

      addToast({
        type: 'success',
        title: 'Plan Saved',
        description: 'Plan changes have been saved successfully.',
      })
    } catch (error) {
      console.error('Error saving plan:', error)
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save plan changes. Please try again.',
      })
    }
  }

  const handlePlanCancel = () => {
    setIsEditingPlan(false)
    setEditedPlan(null)
  }

  const handlePlanInputChange = (field: string, value: any) => {
    if (editedPlan) {
      setEditedPlan({ ...editedPlan, [field]: value })
    }
  }

  const handleAcceptPlan = async () => {
    // Check user preference - if "do not show again" is true, skip modal and go directly to dashboard
    if (dontShowAgainPreference) {
      await proceedToDashboard()
      return
    }

    // Show strengthen plan modal
    setShowStrengthenPlanModal(true)
  }

  const proceedToDashboard = async () => {
    try {
      // ✅ VALIDATE AUTH SESSION before redirecting
      console.log('[Review] Validating auth session before dashboard redirect...')
      
      const healthCheck = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!healthCheck.ok) {
        console.error('[Review] Auth session not valid for current user')
        alert('Your session has expired. Please sign in again.')
        router.push('/login')
        return
      }
      
      const healthData = await healthCheck.json()
      console.log('[Review] Health check passed:', healthData)
      
      // Clear session storage and redirect
      sessionStorage.removeItem('generatedPlan')
      
      // Add a small delay to ensure session is fully propagated
      await new Promise(resolve => setTimeout(resolve, 300))
      
      console.log('[Review] Redirecting to dashboard...')
      router.push('/dashboard')
      
    } catch (error) {
      console.error('[Review] Error validating session:', error)
      alert('There was an error transitioning to the dashboard. Please try again.')
    }
  }

  const handleStrengthenPlanFromModal = () => {
    setShowStrengthenPlanModal(false)
    // Call existing strengthen plan handler
    handleStrengthenPlan()
  }

  const handleSkipStrengthenPlan = async (dontShowAgain: boolean) => {
    setShowStrengthenPlanModal(false)

    // Save preference if "do not show again" is checked
    if (dontShowAgain) {
      try {
        const response = await fetch('/api/preferences/strengthen-plan-modal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dont_show_again: true }),
        })

        if (response.ok) {
          setDontShowAgainPreference(true)
        } else {
          console.error('Failed to save preference:', await response.text())
        }
      } catch (error) {
        console.error('Error saving preference:', error)
      }
    }

    // Proceed to dashboard
    await proceedToDashboard()
  }

  const handleContinueToDashboard = () => {
    // Clear session storage and redirect
    sessionStorage.removeItem('generatedPlan')
    router.push('/dashboard')
  }

  const handleStrengthenPlan = async () => {
    if (!plan?.id) {
      addToast({
        type: 'error',
        title: 'Plan Not Found',
        description: 'Unable to strengthen plan. Please refresh the page and try again.',
      })
      return
    }
    
    // Prevent duplicate calls
    if (isRequestInFlightRef.current || isGeneratingQuestions) {
      return
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    isRequestInFlightRef.current = true

    setIsGeneratingQuestions(true)
    setClarificationPhase('loading')
    setClarificationError(null)

    try {
      const response = await fetch(`/api/plans/${plan.id}/clarify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
      })

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Invalid response format. Expected JSON but got ${contentType}. Status: ${response.status}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || `Failed to generate clarification questions (${response.status})`)
      }

      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        // Validate questions structure
        const validQuestions = data.questions.filter((q: any) => 
          q && typeof q === 'object' && 
          typeof q.text === 'string' && 
          Array.isArray(q.options) && 
          q.options.length >= 2
        )
        if (validQuestions.length > 0) {
          setClarificationQuestions(validQuestions)
          setCurrentQuestionIndex(0)
          setClarificationAnswers({})
          setClarificationOtherTexts({})
          setAdditionalInfoText('')
          setClarificationError(null)
          setClarificationPhase('questions')
          addToast({
            type: 'success',
            title: 'Questions Generated',
            description: `We've generated ${validQuestions.length} question${validQuestions.length === 1 ? '' : 's'} to help strengthen your plan.`,
          })
        } else {
          addToast({
            type: 'info',
            title: 'Plan Already Well-Defined',
            description: 'No clarification questions were generated. Your plan is already well-defined!',
          })
          setClarificationPhase('idle')
        }
      } else {
        // No questions generated, show message
        addToast({
          type: 'info',
          title: 'Plan Already Well-Defined',
          description: 'No clarification questions were generated. Your plan is already well-defined!',
        })
        setClarificationPhase('idle')
      }
    } catch (error) {
      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      // Handle network errors separately
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error generating clarification questions:', error)
        setClarificationError({
          title: 'Network Error',
          message: 'Failed to connect to server. Please check your internet connection and try again.'
        })
        setClarificationPhase('loading')
        return
      }
      
      console.error('Error generating clarification questions:', error)
      
      // Provide specific error messages based on error type
      let genErrorTitle = 'Failed to Generate Questions'
      let genErrorDescription = 'Failed to generate clarification questions. Please try again.'
      
      if (error instanceof Error) {
        if (error.message.includes('USAGE_LIMIT_EXCEEDED') || error.message.includes('credits')) {
          genErrorTitle = 'Feature Limit Reached'
          genErrorDescription = 'You have reached your plan\'s limit for this feature. Please upgrade your plan or wait for the next billing cycle.'
        } else if (error.message.includes('timeout') || error.message.includes('time out')) {
          genErrorTitle = 'Request Timeout'
          genErrorDescription = 'The request took too long. Please try again.'
        } else {
          genErrorDescription = error.message
        }
      }
      
      setClarificationError({
        title: genErrorTitle,
        message: genErrorDescription
      })
      setClarificationPhase('loading')
    } finally {
      setIsGeneratingQuestions(false)
      isRequestInFlightRef.current = false
      abortControllerRef.current = null
    }
  }

  const handleClarificationAnswer = (option: string) => {
    const question = clarificationQuestions[currentQuestionIndex]
    if (!question) return
    
    const questionType = question.type || 'single'
    const isOther = option.toLowerCase().trim() === 'other'
    
    if (questionType === 'multiple') {
      // Multi-select: toggle option in array
      const currentAnswer = clarificationAnswers[currentQuestionIndex.toString()]
      const selectedOptions = Array.isArray(currentAnswer) ? [...currentAnswer] : []
      
      if (isOther) {
        // Toggle "Other" option
        const otherIndex = selectedOptions.findIndex(opt => opt.toLowerCase().startsWith('other'))
        if (otherIndex >= 0) {
          selectedOptions.splice(otherIndex, 1)
        } else {
          const otherText = clarificationOtherTexts[currentQuestionIndex.toString()]?.trim() || ''
          selectedOptions.push(otherText ? `Other: ${otherText}` : 'Other')
        }
      } else {
        // Toggle regular option
        const optionIndex = selectedOptions.indexOf(option)
        if (optionIndex >= 0) {
          selectedOptions.splice(optionIndex, 1)
        } else {
          selectedOptions.push(option)
        }
      }
      
      const newAnswers = {
        ...clarificationAnswers,
        [currentQuestionIndex.toString()]: selectedOptions,
      }
      setClarificationAnswers(newAnswers)
    } else {
      // Single-select: replace with new selection
      let finalAnswer: string
      
      if (isOther) {
        // For "Other", use the custom text if provided, otherwise use "Other"
        const otherText = clarificationOtherTexts[currentQuestionIndex.toString()]?.trim() || ''
        finalAnswer = otherText ? `Other: ${otherText}` : 'Other'
      } else {
        finalAnswer = option
      }
      
      const newAnswers = {
        ...clarificationAnswers,
        [currentQuestionIndex.toString()]: finalAnswer,
      }
      setClarificationAnswers(newAnswers)

      if (currentQuestionIndex < clarificationQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
      } else {
        // All questions answered, move to free-text phase
        setClarificationPhase('freeText')
      }
    }
  }
  
  const handleMultiSelectContinue = () => {
    // For multi-select questions, allow continuing even if nothing selected (optional)
    if (currentQuestionIndex < clarificationQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // All questions answered, move to free-text phase
      setClarificationPhase('freeText')
    }
  }

  const handleFreeTextContinue = () => {
    setClarificationPhase('review')
  }

  const handleFreeTextSkip = () => {
    setAdditionalInfoText('')
    setClarificationPhase('review')
  }
  
  const handleOtherTextChange = (text: string) => {
    setClarificationOtherTexts({
      ...clarificationOtherTexts,
      [currentQuestionIndex.toString()]: text,
    })
    // Update answer if "Other" is selected
    const question = clarificationQuestions[currentQuestionIndex]
    const questionType = question?.type || 'single'
    const currentAnswer = clarificationAnswers[currentQuestionIndex.toString()]
    
    if (questionType === 'multiple') {
      // Update "Other" in array if it exists
      if (Array.isArray(currentAnswer)) {
        const updatedOptions = currentAnswer.map(opt => {
          if (opt.toLowerCase().startsWith('other')) {
            const trimmedText = text.trim()
            return trimmedText ? `Other: ${trimmedText}` : 'Other'
          }
          return opt
        })
        setClarificationAnswers({
          ...clarificationAnswers,
          [currentQuestionIndex.toString()]: updatedOptions,
        })
      }
    } else {
      // Single-select: update if "Other" is currently selected
      if (currentAnswer && typeof currentAnswer === 'string' && currentAnswer.toLowerCase().startsWith('other')) {
        const trimmedText = text.trim()
        setClarificationAnswers({
          ...clarificationAnswers,
          [currentQuestionIndex.toString()]: trimmedText ? `Other: ${trimmedText}` : 'Other',
        })
      }
    }
  }

  const handleClarificationCancel = () => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Reset clarification state
    setClarificationQuestions([])
    setClarificationAnswers({})
    setClarificationOtherTexts({})
    setCurrentQuestionIndex(0)
    setIsGeneratingQuestions(false)
    setIsRegenerating(false)
    setAdditionalInfoText('')
    setClarificationError(null)
    setClarificationPhase('idle')
    isRequestInFlightRef.current = false
    abortControllerRef.current = null
  }

  const handleClarificationBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    } else {
      // On first question, cancel the entire clarification flow
      handleClarificationCancel()
    }
  }

  const handleSubmitClarifications = async (answers?: Record<string, string | string[]>) => {
    if (!plan?.id) {
      addToast({
        type: 'error',
        title: 'Plan Not Found',
        description: 'Unable to submit clarifications. Please refresh the page and try again.',
      })
      return
    }
    
    // Validate we have questions
    if (clarificationQuestions.length === 0) {
      addToast({
        type: 'error',
        title: 'No Questions',
        description: 'No clarification questions available. Please try strengthening your plan again.',
      })
      return
    }
    
    // Prevent duplicate calls
    if (isRequestInFlightRef.current || isRegenerating) {
      return
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    isRequestInFlightRef.current = true

    const finalAnswers = answers || clarificationAnswers
    setIsRegenerating(true)

    try {
      // Validate all questions have corresponding answers
      // For single-select: answer must be non-empty string
      // For multi-select: answer can be empty array (optional)
      const missingAnswers: number[] = []
      clarificationQuestions.forEach((question, index) => {
        const answer = finalAnswers[index.toString()]
        if (answer === undefined) {
          missingAnswers.push(index + 1)
        } else if (question.type === 'single') {
          // Single-select requires a non-empty string
          if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
            missingAnswers.push(index + 1)
          }
        }
        // Multi-select questions are optional (empty array is valid)
      })
      
      if (missingAnswers.length > 0) {
        addToast({
          type: 'error',
          title: 'Missing Answers',
          description: `Please provide answers for all questions before submitting. Missing: Question ${missingAnswers.join(', ')}`,
        })
        return
      }
      
      // Format answers for API - use question text as key
      // Handle both string (single-select) and string[] (multi-select) answers
      const formattedAnswers: Record<string, string | string[]> = {}
      clarificationQuestions.forEach((question, index) => {
        const answer = finalAnswers[index.toString()]
        if (answer === undefined) {
          // For multi-select, default to empty array; for single-select, default to empty string
          formattedAnswers[question.text] = question.type === 'multiple' ? [] : ''
        } else if (question.type === 'multiple') {
          // Multi-select: ensure it's an array
          formattedAnswers[question.text] = Array.isArray(answer) ? answer : (answer ? [answer] : [])
        } else {
          // Single-select: ensure it's a string
          formattedAnswers[question.text] = Array.isArray(answer) ? answer.join(', ') : (answer || '')
        }
      })
      
      // Add free-text answer if provided
      const FREE_TEXT_QUESTION = "Any additional information you'd like to share?"
      formattedAnswers[FREE_TEXT_QUESTION] = additionalInfoText.trim()

      const response = await fetch(`/api/plans/${plan.id}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify({
          clarifications: formattedAnswers,
          clarificationQuestions: clarificationQuestions,
          timezone_offset: new Date().getTimezoneOffset(),
        }),
      })

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Invalid response format. Expected JSON but got ${contentType}. Status: ${response.status}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || `Failed to regenerate plan (${response.status})`)
      }

      // Refresh plan and tasks from database
      if (plan.id && user) {
        try {
          const { data: refreshedPlan, error: planError } = await supabase
            .from('plans')
            .select('*')
            .eq('id', plan.id)
            .eq('user_id', user.id)
            .single()

          if (!planError && refreshedPlan) {
            setPlan(refreshedPlan as any)
          }

          const { data: refreshedTasks, error: tasksError } = await supabase
            .from('tasks')
            .select(`
              *,
              task_schedule (
                id,
                date,
                start_time,
                end_time,
                duration_minutes
              )
            `)
            .eq('plan_id', plan.id)
            .eq('user_id', user.id)
            .order('idx', { ascending: true })

          if (!tasksError && refreshedTasks) {
            const tasksWithSchedule = (Array.isArray(refreshedTasks) ? refreshedTasks : []).map((task: any) => {
              const schedules = Array.isArray(task.task_schedule) ? task.task_schedule : []
              const primarySchedule = schedules[0] || null
              return {
                ...task,
                scheduled_date: primarySchedule?.date || null,
                start_time: primarySchedule?.start_time || null,
                end_time: primarySchedule?.end_time || null,
                estimated_duration_minutes: primarySchedule?.duration_minutes || task.estimated_duration_minutes || 0,
                schedule_id: primarySchedule?.id || null,
                schedules: schedules
              }
            })
            setTasks(wrapSortTasksChronologically(tasksWithSchedule as any))
          }
        } catch (refreshError) {
          console.error('Error refreshing plan data after regeneration:', refreshError)
          // Fallback to response data if refresh fails
          if (data.plan) {
            setPlan(data.plan as any)
          }
          if (data.tasks) {
            setTasks(data.tasks as Task[])
          }
        }
      } else {
        // Fallback if no planId or supabase - use response data
        if (data.plan) {
          setPlan(data.plan as any)
        }
        if (data.tasks) {
          setTasks(data.tasks as Task[])
        }
      }

      // Reset clarification UI
      setClarificationQuestions([])
      setCurrentQuestionIndex(0)
      setClarificationAnswers({})
      setClarificationOtherTexts({})
      setAdditionalInfoText('')
      setClarificationError(null)
      setClarificationPhase('idle')
      
      // Show success message with warning if schedule generation failed
      const message = data.scheduleGenerationSuccess !== false 
        ? 'Your plan has been updated with the new information.'
        : 'Your plan has been updated, but task schedules may be incomplete. Please review your plan.'
      
      addToast({
        type: data.scheduleGenerationSuccess !== false ? 'success' : 'warning',
        title: 'Plan Strengthened',
        description: message,
      })
    } catch (error) {
      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      // Handle network errors separately
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error regenerating plan:', error)
        addToast({
          type: 'error',
          title: 'Network Error',
          description: 'Failed to connect to server. Please check your internet connection and try again.',
        })
        return
      }
      
      console.error('Error regenerating plan:', error)
      // Keep questions visible so user can retry or skip
      // Don't reset clarification state - allow user to try again or skip
      
      // Provide specific error messages based on error type
      let regenErrorTitle = 'Regeneration Failed'
      let regenErrorDescription = 'Failed to regenerate plan. Please try again.'
      
      if (error instanceof Error) {
        if (error.message.includes('USAGE_LIMIT_EXCEEDED') || error.message.includes('credits')) {
          regenErrorTitle = 'Feature Limit Reached'
          regenErrorDescription = 'You have reached your plan\'s limit for this feature. Please upgrade your plan or wait for the next billing cycle.'
        } else if (error.message.includes('timeout') || error.message.includes('time out')) {
          regenErrorTitle = 'Request Timeout'
          regenErrorDescription = 'The request took too long. Please try again.'
        } else if (error.message.includes('INVALID_REQUEST') || error.message.includes('validation')) {
          regenErrorTitle = 'Invalid Request'
          regenErrorDescription = 'The submitted answers are invalid. Please check your responses and try again.'
        } else {
          regenErrorDescription = error.message
        }
      }
      
      setClarificationError({
        title: regenErrorTitle,
        message: regenErrorDescription
      })
      // Keep user in review phase so they can see the error and retry
      // Note: We keep clarificationQuestions visible so user can retry or skip
    } finally {
      setIsRegenerating(false)
      isRequestInFlightRef.current = false
      abortControllerRef.current = null
    }
  }

  const handleRegenerate = () => {
    // Show confirmation modal first
    setShowRegenerateConfirm(true)
  }

  const confirmRegenerate = async () => {
    setShowRegenerateConfirm(false)
    
    if (!plan?.id) {
      // If no plan ID, just redirect
      sessionStorage.removeItem('generatedPlan')
      router.push('/onboarding')
      return
    }

    try {
      // Delete the plan and its associated data
      const deleteResponse = await fetch('/api/plans/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: plan.id,
        }),
      })

      if (!deleteResponse.ok) {
        console.error('Failed to delete plan:', await deleteResponse.text())
        // Still redirect even if deletion fails
      } else {
        console.log('Plan and associated onboarding responses deleted successfully')
      }
    } catch (error) {
      console.error('Error deleting plan:', error)
      // Still redirect even if deletion fails
    }

    // Clear session storage and go back to onboarding
    sessionStorage.removeItem('generatedPlan')
    router.push('/onboarding')
  }

  // Conditional returns AFTER all hooks
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb] text-xl">Loading plan review...</div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb] text-xl">No plan data found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Timeline Section with Goal Header */}
        <FadeInWrapper delay={0.1} direction="up">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          {/* Goal Header */}
          <div className="mb-6">
            {!isEditingPlan ? (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--primary)] mb-2">
                      {(() => {
                        // Parse summary_data if it's a JSON string
                        let summaryData: any = plan.summary_data
                        if (typeof summaryData === 'string') {
                          try {
                            summaryData = JSON.parse(summaryData)
                          } catch {
                            summaryData = null
                          }
                        }
                        // Prioritize AI-generated goal_title
                        return summaryData?.goal_title || plan.goal_text || 'Untitled Plan'
                      })()}
                    </h1>
                    {(() => {
                      let summaryData: any = plan.summary_data
                      if (typeof summaryData === 'string') {
                        try {
                          summaryData = JSON.parse(summaryData)
                        } catch {
                          summaryData = null
                        }
                      }
                      return summaryData?.plan_summary ? (
                      <p className="text-lg text-[#d7d2cb]/70">
                          {summaryData.plan_summary}
                      </p>
                      ) : null
                    })()}
                  </div>
                  <button
                    onClick={handleEditPlan}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-1 rounded hover:bg-white/5"
                    title="Edit plan details"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                    Goal Title *
                  </label>
                  <input
                    type="text"
                    value={editedPlan?.goal_text || ''}
                    onChange={(e) => handlePlanInputChange('goal_text', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-3xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                    Plan Summary
                  </label>
                  <textarea
                    value={editedPlan?.plan_summary || ''}
                    onChange={(e) => handlePlanInputChange('plan_summary', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handlePlanCancel}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#d7d2cb] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePlanSave}
                    className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-lg transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Timeline Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {!isEditingPlan ? (
              <>
                <div>
                  <div className="text-sm text-[#d7d2cb]/60 mb-1">Start Date</div>
                  <div className="text-base font-medium text-[#d7d2cb]">
                    {startDate ? formatDateForDisplay(startDate, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[#d7d2cb]/60 mb-1">End Date</div>
                  <div className="text-base font-medium text-[#d7d2cb]">
                    {endDate ? formatDateForDisplay(endDate, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={editedPlan?.start_date || ''}
                    onChange={(e) => handlePlanInputChange('start_date', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={editedPlan?.end_date || ''}
                    onChange={(e) => handlePlanInputChange('end_date', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
              </>
            )}
            <div>
              <div className="text-sm text-[#d7d2cb]/60 mb-1">Total Duration</div>
              <div className="text-base font-medium text-[#d7d2cb]">
                {totalDurationMinutes} minutes
              </div>
            </div>
            <div>
              <div className="text-sm text-[#d7d2cb]/60 mb-1">Total Days</div>
              <div className="text-base font-medium text-[#d7d2cb]">
                {totalDays} {totalDays === 1 ? 'day' : 'days'}
              </div>
            </div>
            <div>
              <div className="text-sm text-[#d7d2cb]/60 mb-1">Total Tasks</div>
              <div className="text-base font-medium text-[#d7d2cb]">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </div>
            </div>
          </div>
          </div>
        </FadeInWrapper>

        {/* Tasks Section with Accordion */}
        <FadeInWrapper delay={0.2} direction="up">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-[#d7d2cb]">Tasks</h2>
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="space-y-2">
              {tasks.map((task, index) => {
                const isExpanded = expandedTaskId === task.id
                return (
                  <div key={task.id} className="border border-white/10 rounded-lg overflow-hidden">
                    {/* Collapsed Task Header */}
                    <button
                      onClick={() => handleTaskToggle(task.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-[var(--primary)] font-semibold">
                        {index + 1}.
                      </span>
                      <span className="flex-1 text-[#d7d2cb] font-medium">
                        {task.name || '(Untitled Task)'}
                      </span>
                      <div className="flex items-center gap-4 text-sm text-[#d7d2cb]/60">
                        {/* Display all schedule placements for split tasks */}
                        {(task as any).schedules && Array.isArray((task as any).schedules) && (task as any).schedules.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {(task as any).schedules.map((schedule: any, idx: number) => (
                              <span key={idx} className="whitespace-nowrap">
                                {formatDateForDisplay(parseDateFromDB(schedule.date), {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: undefined
                                })}
                                {schedule.start_time && schedule.end_time && (
                                  <> {formatTimeString(schedule.start_time)} - {formatTimeString(schedule.end_time)}</>
                                )}
                                {idx < (task as any).schedules.length - 1 && <span className="mx-1 text-[#d7d2cb]/40">|</span>}
                              </span>
                            ))}
                          </div>
                        ) : task.scheduled_date ? (
                          <>
                            <span>
                              {formatDateForDisplay(parseDateFromDB(task.scheduled_date), {
                                weekday: 'long',
                                month: 'short',
                                day: 'numeric',
                                year: undefined
                              })}
                            </span>
                            {task.start_time && task.end_time && (
                              <span>
                                {formatTimeString(task.start_time)} - {formatTimeString(task.end_time)}
                              </span>
                            )}
                          </>
                        ) : null}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[#d7d2cb]/60" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#d7d2cb]/60" />
                      )}
                    </button>

                    {/* Expanded Task Content */}
                    <AnimatePresence>
                      {isExpanded && editingTask && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 py-4 space-y-4 border-t border-white/10">
                            {/* Task Name */}
                            <div>
                              <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                Task Name *
                              </label>
                              <input
                                type="text"
                                value={editingTask.name || ''}
                                onChange={(e) => handleTaskInputChange('name', e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                placeholder="Enter task name"
                              />
                            </div>

                            {/* Description */}
                            <div>
                              <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                Description
                              </label>
                              <textarea
                                value={editingTask.details || ''}
                                onChange={(e) => handleTaskInputChange('details', e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                                placeholder="Enter task description"
                              />
                            </div>

                            {/* Date and Time Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Scheduled Date */}
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={editingTask.scheduled_date 
                                    ? (editingTask.scheduled_date.includes('T') 
                                      ? editingTask.scheduled_date.split('T')[0] 
                                      : editingTask.scheduled_date)
                                    : ''}
                                  onChange={(e) => handleTaskInputChange('scheduled_date', e.target.value)}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                />
                              </div>

                              {/* Start Time */}
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                  Start Time
                                </label>
                                <input
                                  type={timeFormat === '24h' ? 'time' : 'text'}
                                  value={timeFormat === '24h' 
                                    ? (editingTask.start_time || '')
                                    : formatTimeString(editingTask.start_time)}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (timeFormat === '24h') {
                                      handleTaskInputChange('start_time', value)
                                    } else {
                                      // Parse 12-hour format back to 24-hour
                                      const parsed = parseTimeString(value)
                                      if (parsed) handleTaskInputChange('start_time', parsed)
                                    }
                                  }}
                                  placeholder={timeFormat === '12h' ? '9:00 AM' : '09:00'}
                                  pattern={timeFormat === '24h' ? undefined : '^([0-9]|0[0-9]|1[0-2]):[0-5][0-9] (AM|PM)$'}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                />
                              </div>

                              {/* End Time */}
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                  End Time
                                </label>
                                <input
                                  type={timeFormat === '24h' ? 'time' : 'text'}
                                  value={timeFormat === '24h'
                                    ? (editingTask.end_time || '')
                                    : formatTimeString(editingTask.end_time)}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (timeFormat === '24h') {
                                      handleTaskInputChange('end_time', value)
                                    } else {
                                      // Parse 12-hour format back to 24-hour
                                      const parsed = parseTimeString(value)
                                      if (parsed) handleTaskInputChange('end_time', parsed)
                                    }
                                  }}
                                  placeholder={timeFormat === '12h' ? '5:00 PM' : '17:00'}
                                  pattern={timeFormat === '24h' ? undefined : '^([0-9]|0[0-9]|1[0-2]):[0-5][0-9] (AM|PM)$'}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                />
                              </div>
                            </div>

                            {/* Duration and Priority Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Duration - Read-only, calculated from start/end times */}
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                  Duration (minutes) *
                                </label>
                                <input
                                  type="number"
                                  value={editingTask.start_time && editingTask.end_time 
                                    ? calculateDuration(editingTask.start_time, editingTask.end_time)
                                    : (editingTask.estimated_duration_minutes || 0)}
                                  readOnly
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]/60 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                                  min="1"
                                />
                                <p className="text-xs text-[#d7d2cb]/50 mt-1">
                                  Auto-calculated from start and end times
                                </p>
                              </div>

                              {/* Priority */}
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                  Priority
                                </label>
                                <select
                                  value={editingTask.priority || 1}
                                  onChange={(e) => handleTaskInputChange('priority', parseInt(e.target.value) as 1 | 2 | 3 | 4)}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                >
                                  <option value={1}>1 - Low</option>
                                  <option value={2}>2 - Medium</option>
                                  <option value={3}>3 - High</option>
                                  <option value={4}>4 - Critical</option>
                                </select>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-between pt-2">
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Task
                              </button>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleTaskCancel}
                                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#d7d2cb] transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                                <button
                                  onClick={handleTaskSave}
                                  className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-lg transition-colors"
                                >
                                  <Save className="w-4 h-4" />
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Add New Task Button */}
            <button
              onClick={handleAddNewTask}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-white/20 hover:border-[var(--primary)] rounded-lg text-[#d7d2cb]/60 hover:text-[var(--primary)] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add New Task
            </button>
          </div>
          </div>
        </FadeInWrapper>


        {/* Action Buttons */}
        <FadeInWrapper delay={0.4} direction="up">
          <div className="flex justify-center gap-4 pt-4">
          <Button
            onClick={handleRegenerate}
            variant="outline"
            className="flex items-center gap-2 px-8"
            disabled={isGeneratingQuestions || isRegenerating || clarificationPhase !== 'idle'}
          >
            <RotateCcw className="w-4 h-4" />
            Regenerate Plan
          </Button>
          <Button
            onClick={handleAcceptPlan}
            className="flex items-center gap-2 px-8 bg-[var(--primary)] hover:bg-[var(--primary)]/90"
            disabled={isGeneratingQuestions || isRegenerating || clarificationPhase !== 'idle'}
          >
            <CheckCircle className="w-4 h-4" />
            Accept Plan
          </Button>
          </div>
        </FadeInWrapper>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4">Delete Task?</h3>
            <p className="text-base text-[#d7d2cb]/80 mb-6">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setTaskToDelete(null)
                }} 
                variant="outline" 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmDeleteTask} 
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Plan Confirmation Modal */}
      <AnimatePresence>
        {showRegenerateConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 max-w-md w-full"
            >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <RotateCcw className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold text-[#d7d2cb]">Regenerate Plan?</h3>
            </div>
            <div className="mb-6">
              <p className="text-base text-[#d7d2cb]/80 mb-3">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-[#d7d2cb]/70 ml-2">
                <li>Your generated plan and all its tasks</li>
                <li>Your onboarding responses</li>
              </ul>
              <p className="text-base text-[#d7d2cb]/80 mt-4">
                You will be redirected to create a new plan. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={() => setShowRegenerateConfirm(false)} 
                variant="outline" 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmRegenerate} 
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                Yes, Regenerate
              </Button>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>

      {/* Strengthen Plan Modal */}
      <StrengthenPlanModal
        isOpen={showStrengthenPlanModal}
        onClose={() => handleSkipStrengthenPlan(false)}
        onStrengthen={handleStrengthenPlanFromModal}
        onSkip={handleSkipStrengthenPlan}
      />

      {/* Plan Selection Modal - Shows for basic plan users on page load */}
      {hasBasicPlan && (
        <PlanSelectionModal
          isOpen={showPlanSelectionModal}
          onClose={() => {
            setShowPlanSelectionModal(false)
          }}
        />
      )}

      {/* Fixed Bottom-Right Circular Strengthen Button */}
      {plan?.id && clarificationPhase === 'idle' && (
        <AnimatePresence>
          <motion.button
            key="strengthen-button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={showStrengthenPlanModal ? handleStrengthenPlanFromModal : handleStrengthenPlan}
            disabled={isGeneratingQuestions || isRegenerating}
            className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation ${
              showStrengthenPlanModal
                ? 'animate-purple-glow cursor-pointer'
                : 'shadow-purple-600/25 hover:shadow-purple-600/35'
            }`}
            aria-label="Strengthen plan"
            title="Strengthen plan"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        </AnimatePresence>
      )}

      {/* Loading Spinner - appears when generating questions */}
      {clarificationPhase === 'loading' && !clarificationError && (
        <AnimatePresence>
          <motion.div
            key="loading-spinner"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-purple-600/90 text-white shadow-lg shadow-purple-600/25 flex items-center justify-center"
            aria-label="Generating questions"
            role="status"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Floating Clarification Panel */}
      {(clarificationPhase === 'questions' || clarificationPhase === 'freeText' || clarificationPhase === 'review' || (clarificationPhase === 'loading' && clarificationError)) && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-full max-w-md bg-[#0a0a0a] border border-white/20 rounded-xl shadow-2xl max-h-[85vh] flex flex-col"
            style={{ maxWidth: '400px' }}
            role="dialog"
            aria-labelledby="clarification-panel-title"
            aria-modal="true"
          >
            {/* Error State */}
            {clarificationError && (() => {
              const error: { title: string; message: string } = clarificationError
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6"
                >
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                    <h4 className="text-lg font-semibold text-red-400 mb-2">{error.title}</h4>
                    <p className="text-sm text-red-300">{error.message}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClarificationCancel}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    {clarificationPhase === 'loading' && (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleStrengthenPlan}
                        className="flex-1"
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                </motion.div>
              )
            })()}

            {/* Question Panel */}
            {clarificationPhase === 'questions' && !clarificationError && (
              <div className="p-6 flex flex-col h-full max-h-[85vh]">
                {/* Header with Close Button */}
                <div className="flex items-center justify-between mb-4">
                  <h3 id="clarification-panel-title" className="text-lg font-semibold text-[#d7d2cb]">Strengthen Your Plan</h3>
                  <button
                    onClick={handleClarificationCancel}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 rounded hover:bg-white/5 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Close clarification panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Indicator */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#d7d2cb]/70">
                      Question {currentQuestionIndex + 1} of {clarificationQuestions.length}
                    </span>
                    <span className="text-sm text-[#d7d2cb]/70">
                      {Math.round(((currentQuestionIndex + 1) / clarificationQuestions.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[var(--primary)] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentQuestionIndex + 1) / clarificationQuestions.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Question Content */}
                <div className="flex-1 overflow-y-auto mb-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentQuestionIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <h4 className="text-xl font-semibold text-[#d7d2cb] mb-2">
                        {clarificationQuestions[currentQuestionIndex]?.text || ''}
                      </h4>
                      {clarificationQuestions[currentQuestionIndex]?.type === 'multiple' && (
                        <p className="text-sm text-[#d7d2cb]/60 mb-4">Check all that apply</p>
                      )}
                      <div className="space-y-3">
                        {clarificationQuestions[currentQuestionIndex]?.options.map((option, optionIndex) => {
                          const question = clarificationQuestions[currentQuestionIndex]
                          const questionType = question?.type || 'single'
                          const isOther = option.toLowerCase().trim() === 'other'
                          const currentAnswer = clarificationAnswers[currentQuestionIndex.toString()]
                          
                          let isSelected: boolean
                          if (questionType === 'multiple') {
                            // Multi-select: check if option is in array
                            const selectedOptions = Array.isArray(currentAnswer) ? currentAnswer : []
                            if (isOther) {
                              isSelected = selectedOptions.some(opt => opt.toLowerCase().startsWith('other'))
                            } else {
                              isSelected = selectedOptions.includes(option)
                            }
                          } else {
                            // Single-select: check equality
                            if (isOther) {
                              isSelected = currentAnswer && typeof currentAnswer === 'string' && currentAnswer.toLowerCase().startsWith('other')
                            } else {
                              isSelected = currentAnswer === option
                            }
                          }
                          
                          return (
                            <div key={optionIndex}>
                              <button
                                type="button"
                                onClick={() => handleClarificationAnswer(option)}
                                className={`w-full text-left px-4 py-3 min-h-[44px] rounded-lg border-2 transition-all touch-manipulation ${
                                  isSelected
                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                                    : 'border-white/10 bg-white/5 text-[#d7d2cb] hover:border-white/20 hover:bg-white/10'
                                }`}
                                aria-pressed={isSelected}
                                aria-label={`Select option: ${option}`}
                              >
                                <div className="flex items-center gap-3">
                                  {questionType === 'multiple' ? (
                                    // Checkbox for multi-select
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                      isSelected
                                        ? 'border-[var(--primary)] bg-[var(--primary)]'
                                        : 'border-white/30'
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  ) : (
                                    // Radio button for single-select
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                      isSelected
                                        ? 'border-[var(--primary)] bg-[var(--primary)]'
                                        : 'border-white/30'
                                    }`}>
                                      {isSelected && (
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                      )}
                                    </div>
                                  )}
                                  <span className="flex-1 font-medium">{option}</span>
                                </div>
                              </button>
                              {isOther && isSelected && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-2 ml-8"
                                >
                                  <input
                                    type="text"
                                    value={clarificationOtherTexts[currentQuestionIndex.toString()] || ''}
                                    onChange={(e) => handleOtherTextChange(e.target.value)}
                                    placeholder="Please specify..."
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                                    autoFocus
                                  />
                                </motion.div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClarificationBack}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                  </Button>

                  {clarificationQuestions[currentQuestionIndex]?.type === 'multiple' ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleMultiSelectContinue}
                      className="flex items-center gap-2"
                    >
                      Next
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        const answer = clarificationAnswers[currentQuestionIndex.toString()]
                        const question = clarificationQuestions[currentQuestionIndex]
                        if (!question) return
                        
                        // Validate answer exists for single-select
                        if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
                          addToast({
                            type: 'error',
                            title: 'Please Select',
                            description: 'Please select an option before continuing.',
                          })
                          return
                        }
                        
                        if (typeof answer === 'string' && answer.toLowerCase().startsWith('other')) {
                          const otherText = clarificationOtherTexts[currentQuestionIndex.toString()]?.trim()
                          if (!otherText) {
                            addToast({
                              type: 'error',
                              title: 'Please Specify',
                              description: 'Please provide your answer in the "Other" field.',
                            })
                            return
                          }
                        }
                        
                        if (currentQuestionIndex < clarificationQuestions.length - 1) {
                          setCurrentQuestionIndex(currentQuestionIndex + 1)
                        } else {
                          setClarificationPhase('freeText')
                        }
                      }}
                      disabled={!clarificationAnswers[currentQuestionIndex.toString()] || (typeof clarificationAnswers[currentQuestionIndex.toString()] === 'string' && clarificationAnswers[currentQuestionIndex.toString()].trim() === '')}
                      className="flex items-center gap-2"
                    >
                    {currentQuestionIndex === clarificationQuestions.length - 1 ? (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Free Text Panel */}
            {clarificationPhase === 'freeText' && !clarificationError && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="p-6 flex flex-col h-full max-h-[85vh]"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#d7d2cb]">Additional Information</h3>
                  <button
                    onClick={handleClarificationCancel}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 rounded hover:bg-white/5 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Close clarification panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-base text-[#d7d2cb] mb-4">
                  Any additional information you'd like to share?
                </p>

                <div className="flex-1 mb-4">
                  <textarea
                    value={additionalInfoText}
                    onChange={(e) => setAdditionalInfoText(e.target.value)}
                    placeholder="Type your additional information here..."
                    className="w-full h-full min-h-[150px] px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all resize-none text-base"
                    maxLength={500}
                    aria-label="Additional information input"
                  />
                  <p className="text-xs text-[#d7d2cb]/50 mt-2 text-right">
                    {additionalInfoText.length}/500
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFreeTextSkip}
                    className="flex-1"
                  >
                    Skip
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleFreeTextContinue}
                    className="flex-1 flex items-center gap-2"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Review Panel */}
            {clarificationPhase === 'review' && !clarificationError && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="p-6 flex flex-col h-full max-h-[85vh]"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#d7d2cb]">Review Your Answers</h3>
                  <button
                    onClick={handleClarificationCancel}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 rounded hover:bg-white/5 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Close clarification panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 space-y-4" role="region" aria-label="Review answers">
                  {clarificationQuestions.map((question, index) => {
                    const answer = clarificationAnswers[index.toString()] || ''
                    const displayAnswer = answer.startsWith('Other: ') ? answer.substring(7) : answer
                    
                    return (
                      <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <p className="text-sm text-[#d7d2cb]/70 mb-2">{question.text}</p>
                        <p className="text-base font-medium text-[#d7d2cb]">{displayAnswer || 'Not answered'}</p>
                      </div>
                    )
                  })}
                  
                  {/* Free text answer if provided */}
                  {additionalInfoText.trim() && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <p className="text-sm text-[#d7d2cb]/70 mb-2">Any additional information you'd like to share?</p>
                      <p className="text-base font-medium text-[#d7d2cb]">{additionalInfoText}</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/10">
                  {(() => {
                    if (!clarificationError) {
                      return (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => handleSubmitClarifications()}
                          disabled={isRegenerating}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          {isRegenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Strengthening Plan...
                            </>
                          ) : (
                            <>
                              Strengthen Plan
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </Button>
                      )
                    }
                    const error: { title: string; message: string } = clarificationError
                    return (
                      <div className="space-y-3">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-red-400 mb-1">{error.title}</h4>
                          <p className="text-xs text-red-300">{error.message}</p>
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => {
                            setClarificationError(null)
                            handleSubmitClarifications()
                          }}
                          disabled={isRegenerating}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          {isRegenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Strengthening Plan...
                            </>
                          ) : (
                            <>
                              Try Again
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    )
                  })()}
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

    </div>
  )
}