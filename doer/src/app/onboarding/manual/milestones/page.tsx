'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Calendar, Plus, Trash2, CheckCircle, Target, ListTodo, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, FadeInWrapper } from '@/components/ui'
import { supabase } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { useBaseCalendar, BaseCalendarGrid } from '@/components/ui/calendar/BaseCalendar'

interface Milestone {
  id: string // Make id required since we'll use it as key
  name: string
  description: string
  target_date: string
  tasks: Task[] // Add tasks array to milestone
}

interface Task {
  id: string // Make id required
  name: string
  scheduled_date: string
  milestone_id?: string
  category: 'milestone_task' | 'daily_task'
}

interface DayData {
  milestones: Milestone[]
  tasks: Task[]
}

function MilestonesBuilderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan_id')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showDayOptions, setShowDayOptions] = useState(false)
  
  // Store all milestones with their tasks
  const [milestones, setMilestones] = useState<Milestone[]>([])
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<any>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)

  // Modal states
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskCategory, setNewTaskCategory] = useState<'daily_task' | 'milestone_task'>('daily_task')
  const [newTaskMilestoneId, setNewTaskMilestoneId] = useState('')

  useEffect(() => {
    if (!planId) {
      router.push('/onboarding/manual')
      return
    }

    const loadPlan = async () => {
      try {
        const { data, error: planError } = await supabase
          .from('plans')
          .select('*')
          .eq('id', planId)
          .single()

        if (planError) throw planError
        
        setPlan(data)
        setStartDate(data.start_date)
        setEndDate(data.end_date)
        setLoadingPlan(false)
      } catch (err: any) {
        console.error('Error loading plan:', err)
        setError('Failed to load plan. Redirecting...')
        setTimeout(() => router.push('/onboarding/manual'), 2000)
      }
    }

    loadPlan()
  }, [planId, router])

  const formatDateForDB = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const parseDateFromDB = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Generate unique IDs for milestones and tasks
  const generateId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr)
    setShowDayOptions(true)
  }

  const handleAddMilestone = () => {
    setShowDayOptions(false)
    setShowAddMilestone(true)
  }

  const handleAddTask = () => {
    setShowDayOptions(false)
    setShowAddTask(true)
  }

  const saveMilestone = () => {
    if (!selectedDate || !newMilestoneName.trim()) return
    
    const newMilestone: Milestone = {
      id: generateId(),
      name: newMilestoneName,
      description: newMilestoneDescription,
      target_date: selectedDate,
      tasks: []
    }
    
    setMilestones(prev => [...prev, newMilestone])
    
    setNewMilestoneName('')
    setNewMilestoneDescription('')
    setShowAddMilestone(false)
    setSelectedDate(null)
  }

  const saveTask = () => {
    if (!selectedDate || !newTaskName.trim()) return
    
    const newTask: Task = {
      id: generateId(),
      name: newTaskName,
      scheduled_date: selectedDate,
      category: newTaskCategory,
      milestone_id: newTaskMilestoneId || undefined
    }
    
    // Add task to milestone if milestone_id is provided
    if (newTaskMilestoneId) {
      setMilestones(prev => prev.map(m => 
        m.id === newTaskMilestoneId 
          ? { ...m, tasks: [...m.tasks, newTask] }
          : m
      ))
    }
    
    setNewTaskName('')
    setNewTaskCategory('daily_task')
    setNewTaskMilestoneId('')
    setShowAddTask(false)
    setSelectedDate(null)
  }

  const removeMilestone = (milestoneId: string) => {
    setMilestones(prev => prev.filter(m => m.id !== milestoneId))
  }

  const removeTask = (milestoneId: string, taskId: string) => {
    setMilestones(prev => prev.map(m => 
      m.id === milestoneId 
        ? { ...m, tasks: m.tasks.filter(t => t.id !== taskId) }
        : m
    ))
  }

  const handleUpdateDates = async () => {
    if (!startDate || !endDate || !planId) return
    
    try {
      const { error: updateError } = await supabase
        .from('plans')
        .update({ 
          start_date: startDate, 
          end_date: endDate 
        })
        .eq('id', planId)
      
      if (updateError) throw updateError
      
      setPlan({ ...plan, start_date: startDate, end_date: endDate })
    } catch (err) {
      console.error('Error updating plan dates:', err)
      setError('Failed to update dates')
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Update dates first
      await handleUpdateDates()

      if (milestones.length === 0) {
        throw new Error('Please add at least one milestone')
      }

      // Collect all tasks from all milestones
      const allTasks: Task[] = milestones.flatMap(m => m.tasks)

      console.log('Submitting milestones and tasks:', {
        milestones: milestones.length,
        tasks: allTasks.length
      })

      // Create milestones
      const milestonesResponse = await fetch('/api/plans/manual/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          milestones: milestones.map(m => ({
            name: m.name,
            rationale: m.description,
            target_date: m.target_date
          }))
        }),
      })

      if (!milestonesResponse.ok) {
        const errorData = await milestonesResponse.json()
        throw new Error(errorData.error || 'Failed to create milestones')
      }

      const milestonesData = await milestonesResponse.json()
      console.log('Milestones created:', milestonesData.milestones)

      // Map milestone temporary IDs to database IDs
      const milestoneIdMap = new Map<string, string>()
      milestones.forEach((m, index) => {
        if (milestonesData.milestones[index]) {
          milestoneIdMap.set(m.id, milestonesData.milestones[index].id)
        }
      })

      // If we have tasks, create them
      if (allTasks.length > 0) {
        const tasksWithSchedule = allTasks.map(t => ({
          name: t.name,
          category: t.category,
          milestone_id: t.milestone_id ? milestoneIdMap.get(t.milestone_id) : undefined,
          scheduled_date: t.scheduled_date
        }))

        const tasksResponse = await fetch('/api/plans/manual/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: planId,
            tasks: tasksWithSchedule
          }),
        })

        if (!tasksResponse.ok) {
          const errorData = await tasksResponse.json()
          throw new Error(errorData.error || 'Failed to create tasks')
        }

        const tasksData = await tasksResponse.json()
        console.log('Tasks created:', tasksData.tasks)
      }

      // Navigate to completion page
      router.push('/onboarding/complete')
    } catch (err: any) {
      console.error('Error creating milestones/tasks:', err)
      setError(err.message || 'Failed to create roadmap. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Prepare calendar data - collect all tasks from all milestones
  const tasksByDateMap = new Map<string, string[]>()
  
  // Add all milestone tasks to the map (prefix with 🏆 to mark as milestone tasks)
  milestones.forEach(m => {
    m.tasks.forEach(task => {
      const existing = tasksByDateMap.get(task.scheduled_date) || []
      // Mark milestone tasks with 🏆 prefix, daily tasks without prefix
      const taskLabel = task.category === 'milestone_task' ? `🏆 ${task.name}` : task.name
      tasksByDateMap.set(task.scheduled_date, [...existing, taskLabel])
    })
    
    // Add milestone marker on milestone date with 🎯 prefix
    const existing = tasksByDateMap.get(m.target_date) || []
    tasksByDateMap.set(m.target_date, [...existing, `🎯 ${m.name}`])
  })
  
  // Convert to array format for calendar
  const calendarTasks = Array.from(tasksByDateMap.entries()).map(([date, tasks]) => ({
    date,
    tasks
  }))

  // Use base calendar hook
  const {
    currentDate,
    isHydrated,
    calendarDays,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    setCurrentDate
  } = useBaseCalendar({
    tasks: calendarTasks,
    onDateClick: handleDateClick,
    categorizedDates: {
      milestones: milestones.map(m => m.target_date)
    }
  })

  if (loadingPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0f0a0a] to-[#0a0a0a] text-[#d7d2cb] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#d7d2cb]/70">Loading your plan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0f0a0a] to-[#0a0a0a] text-[#d7d2cb] p-6">
      <div className="max-w-6xl mx-auto space-y-8 py-12">
        {/* Back Button */}
        <FadeInWrapper delay={0.1}>
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </FadeInWrapper>

        {/* Header */}
        <FadeInWrapper delay={0.2} direction="up">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-teal-500">
              <Target className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-[#d7d2cb]">
              Build Your Roadmap
            </h1>
            <p className="text-[#d7d2cb]/70 text-lg max-w-2xl mx-auto">
              Use the interactive calendar to set your timeline and add milestones and tasks
            </p>
          </div>
        </FadeInWrapper>

        {/* Error Message */}
        {error && (
          <FadeInWrapper delay={0.3}>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </FadeInWrapper>
        )}

        {/* Date Range Inputs */}
        <FadeInWrapper delay={0.3} direction="up">
          <Card>
            <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-500" />
                Timeline
                  </CardTitle>
                  <CardDescription>
                Set the start and end dates for your plan
                  </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#d7d2cb]">
                    Start Date
                  </label>
                      <input
                        type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onBlur={handleUpdateDates}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#d7d2cb]">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onBlur={handleUpdateDates}
                    min={startDate}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeInWrapper>

        {/* Interactive Calendar */}
        <FadeInWrapper delay={0.4} direction="up">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Interactive Calendar</CardTitle>
              <CardDescription>
                Click on any date to add milestones or tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {/* Month Navigation */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousMonth}
                  className="text-[#d7d2cb]/70 hover:text-[#d7d2cb] hover:bg-white/10 w-10 h-10 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <div className="min-w-[200px] text-center">
                  <div className="text-2xl font-semibold text-[#d7d2cb]">
                    {currentDate.toLocaleDateString('en-US', { month: 'long' })}
                  </div>
                  <div className="text-lg text-[#d7d2cb]/70 mt-1">
                    {currentDate.getFullYear()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextMonth}
                  className="text-[#d7d2cb]/70 hover:text-[#d7d2cb] hover:bg-white/10 w-10 h-10 transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="ml-3 border-white/20 text-[#d7d2cb] hover:bg-white/10 text-base px-4 py-2"
                >
                  Today
                </Button>
              </div>

              {/* Calendar with blur effect when popup is open */}
              <motion.div
                animate={showDayOptions ? { scale: 0.98, opacity: 0.7 } : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{
                  filter: showDayOptions ? 'blur(10px)' : 'blur(0px)',
                  transition: 'filter 0.3s ease-out'
                }}
              >
                <BaseCalendarGrid 
                  calendarDays={calendarDays}
                  onDateClick={handleDateClick}
                  isHydrated={isHydrated}
                  isTaskCompleted={() => false}
                  areAllTasksCompleted={() => false}
                  tasksByDate={new Map(calendarTasks.map(t => [t.date, t.tasks]))}
                  categorizedDates={{
                    milestones: milestones.map(m => m.target_date)
                  }}
                />
              </motion.div>

              {/* Day Options Popup - Contained within calendar */}
              <AnimatePresence>
                {showDayOptions && selectedDate && (
                  <motion.div 
                    className="absolute inset-0 z-10 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {/* Subtle backdrop */}
                    <motion.div 
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      onClick={() => {
                        setShowDayOptions(false)
                        setSelectedDate(null)
                      }}
                    />
                    
                    {/* Popup Panel */}
                    <motion.div 
                      className="relative w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl"
                      initial={{ opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: 8 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-[#d7d2cb]">
                            {(() => {
                              const [year, month, day] = selectedDate.split('-').map(Number)
                              const date = new Date(year, month - 1, day)
                              return date.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                              })
                            })()}
                          </h3>
                          <button
                            onClick={() => {
                              setShowDayOptions(false)
                              setSelectedDate(null)
                            }}
                            className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Options */}
                        <div className="space-y-2">
                        <Button
                          onClick={handleAddMilestone}
                          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                          size="sm"
                        >
                          <Target className="w-4 h-4 mr-2" />
                          Add Milestone
                        </Button>
                        <Button
                          onClick={handleAddTask}
                          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                          size="sm"
                        >
                          <ListTodo className="w-4 h-4 mr-2" />
                          Add Task
                        </Button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Add Milestone Modal */}
              <AnimatePresence>
                {showAddMilestone && selectedDate && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={() => {
                      setShowAddMilestone(false)
                      setNewMilestoneName('')
                      setNewMilestoneDescription('')
                      setSelectedDate(null)
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-pink-400" />
                        Add Milestone
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                            Milestone Name
                          </label>
                      <input
                        type="text"
                            value={newMilestoneName}
                            onChange={(e) => setNewMilestoneName(e.target.value)}
                            placeholder="Enter milestone name"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                            Description (Optional)
                          </label>
                          <textarea
                            value={newMilestoneDescription}
                            onChange={(e) => setNewMilestoneDescription(e.target.value)}
                            placeholder="Enter description"
                            rows={3}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all resize-none"
                          />
                        </div>
                      <div className="flex gap-3">
                          <Button
                            onClick={() => {
                              setShowAddMilestone(false)
                              setNewMilestoneName('')
                              setNewMilestoneDescription('')
                              setSelectedDate(null)
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={saveMilestone}
                            disabled={!newMilestoneName.trim()}
                            className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Add Task Modal */}
              <AnimatePresence>
                {showAddTask && selectedDate && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={() => {
                      setShowAddTask(false)
                      setNewTaskName('')
                      setNewTaskCategory('daily_task')
                      setNewTaskMilestoneId('')
                      setSelectedDate(null)
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4 flex items-center gap-2">
                        <ListTodo className="w-5 h-5 text-teal-400" />
                        Add Task
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                            Task Name
                          </label>
                          <input
                            type="text"
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            placeholder="Enter task name"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                            Task Type
                          </label>
                        <select
                            value={newTaskCategory}
                            onChange={(e) => setNewTaskCategory(e.target.value as 'daily_task' | 'milestone_task')}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                        >
                          <option value="daily_task">Daily Task</option>
                          <option value="milestone_task">Milestone Task</option>
                        </select>
                        </div>
                        {newTaskCategory === 'milestone_task' && (
                          <div>
                            <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                              Associated Milestone
                            </label>
                            <select
                              value={newTaskMilestoneId}
                              onChange={(e) => setNewTaskMilestoneId(e.target.value)}
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                            >
                              <option value="">Select milestone...</option>
                              {milestones.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="flex gap-3">
                          <Button
                            onClick={() => {
                              setShowAddTask(false)
                              setNewTaskName('')
                              setNewTaskCategory('daily_task')
                              setNewTaskMilestoneId('')
                              setSelectedDate(null)
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={saveTask}
                            disabled={!newTaskName.trim()}
                            className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </FadeInWrapper>

        {/* Milestones Panel */}
        {milestones.length > 0 && (
          <FadeInWrapper delay={0.5} direction="up">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Your Milestones</CardTitle>
                <CardDescription>
                  Review your milestones and their tasks before completing setup
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {milestones
                    .sort((a, b) => a.target_date.localeCompare(b.target_date))
                    .map((milestone) => (
                      <div key={milestone.id} className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="w-4 h-4 text-purple-400 flex-shrink-0" />
                              <div className="font-semibold text-[#d7d2cb]">{milestone.name}</div>
                            </div>
                            {milestone.description && (
                              <div className="text-xs text-[#d7d2cb]/60 ml-6">{milestone.description}</div>
                            )}
                            <div className="text-xs text-purple-400 mt-2 ml-6">
                              Target Date: {parseDateFromDB(milestone.target_date).toLocaleDateString('en-US', { 
                                month: 'long', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </div>
                          </div>
                          <Button
                            onClick={() => removeMilestone(milestone.id)}
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                        
                        {/* Milestone Tasks */}
                        {milestone.tasks.length > 0 && (
                          <div className="ml-6 mt-3 space-y-2 border-l-2 border-purple-500/30 pl-4">
                            <div className="text-xs font-semibold text-purple-300 mb-2">Tasks:</div>
                            {milestone.tasks.map((task) => (
                              <div key={task.id} className="flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-lg">
                                <ListTodo className="w-3 h-3 text-teal-400 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="text-sm text-[#d7d2cb]">{task.name}</div>
                                  <div className="text-xs text-[#d7d2cb]/60 mt-0.5">
                                    {parseDateFromDB(task.scheduled_date).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric'
                                    })}
                                  </div>
                                </div>
                                <Button
                                  onClick={() => removeTask(milestone.id, task.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="flex-shrink-0 h-auto py-1 px-2"
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </FadeInWrapper>
        )}

        {/* Action Buttons */}
        <FadeInWrapper delay={0.6}>
          <div className="flex gap-4">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || milestones.length === 0}
              className="flex-1 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Roadmap...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Setup
                </>
              )}
            </Button>
          </div>
        </FadeInWrapper>
      </div>
    </div>
  )
}

export default function MilestonesBuilderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0f0a0a] to-[#0a0a0a] text-[#d7d2cb] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#d7d2cb]/70">Loading...</p>
        </div>
      </div>
    }>
      <MilestonesBuilderContent />
    </Suspense>
  )
}
