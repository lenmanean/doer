'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Check, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'

interface Plan {
  id: string
  goal_text: string
  summary_data?: {
    goal_title?: string
  }
}

interface Task {
  schedule_id: string
  task_id: string
  name: string
  date: string
  start_time: string
  end_time: string
  plan_id: string | null
  is_calendar_event?: boolean
}

interface PushToCalendarPanelProps {
  isOpen: boolean
  onClose: () => void
  provider: 'google' | 'outlook' | 'apple'
  connectionId?: string
  selectedCalendarIds: string[]
}

export function PushToCalendarPanel({
  isOpen,
  onClose,
  provider,
  connectionId,
  selectedCalendarIds,
}: PushToCalendarPanelProps) {
  const { addToast } = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set())
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())
  const [tasksByPlan, setTasksByPlan] = useState<Record<string, Task[]>>({})
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [selectedTaskScheduleIds, setSelectedTaskScheduleIds] = useState<Set<string>>(new Set())
  const [dateRangeDays, setDateRangeDays] = useState<number>(30)
  const [pushing, setPushing] = useState(false)

  // Calculate date range
  const getDateRange = useCallback(() => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - dateRangeDays)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + dateRangeDays)
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    }
  }, [dateRangeDays])

  // Load plans
  useEffect(() => {
    if (!isOpen) return
    
    const loadPlans = async () => {
      try {
        setLoadingPlans(true)
        const response = await fetch('/api/plans')
        if (response.ok) {
          const data = await response.json()
          const allPlans = Array.isArray(data.plans) ? data.plans : []
          // Filter out integration plans
          const filteredPlans = allPlans.filter((plan: any) => plan.plan_type !== 'integration')
          setPlans(filteredPlans)
        }
      } catch (error) {
        console.error('Error loading plans:', error)
        addToast({
          type: 'error',
          title: 'Failed to load plans',
          description: 'Please try again later.',
          duration: 5000,
        })
      } finally {
        setLoadingPlans(false)
      }
    }
    
    loadPlans()
  }, [isOpen, addToast])

  // Load tasks for selected plans
  useEffect(() => {
    if (!isOpen || selectedPlanIds.size === 0) {
      setTasksByPlan({})
      return
    }
    
    const loadTasks = async () => {
      try {
        setLoadingTasks(true)
        const dateRange = getDateRange()
        const allTasks: Record<string, Task[]> = {}
        
        // Load tasks for each selected plan
        for (const planId of selectedPlanIds) {
          try {
            const response = await fetch(
              `/api/tasks/time-schedule?plan_id=${planId}&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`
            )
            if (response.ok) {
              const data = await response.json()
              const tasks: Task[] = []
              
              if (data.tasksByDate) {
                Object.entries(data.tasksByDate).forEach(([date, dateTasks]: [string, any]) => {
                  const filtered = (dateTasks as any[]).filter(
                    (t: any) => t.schedule_id && !t.schedule_id.startsWith('synthetic-') && !t.is_calendar_event
                  )
                  filtered.forEach((task: any) => {
                    tasks.push({
                      schedule_id: task.schedule_id,
                      task_id: task.task_id,
                      name: task.name,
                      date,
                      start_time: task.start_time || '',
                      end_time: task.end_time || '',
                      plan_id: planId,
                    })
                  })
                })
              }
              
              allTasks[planId] = tasks
            }
          } catch (error) {
            console.error(`Error loading tasks for plan ${planId}:`, error)
          }
        }
        
        // Also load free-mode tasks (plan_id = null)
        if (selectedPlanIds.has('free-mode')) {
          try {
            const response = await fetch(
              `/api/tasks/time-schedule?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`
            )
            if (response.ok) {
              const data = await response.json()
              const tasks: Task[] = []
              
              if (data.tasksByDate) {
                Object.entries(data.tasksByDate).forEach(([date, dateTasks]: [string, any]) => {
                  const filtered = (dateTasks as any[]).filter(
                    (t: any) => t.schedule_id && !t.schedule_id.startsWith('synthetic-') && !t.is_calendar_event && !t.plan_id
                  )
                  filtered.forEach((task: any) => {
                    tasks.push({
                      schedule_id: task.schedule_id,
                      task_id: task.task_id,
                      name: task.name,
                      date,
                      start_time: task.start_time || '',
                      end_time: task.end_time || '',
                      plan_id: null,
                    })
                  })
                })
              }
              
              allTasks['free-mode'] = tasks
            }
          } catch (error) {
            console.error('Error loading free-mode tasks:', error)
          }
        }
        
        setTasksByPlan(allTasks)
      } catch (error) {
        console.error('Error loading tasks:', error)
        addToast({
          type: 'error',
          title: 'Failed to load tasks',
          description: 'Please try again later.',
          duration: 5000,
        })
      } finally {
        setLoadingTasks(false)
      }
    }
    
    loadTasks()
  }, [isOpen, selectedPlanIds, getDateRange, addToast])

  const togglePlan = (planId: string) => {
    setSelectedPlanIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(planId)) {
        newSet.delete(planId)
      } else {
        newSet.add(planId)
      }
      return newSet
    })
  }

  const togglePlanExpand = (planId: string) => {
    setExpandedPlans(prev => {
      const newSet = new Set(prev)
      if (newSet.has(planId)) {
        newSet.delete(planId)
      } else {
        newSet.add(planId)
      }
      return newSet
    })
  }

  const toggleTask = (scheduleId: string) => {
    setSelectedTaskScheduleIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(scheduleId)) {
        newSet.delete(scheduleId)
      } else {
        newSet.add(scheduleId)
      }
      return newSet
    })
  }

  const selectAllTasksInPlan = (planId: string) => {
    const tasks = tasksByPlan[planId] || []
    setSelectedTaskScheduleIds(prev => {
      const newSet = new Set(prev)
      tasks.forEach(task => newSet.add(task.schedule_id))
      return newSet
    })
  }

  const deselectAllTasksInPlan = (planId: string) => {
    const tasks = tasksByPlan[planId] || []
    setSelectedTaskScheduleIds(prev => {
      const newSet = new Set(prev)
      tasks.forEach(task => newSet.delete(task.schedule_id))
      return newSet
    })
  }

  const handlePush = async () => {
    if (selectedTaskScheduleIds.size === 0) {
      toast.addToast({
        type: 'warning',
        title: 'No tasks selected',
        description: 'Please select at least one task to push.',
        duration: 5000,
      })
      return
    }

    if (!connectionId) {
      toast.addToast({
        type: 'error',
        title: 'No connection',
        description: 'Please connect your calendar first.',
        duration: 5000,
      })
      return
    }

    try {
      setPushing(true)
      const dateRange = getDateRange()
      
      const response = await fetch(`/api/integrations/${provider}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_schedule_ids: Array.from(selectedTaskScheduleIds),
          date_range: dateRange,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to push tasks')
      }

      const data = await response.json()

      toast.addToast({
        type: 'success',
        title: 'Push completed',
        description: `Pushed ${data.events_pushed} task(s) to ${provider === 'google' ? 'Google Calendar' : provider === 'outlook' ? 'Microsoft Outlook' : 'Apple Calendar'}.`,
        duration: 7000,
      })

      onClose()
    } catch (error) {
      console.error('Error pushing tasks:', error)
      toast.addToast({
        type: 'error',
        title: 'Push failed',
        description: error instanceof Error ? error.message : 'Please try again later.',
        duration: 5000,
      })
    } finally {
      setPushing(false)
    }
  }

  const getPlanName = (plan: Plan | 'free-mode') => {
    if (plan === 'free-mode') {
      return 'Free Mode Tasks'
    }
    return plan.summary_data?.goal_title || plan.goal_text || 'Untitled Plan'
  }

  const totalTasks = Object.values(tasksByPlan).reduce((sum, tasks) => sum + tasks.length, 0)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-[var(--background)] border-l border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--foreground)]">
                    Push Tasks to Calendar
                  </h2>
                  <p className="text-sm text-[var(--foreground)]/60 mt-1">
                    Select tasks from your plans to push to {provider === 'google' ? 'Google Calendar' : provider === 'outlook' ? 'Microsoft Outlook' : 'Apple Calendar'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--foreground)]" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Date Range */}
                <div>
                  <label className="text-sm font-medium text-[var(--foreground)] block mb-2">
                    Date Range (days before/after today)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={dateRangeDays}
                      onChange={(e) => {
                        const value = parseInt(e.target.value)
                        if (value >= 1 && value <= 365) {
                          setDateRangeDays(value)
                        }
                      }}
                      className="w-24 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                    <p className="text-xs text-[var(--foreground)]/60">
                      {getDateRange().start_date} to {getDateRange().end_date}
                    </p>
                  </div>
                </div>

                {/* Plans List */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                    Select Plans ({selectedPlanIds.size} selected)
                  </h3>
                  
                  {loadingPlans ? (
                    <div className="space-y-2">
                      <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                      <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                    </div>
                  ) : plans.length === 0 ? (
                    <p className="text-sm text-[var(--foreground)]/60 text-center py-8">
                      No plans found. Create a plan to push tasks.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {/* Free Mode Option */}
                      <label className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedPlanIds.has('free-mode')}
                          onChange={() => togglePlan('free-mode')}
                          className="w-4 h-4 rounded border-white/20"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            Free Mode Tasks
                          </p>
                          <p className="text-xs text-[var(--foreground)]/60">
                            Tasks without a plan
                          </p>
                        </div>
                        {tasksByPlan['free-mode'] && (
                          <Badge variant="outline">
                            {tasksByPlan['free-mode'].length} tasks
                          </Badge>
                        )}
                      </label>
                      
                      {/* Regular Plans */}
                      {plans.map((plan) => {
                        const isSelected = selectedPlanIds.has(plan.id)
                        const isExpanded = expandedPlans.has(plan.id)
                        const tasks = tasksByPlan[plan.id] || []
                        const selectedInPlan = tasks.filter(t => selectedTaskScheduleIds.has(t.schedule_id)).length
                        
                        return (
                          <div key={plan.id} className="border border-white/10 rounded-lg overflow-hidden">
                            <label className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePlan(plan.id)}
                                className="w-4 h-4 rounded border-white/20"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  togglePlanExpand(plan.id)
                                }}
                                className="p-1 hover:bg-white/10 rounded"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-[var(--foreground)]/60" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-[var(--foreground)]/60" />
                                )}
                              </button>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-[var(--foreground)]">
                                  {getPlanName(plan)}
                                </p>
                                {isSelected && tasks.length > 0 && (
                                  <p className="text-xs text-[var(--foreground)]/60">
                                    {selectedInPlan} of {tasks.length} tasks selected
                                  </p>
                                )}
                              </div>
                              {tasks.length > 0 && (
                                <Badge variant="outline">
                                  {tasks.length} tasks
                                </Badge>
                              )}
                            </label>
                            
                            {isExpanded && isSelected && (
                              <div className="border-t border-white/10 p-3 space-y-2">
                                {loadingTasks ? (
                                  <div className="text-sm text-[var(--foreground)]/60">Loading tasks...</div>
                                ) : tasks.length === 0 ? (
                                  <p className="text-sm text-[var(--foreground)]/60">
                                    No tasks in date range
                                  </p>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs text-[var(--foreground)]/60">
                                        Select tasks
                                      </span>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => selectAllTasksInPlan(plan.id)}
                                          className="text-xs text-[var(--primary)] hover:underline"
                                        >
                                          Select All
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deselectAllTasksInPlan(plan.id)}
                                          className="text-xs text-[var(--foreground)]/60 hover:underline"
                                        >
                                          Deselect All
                                        </button>
                                      </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-1">
                                      {tasks.map((task) => {
                                        const isTaskSelected = selectedTaskScheduleIds.has(task.schedule_id)
                                        return (
                                          <label
                                            key={task.schedule_id}
                                            className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isTaskSelected}
                                              onChange={() => toggleTask(task.schedule_id)}
                                              className="w-3 h-3 rounded border-white/20"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-medium text-[var(--foreground)] truncate">
                                                {task.name}
                                              </p>
                                              <p className="text-xs text-[var(--foreground)]/60">
                                                {task.date} {task.start_time} - {task.end_time}
                                              </p>
                                            </div>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {selectedTaskScheduleIds.size} task(s) selected
                    </p>
                    <p className="text-xs text-[var(--foreground)]/60">
                      Total tasks in range: {totalTasks}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePush}
                    disabled={pushing || selectedTaskScheduleIds.size === 0 || !connectionId}
                    className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white"
                  >
                    {pushing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Pushing...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Push to Calendar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

