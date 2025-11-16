// src/app/onboarding/review/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Task } from '@/lib/types'
import { formatDateForDisplay, parseDateFromDB } from '@/lib/date-utils'
import { CheckCircle, RotateCcw, ChevronDown, ChevronUp, Plus, Save, X, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import type { ReviewPlanData } from '@/lib/types/roadmap'

export default function ReviewPage() {
  const router = useRouter()
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

  useEffect(() => {
    // Load plan data from session storage
    const bootstrap = async () => {
      try {
        const planData = sessionStorage.getItem('generatedPlan')
        if (planData) {
          try {
            const parsed = JSON.parse(planData)
            if (parsed?.plan) setPlan(parsed.plan)
            if (Array.isArray(parsed?.tasks)) setTasks(parsed.tasks)
          } catch (error) {
            console.error('Error parsing plan data:', error)
          }
        }
        // Fallback: fetch latest active plan + tasks from DB if sessionStorage missing or empty
        if (!plan || !Array.isArray(tasks) || tasks.length === 0) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: latestPlan } = await supabase
              .from('plans')
              .select('*')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            if (latestPlan) {
              setPlan(latestPlan as any)
              const { data: fetchedTasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .eq('plan_id', latestPlan.id)
                .order('idx', { ascending: true })
              setTasks(Array.isArray(fetchedTasks) ? (fetchedTasks as any) : [])
              // Refresh sessionStorage for subsequent loads
              sessionStorage.setItem('generatedPlan', JSON.stringify({ plan: latestPlan, tasks: fetchedTasks || [] }))
            }
          }
        }
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [router])

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

  const handleTaskSave = () => {
    if (editingTask) {
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(t => 
          t.id === editingTask.id ? { ...t, ...editingTask } : t
        )
        // Update sessionStorage with modified tasks
        const planData = sessionStorage.getItem('generatedPlan')
        if (planData) {
          try {
            const parsed = JSON.parse(planData)
            parsed.tasks = updatedTasks
            sessionStorage.setItem('generatedPlan', JSON.stringify(parsed))
          } catch (error) {
            console.error('Error updating session storage:', error)
          }
        }
        return updatedTasks
      })
      setEditingTask(null)
      setExpandedTaskId(null)
    }
  }

  const handleTaskCancel = () => {
    setEditingTask(null)
    setExpandedTaskId(null)
  }

  const handleTaskInputChange = (field: keyof Task, value: any) => {
    if (editingTask) {
      setEditingTask({ ...editingTask, [field]: value })
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

  const handlePlanSave = () => {
    if (editedPlan) {
      setPlan((prevPlan: any) => ({
        ...prevPlan,
        start_date: editedPlan.start_date,
        end_date: editedPlan.end_date,
        summary_data: {
          ...prevPlan.summary_data,
          goal_text: editedPlan.goal_text,
          plan_summary: editedPlan.plan_summary
        }
      }))
      
      // Update sessionStorage
      const planData = sessionStorage.getItem('generatedPlan')
      if (planData) {
        try {
          const parsed = JSON.parse(planData)
          parsed.plan = {
            ...parsed.plan,
            start_date: editedPlan.start_date,
            end_date: editedPlan.end_date,
            summary_data: {
              ...parsed.plan.summary_data,
              goal_text: editedPlan.goal_text,
              plan_summary: editedPlan.plan_summary
            }
          }
          sessionStorage.setItem('generatedPlan', JSON.stringify(parsed))
        } catch (error) {
          console.error('Error updating session storage:', error)
        }
      }
      
      setIsEditingPlan(false)
      setEditedPlan(null)
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
    // Plan is already saved to DB by /api/plans/generate
    
    try {
      // ✅ VALIDATE AUTH SESSION before redirecting
      console.log('[Review] Validating auth session before dashboard redirect...')
      
      const healthCheck = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!healthCheck.ok) {
        console.error('[Review] Auth session not valid, refreshing...')
        const { data: { user: verifiedUser }, error } = await supabase.auth.getUser()
        if (error || !verifiedUser) {
          console.error('[Review] User verification failed:', error)
          alert('Your session has expired. Please sign in again.')
          router.push('/login')
          return
        }
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
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          {/* Goal Header */}
          <div className="mb-6">
            {!isEditingPlan ? (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-[var(--primary)] mb-2">
                      {plan.summary_data?.goal_title || plan.summary_data?.goal_text || plan.goal_text}
                    </h1>
                    {plan.summary_data?.plan_summary && (
                      <p className="text-lg text-[#d7d2cb]/70">
                        {plan.summary_data.plan_summary}
                      </p>
                    )}
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

        {/* Tasks Section with Accordion */}
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
                                  <> {schedule.start_time} - {schedule.end_time}</>
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
                                {task.start_time} - {task.end_time}
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
                                  value={editingTask.scheduled_date || ''}
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
                                  type="time"
                                  value={editingTask.start_time || ''}
                                  onChange={(e) => handleTaskInputChange('start_time', e.target.value)}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                />
                              </div>

                              {/* End Time */}
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                  End Time
                                </label>
                                <input
                                  type="time"
                                  value={editingTask.end_time || ''}
                                  onChange={(e) => handleTaskInputChange('end_time', e.target.value)}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                />
                              </div>
                            </div>

                            {/* Duration and Priority Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Duration */}
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                  Duration (minutes) *
                                </label>
                                <input
                                  type="number"
                                  value={editingTask.estimated_duration_minutes || 0}
                                  onChange={(e) => handleTaskInputChange('estimated_duration_minutes', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                  min="1"
                                />
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

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pt-4">
          <Button
            onClick={handleRegenerate}
            variant="outline"
            className="flex items-center gap-2 px-8"
          >
            <RotateCcw className="w-4 h-4" />
            Regenerate Plan
          </Button>
          <Button
            onClick={handleAcceptPlan}
            className="flex items-center gap-2 px-8 bg-[var(--primary)] hover:bg-[var(--primary)]/90"
          >
            <CheckCircle className="w-4 h-4" />
            Accept Plan
          </Button>
        </div>
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
    </div>
  )
}