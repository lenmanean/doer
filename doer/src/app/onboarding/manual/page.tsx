'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Task } from '@/lib/types'
import { CheckCircle, RotateCcw, ChevronDown, ChevronUp, Plus, Trash2, Copy, Clipboard, CopyPlus, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { calculateDuration, isCrossDayTask } from '@/lib/task-time-utils'
import { toLocalMidnight } from '@/lib/date-utils'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { VoiceInputButton } from '@/components/ui/VoiceInputButton'
import { useToast } from '@/components/ui/Toast'

export default function ManualOnboardingPage() {
  const router = useRouter()
  
  // Plan details - always editable since this is manual creation
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDescription, setGoalDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startDateManuallySet, setStartDateManuallySet] = useState(false)
  const [endDateManuallySet, setEndDateManuallySet] = useState(false)
  
  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([])
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  
  // Copy/Paste/Duplicate state
  const [copiedTask, setCopiedTask] = useState<Task | null>(null)
  
  // Navigation warning state
  const [showNavigationWarning, setShowNavigationWarning] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addToast } = useToast()

  // Voice input for goal title
  const {
    isListening: isTitleListening,
    transcript: titleTranscript,
    error: titleSpeechError,
    isSupported: isSpeechSupported,
    startListening: startTitleListening,
    stopListening: stopTitleListening,
    reset: resetTitleSpeech,
  } = useSpeechRecognition({
    onResult: (finalTranscript) => {
      setGoalTitle((prev) => {
        const newTitle = prev.trim() ? `${prev} ${finalTranscript}` : finalTranscript
        return newTitle
      })
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Voice Input Error',
        description: error,
        duration: 5000,
      })
    },
    continuous: false,
    interimResults: true,
  })

  // Track text before starting title voice input
  const titleTextBeforeListeningRef = useRef<string>('')

  useEffect(() => {
    if (isTitleListening && !titleTextBeforeListeningRef.current) {
      titleTextBeforeListeningRef.current = goalTitle
    } else if (!isTitleListening && titleTextBeforeListeningRef.current) {
      titleTextBeforeListeningRef.current = ''
    }
  }, [isTitleListening])

  useEffect(() => {
    if (isTitleListening && titleTranscript) {
      const baseText = titleTextBeforeListeningRef.current.trim()
      const fullText = baseText ? `${baseText} ${titleTranscript}` : titleTranscript
      setGoalTitle(fullText)
    }
  }, [titleTranscript, isTitleListening])

  const handleTitleMicClick = () => {
    if (isTitleListening) {
      stopTitleListening()
    } else {
      resetTitleSpeech()
      startTitleListening()
    }
  }

  // Voice input for plan summary
  const {
    isListening: isDescriptionListening,
    transcript: descriptionTranscript,
    error: descriptionSpeechError,
    startListening: startDescriptionListening,
    stopListening: stopDescriptionListening,
    reset: resetDescriptionSpeech,
  } = useSpeechRecognition({
    onResult: (finalTranscript) => {
      setGoalDescription((prev) => {
        const newDesc = prev.trim() ? `${prev} ${finalTranscript}` : finalTranscript
        return newDesc
      })
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Voice Input Error',
        description: error,
        duration: 5000,
      })
    },
    continuous: false,
    interimResults: true,
  })

  // Track text before starting description voice input
  const descriptionTextBeforeListeningRef = useRef<string>('')

  useEffect(() => {
    if (isDescriptionListening && !descriptionTextBeforeListeningRef.current) {
      descriptionTextBeforeListeningRef.current = goalDescription
    } else if (!isDescriptionListening && descriptionTextBeforeListeningRef.current) {
      descriptionTextBeforeListeningRef.current = ''
    }
  }, [isDescriptionListening])

  useEffect(() => {
    if (isDescriptionListening && descriptionTranscript) {
      const baseText = descriptionTextBeforeListeningRef.current.trim()
      const fullText = baseText ? `${baseText} ${descriptionTranscript}` : descriptionTranscript
      setGoalDescription(fullText)
    }
  }, [descriptionTranscript, isDescriptionListening])

  const handleDescriptionMicClick = () => {
    if (isDescriptionListening) {
      stopDescriptionListening()
    } else {
      resetDescriptionSpeech()
      startDescriptionListening()
    }
  }
  const [error, setError] = useState<string | null>(null)
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null) // Track plan ID for cleanup
  
  // Check if there's unsaved data
  const hasUnsavedData = useMemo(() => {
    return (
      goalTitle.trim() !== '' ||
      goalDescription.trim() !== '' ||
      startDate !== '' ||
      endDate !== '' ||
      tasks.length > 0
    )
  }, [goalTitle, goalDescription, startDate, endDate, tasks.length])
  
  // Cleanup: Delete plan if component unmounts with an incomplete plan
  useEffect(() => {
    return () => {
      // Cleanup on unmount: delete plan if it was created but not completed
      if (createdPlanId) {
        // Use fetch with keepalive for reliable cleanup even if page is closing
        fetch('/api/plans/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_id: createdPlanId }),
          keepalive: true, // Ensures request completes even if page is closing
        }).catch(err => {
          console.error('Failed to cleanup plan on unmount:', err)
        })
      }
    }
  }, [createdPlanId])
  
  // Handle browser navigation (back button, closing tab, etc.)
  useEffect(() => {
    if (!hasUnsavedData || isSubmitting) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If a plan was created, delete it before leaving
      if (createdPlanId) {
        // Use fetch with keepalive for reliable cleanup
        fetch('/api/plans/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_id: createdPlanId }),
          keepalive: true, // Ensures request completes even if page is closing
        }).catch(err => {
          console.error('Failed to cleanup plan on beforeunload:', err)
        })
      }
      
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }

    // Push a state to intercept back button
    window.history.pushState(null, '', window.location.pathname)

    // Handle browser back/forward buttons
    const handlePopState = (e: PopStateEvent) => {
      if (hasUnsavedData && !isSubmitting) {
        // Push state back immediately to prevent navigation
        window.history.pushState(null, '', window.location.pathname)
        
        // Show warning modal
        setShowNavigationWarning(true)
        setPendingNavigation(() => () => {
          window.history.back()
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [hasUnsavedData, isSubmitting, createdPlanId])
  
  // Intercept router navigation
  const handleNavigation = (navigationFn: () => void) => {
    if (hasUnsavedData && !isSubmitting) {
      setPendingNavigation(() => navigationFn)
      setShowNavigationWarning(true)
    } else {
      navigationFn()
    }
  }
  
  const confirmNavigation = () => {
    setShowNavigationWarning(false)
    if (pendingNavigation) {
      pendingNavigation()
      setPendingNavigation(null)
    }
  }
  
  const cancelNavigation = () => {
    setShowNavigationWarning(false)
    setPendingNavigation(null)
  }

  // Calculate total duration in minutes
  const totalDurationMinutes = useMemo(() => {
    return tasks.reduce((sum, task) => sum + task.estimated_duration_minutes, 0)
  }, [tasks])

  // Calculate total days
  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }, [startDate, endDate])

  // Helper function to calculate effective end date for a task (handles cross-day tasks)
  const getEffectiveEndDate = (task: Task): string => {
    if (!task.scheduled_date) return ''
    
    // Check if task is cross-day using utility function
    if (task.start_time && task.end_time && isCrossDayTask(task.start_time, task.end_time)) {
      const taskDate = new Date(task.scheduled_date)
      taskDate.setDate(taskDate.getDate() + 1)
      return taskDate.toISOString().split('T')[0]
    }
    
    return task.scheduled_date
  }

  // Auto-calculate start and end dates from task dates
  // Handles cross-day tasks (e.g., 8 PM to 3 AM spans to next day)
  const calculatedDateRange = useMemo(() => {
    const taskDates = tasks
      .map(task => task.scheduled_date)
      .filter(date => date && date !== '')
      .sort()
    
    if (taskDates.length === 0) return { start: null, end: null }
    
    // Calculate effective end dates (accounts for cross-day tasks)
    const effectiveEndDates = tasks
      .map(task => getEffectiveEndDate(task))
      .filter(date => date !== '')
      .sort()
    
    // For single task: start is task date, end is effective end date (may be next day for cross-day)
    // For multiple tasks: start is earliest task date, end is latest effective end date
    const earliestStart = taskDates[0]
    const latestEnd = effectiveEndDates.length > 0 
      ? effectiveEndDates[effectiveEndDates.length - 1]
      : taskDates[taskDates.length - 1]
    
    return {
      start: earliestStart,
      end: latestEnd
    }
  }, [tasks])

  // Auto-populate start/end dates from task dates
  // Only auto-update dates that haven't been manually set
  useEffect(() => {
    if (calculatedDateRange.start && !startDateManuallySet) {
      setStartDate(calculatedDateRange.start)
    }
  }, [calculatedDateRange.start, startDateManuallySet])

  useEffect(() => {
    if (calculatedDateRange.end && !endDateManuallySet) {
      setEndDate(calculatedDateRange.end)
    }
  }, [calculatedDateRange.end, endDateManuallySet])

  // Track manual date changes - disable auto-population for that specific field
  const handleStartDateChange = (value: string) => {
    setStartDate(value)
    setStartDateManuallySet(true)
  }

  const handleEndDateChange = (value: string) => {
    setEndDate(value)
    setEndDateManuallySet(true)
  }

  const handleTaskToggle = (taskId: string) => {
    if (expandedTaskId === taskId) {
      // Save the current editing task before collapsing
      if (editingTask) {
        setTasks(prevTasks => prevTasks.map(t => t.id === editingTask.id ? editingTask : t))
      }
      setExpandedTaskId(null)
      // Don't clear editingTask - keep it for next time we expand
      setEditingTask(null)
    } else {
      setExpandedTaskId(taskId)
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        setEditingTask(task)
      }
    }
  }

  const handleTaskInputChange = (field: keyof Task, value: any) => {
    if (editingTask) {
      const updatedTask = { ...editingTask, [field]: value }
      
      // Auto-calculate duration when start_time or end_time changes
      if (field === 'start_time' || field === 'end_time') {
        if (updatedTask.start_time && updatedTask.end_time) {
          const duration = calculateDuration(updatedTask.start_time, updatedTask.end_time)
          if (duration > 0) {
            updatedTask.estimated_duration_minutes = duration
          }
        }
      }
      
      setEditingTask(updatedTask)
    }
  }

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete))
      setTaskToDelete(null)
      setShowDeleteConfirm(false)
      setEditingTask(null)
      setExpandedTaskId(null)
    }
  }

  const handleAddNewTask = () => {
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      plan_id: '',
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

  const handleCopyTask = () => {
    if (editingTask) {
      setCopiedTask({ ...editingTask })
    }
  }

  const handlePasteTask = () => {
    if (copiedTask) {
      const newTask: Task = {
        ...copiedTask,
        id: `temp-${Date.now()}`,
        idx: tasks.length,
        created_at: new Date().toISOString()
      }
      setTasks(prevTasks => [...prevTasks, newTask])
      setEditingTask(newTask)
      setExpandedTaskId(newTask.id)
    }
  }

  const handleDuplicateTask = () => {
    if (editingTask) {
      // First, save the current editing task to ensure original is preserved
      setTasks(prevTasks => prevTasks.map(t => t.id === editingTask.id ? editingTask : t))
      
      // Then create a duplicate with a new ID and timestamp
      const newTask: Task = {
        ...editingTask,
        id: `temp-${Date.now()}`,
        idx: tasks.length,
        created_at: new Date().toISOString()
      }
      
      // Add the duplicate to tasks
      setTasks(prevTasks => [...prevTasks, newTask])
      
      // Switch to editing the new duplicate
      setEditingTask(newTask)
      setExpandedTaskId(newTask.id)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    
    // Validation
    if (!goalTitle.trim()) {
      setError('Please enter a goal title')
      return
    }
    if (!startDate) {
      setError('Please select a start date')
      return
    }
    if (!endDate) {
      setError('Please select an end date')
      return
    }
    // Compare dates (normalize to midnight to avoid timezone issues)
    // Use toLocalMidnight for consistent date comparison with backend
    const start = toLocalMidnight(startDate)
    const end = toLocalMidnight(endDate)
    
    // Backend uses endDate <= startDate, so frontend should match (end must be >= start)
    if (end < start) {
      setError('End date must be on or after start date')
      return
    }
    if (tasks.length === 0) {
      setError('Please add at least one task')
      return
    }
    
    // Validate that all tasks have names
    const tasksWithoutNames = tasks.filter(task => !task.name || !task.name.trim())
    if (tasksWithoutNames.length > 0) {
      setError('All tasks must have a name. Please fill in task names before creating the plan.')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Step 1: Create manual plan via API
      const planResponse = await fetch('/api/plans/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_text: goalTitle,
          goal_description: goalDescription,
          start_date: startDate,
          end_date: endDate
        }),
      })

      if (!planResponse.ok) {
        const errorData = await planResponse.json()
        throw new Error(errorData.error || 'Failed to create plan')
      }

      const planData = await planResponse.json()
      const planId = planData.plan.id
      console.log('Manual plan created successfully:', planId)
      
      // Track the created plan ID for cleanup if needed
      setCreatedPlanId(planId)

      // Step 2: Add tasks to the plan
      if (tasks.length > 0) {
        const tasksResponse = await fetch('/api/plans/manual/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: planId,
            tasks: tasks.map(task => ({
              name: task.name,
              details: task.details,
              estimated_duration_minutes: task.estimated_duration_minutes,
              priority: task.priority,
              scheduled_date: task.scheduled_date,
              start_time: task.start_time,
              end_time: task.end_time
            }))
          }),
        })

        if (!tasksResponse.ok) {
          const errorData = await tasksResponse.json()
          // Clean up the plan since task creation failed
          await deletePlan(planId)
          setCreatedPlanId(null)
          throw new Error(errorData.error || 'Failed to create tasks')
        }

        console.log('Tasks created successfully')
      }

      // Clear the created plan ID since everything succeeded
      setCreatedPlanId(null)
      
      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Error creating manual plan:', error)
      setError(error.message || 'Failed to create plan. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deletePlan = async (planId: string) => {
    try {
      const response = await fetch('/api/plans/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      })
      
      if (!response.ok) {
        console.error('Failed to delete plan:', planId)
      } else {
        console.log('Successfully deleted plan:', planId)
      }
    } catch (error) {
      console.error('Error deleting plan:', error)
    }
  }

  const handleCancel = async () => {
    // If a plan was created but not completed, delete it
    if (createdPlanId) {
      await deletePlan(createdPlanId)
      setCreatedPlanId(null)
    }
    
    handleNavigation(() => router.push('/dashboard'))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Timeline Section with Goal Header */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          {/* Goal Header */}
          <div className="mb-6">
            <div className="space-y-4">
              <div className="relative">
                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                  Goal Title *
                </label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className={`w-full px-3 py-2 ${isSpeechSupported ? 'pr-12' : 'pr-3'} bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] text-3xl font-bold placeholder:text-[#d7d2cb]/20`}
                  placeholder="Enter your goal"
                />
                
                {/* Voice input button for goal title */}
                {isSpeechSupported && (
                  <div className="absolute right-2 top-9 z-10">
                    <VoiceInputButton
                      isListening={isTitleListening}
                      isSupported={isSpeechSupported}
                      onClick={handleTitleMicClick}
                      disabled={isSubmitting}
                      size="sm"
                      error={titleSpeechError}
                    />
                  </div>
                )}

                {/* Listening indicator for goal title */}
                {isTitleListening && (
                  <div className="absolute top-0 left-0 flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-lg text-xs text-red-400 z-20">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Listening...</span>
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                  Plan Summary
                </label>
                <textarea
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  rows={2}
                  className={`w-full px-3 py-2 ${isSpeechSupported ? 'pr-12' : 'pr-3'} bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] resize-none placeholder:text-[#d7d2cb]/20`}
                  placeholder="Describe your plan"
                />
                
                {/* Voice input button for plan summary */}
                {isSpeechSupported && (
                  <div className="absolute right-2 bottom-2 z-10">
                    <VoiceInputButton
                      isListening={isDescriptionListening}
                      isSupported={isSpeechSupported}
                      onClick={handleDescriptionMicClick}
                      disabled={isSubmitting}
                      size="sm"
                      error={descriptionSpeechError}
                    />
                  </div>
                )}

                {/* Listening indicator for plan summary */}
                {isDescriptionListening && (
                  <div className="absolute top-0 left-0 flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-lg text-xs text-red-400 z-20">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Listening...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Timeline Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
              />
            </div>
            <div>
              <div className="text-sm text-[#d7d2cb]/60 mb-1">Total Duration</div>
              <div className="text-base font-medium text-[#d7d2cb]">
                {totalDurationMinutes > 0 ? `${totalDurationMinutes} minutes` : '0 minutes'}
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
                        <span className="text-[#ff7f00] font-semibold">
                          {index + 1}.
                        </span>
                        <span className="flex-1 text-[#d7d2cb] font-medium">
                          {editingTask && editingTask.id === task.id 
                            ? (editingTask.name || '(Untitled Task)')
                            : (task.name || '(Untitled Task)')
                          }
                        </span>
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
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
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
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] resize-none"
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
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
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
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
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
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
                                  />
                                </div>
                              </div>

                              {/* Duration and Priority Row */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Duration - Auto-calculated */}
                                <div>
                                  <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                    Duration (minutes)
                                  </label>
                                  <div className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]/60">
                                    {editingTask.start_time && editingTask.end_time && calculateDuration(editingTask.start_time, editingTask.end_time) > 0
                                      ? `${calculateDuration(editingTask.start_time, editingTask.end_time)} minutes`
                                      : 'Set start and end time to calculate duration'
                                    }
                                  </div>
                                </div>

                                {/* Priority */}
                                <div>
                                  <label className="text-sm font-medium text-[#d7d2cb]/80 mb-2 block">
                                    Priority
                                  </label>
                                  <select
                                    value={editingTask.priority || 1}
                                    onChange={(e) => handleTaskInputChange('priority', parseInt(e.target.value) as 1 | 2 | 3 | 4)}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
                                  >
                                    <option value={1}>1 - Low</option>
                                    <option value={2}>2 - Medium</option>
                                    <option value={3}>3 - High</option>
                                    <option value={4}>4 - Critical</option>
                                  </select>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="space-y-3 pt-2">
                                {/* Task Actions Row */}
                                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                                  <button
                                    onClick={handleCopyTask}
                                    disabled={!editingTask}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#d7d2cb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                  >
                                    <Copy className="w-4 h-4" />
                                    <span>Copy</span>
                                  </button>
                                  <button
                                    onClick={handlePasteTask}
                                    disabled={!copiedTask}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#d7d2cb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                  >
                                    <Clipboard className="w-4 h-4" />
                                    <span>Paste</span>
                                  </button>
                                  <button
                                    onClick={handleDuplicateTask}
                                    disabled={!editingTask}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#d7d2cb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                  >
                                    <CopyPlus className="w-4 h-4" />
                                    <span>Duplicate</span>
                                  </button>
                                </div>
                                
                                {/* Delete Button */}
                                <div className="flex justify-start">
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Task
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
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-white/20 hover:border-[#ff7f00] rounded-lg text-[#d7d2cb]/60 hover:text-[#ff7f00] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add New Task
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pt-4">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex items-center gap-2 px-8"
            disabled={isSubmitting}
          >
            <RotateCcw className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-8 bg-[#ff7f00] hover:bg-[#ff7f00]/90"
            disabled={isSubmitting}
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting ? 'Creating Plan...' : 'Create Plan'}
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

      {/* Navigation Warning Modal */}
      {showNavigationWarning && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4">Unsaved Changes</h3>
            <p className="text-base text-[#d7d2cb]/80 mb-6">
              You have unsaved information. If you leave now, all your progress will be lost. Are you sure you want to continue?
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={cancelNavigation} 
                variant="outline" 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmNavigation} 
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Leave Page
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
