'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Sparkles, Target, ListTodo, CheckCircle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, FadeInWrapper } from '@/components/ui'
import { motion, AnimatePresence } from 'framer-motion'
import { useBaseCalendar, BaseCalendarGrid } from '@/components/ui/calendar/BaseCalendar'

interface Milestone {
  id: string
  name: string
  description: string
  target_date: string
  tasks: Task[]
}

interface Task {
  id: string
  name: string
  scheduled_date: string
  milestone_id?: string
  category: 'milestone_task' | 'daily_task'
}

export default function ManualOnboardingPage() {
  const router = useRouter()
  
  // Goal details
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDescription, setGoalDescription] = useState('')
  
  // Timeline
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return firstDay.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return lastDay.toISOString().split('T')[0]
  })
  
  // Calendar and milestones
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showDayOptions, setShowDayOptions] = useState(false)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]) // Standalone daily tasks not associated with milestones
  
  // Modal states
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskCategory, setNewTaskCategory] = useState<'daily_task' | 'milestone_task'>('daily_task')
  const [newTaskMilestoneId, setNewTaskMilestoneId] = useState('')
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate unique IDs
  const generateId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const parseDateFromDB = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr)
    setShowDayOptions(true)
  }

  // Get items for a specific date
  const getItemsForDate = (dateStr: string) => {
    const items: Array<{
      id: string
      type: 'milestone' | 'milestone_task' | 'daily_task'
      name: string
      milestoneId?: string
      milestoneName?: string
    }> = []
    
    // Check for milestones on this date
    milestones.forEach(m => {
      if (m.target_date === dateStr) {
        items.push({
          id: m.id,
          type: 'milestone',
          name: m.name
        })
      }
      
      // Check for milestone tasks on this date
      m.tasks.forEach(t => {
        if (t.scheduled_date === dateStr && t.category === 'milestone_task') {
          items.push({
            id: t.id,
            type: 'milestone_task',
            name: t.name,
            milestoneId: m.id,
            milestoneName: m.name
          })
        }
      })
    })
    
    // Check for daily tasks on this date
    dailyTasks.forEach(t => {
      if (t.scheduled_date === dateStr) {
        items.push({
          id: t.id,
          type: 'daily_task',
          name: t.name
        })
      }
    })
    
    // Check for milestone tasks within milestones on this date (daily task category)
    milestones.forEach(m => {
      m.tasks.forEach(t => {
        if (t.scheduled_date === dateStr && t.category === 'daily_task') {
          items.push({
            id: t.id,
            type: 'daily_task',
            name: t.name,
            milestoneId: m.id,
            milestoneName: m.name
          })
        }
      })
    })
    
    return items
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
    
    setMilestones(prev => {
      const updated = [...prev, newMilestone]
      console.log('Milestones updated:', updated)
      return updated
    })
    
    setNewMilestoneName('')
    setNewMilestoneDescription('')
    setShowAddMilestone(false)
    setSelectedDate(null)
  }

  const saveTask = () => {
    if (!selectedDate || !newTaskName.trim()) return
    
    // Validate milestone task date isn't after completion date
    if (newTaskCategory === 'milestone_task' && newTaskMilestoneId) {
      const milestone = milestones.find(m => m.id === newTaskMilestoneId)
      if (milestone && selectedDate > milestone.target_date) {
        setError(`Task cannot be scheduled after milestone completion date (${parseDateFromDB(milestone.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`)
        return
      }
    }
    
    const newTask: Task = {
      id: generateId(),
      name: newTaskName,
      scheduled_date: selectedDate,
      category: newTaskCategory,
      milestone_id: newTaskMilestoneId || undefined
    }
    
    // Add task to milestone if milestone_id is provided
    if (newTaskMilestoneId) {
      setMilestones(prev => {
        const updated = prev.map(m => 
          m.id === newTaskMilestoneId 
            ? { ...m, tasks: [...m.tasks, newTask] }
            : m
        )
        console.log('Milestones updated with task:', updated)
        return updated
      })
    } else {
      // Add as standalone daily task
      setDailyTasks(prev => {
        const updated = [...prev, newTask]
        console.log('Daily tasks updated:', updated)
        return updated
      })
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

  const removeDailyTask = (taskId: string) => {
    setDailyTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleSubmit = async () => {
    if (!goalTitle.trim()) {
      setError('Please enter a goal title')
      return
    }
    
    if (milestones.length === 0) {
      setError('Please add at least one milestone')
      return
    }

    setIsSubmitting(true)
    setError(null)
    
    try {
      console.log('Creating manual plan:', {
        goalTitle,
        goalDescription,
        startDate,
        endDate,
        milestones: milestones.length
      })

      // Create the manual plan via API
      const planResponse = await fetch('/api/plans/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_text: goalTitle,
          goal_description: goalDescription,
          start_date: startDate,
          end_date: endDate,
        }),
      })

      if (!planResponse.ok) {
        const errorData = await planResponse.json()
        throw new Error(errorData.error || 'Failed to create manual plan')
      }

      const planData = await planResponse.json()
      const planId = planData.plan.id
      console.log('Manual plan created successfully:', planId)

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

      // Collect all tasks from all milestones AND standalone daily tasks
      const allTasks: Task[] = [...milestones.flatMap(m => m.tasks), ...dailyTasks]

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

      // Navigate to onboarding review page
      router.push('/onboarding/review')
    } catch (err: any) {
      console.error('Error creating manual plan:', err)
      setError(err.message || 'Failed to create plan. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Prepare calendar data - recalculate whenever milestones or daily tasks change
  const calendarTasks = useMemo(() => {
    const tasksByDateMap = new Map<string, string[]>()
    
    console.log('Recalculating calendar data for milestones:', milestones, 'daily tasks:', dailyTasks)
    
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
    
    // Add standalone daily tasks (no prefix for daily tasks)
    dailyTasks.forEach(task => {
      const existing = tasksByDateMap.get(task.scheduled_date) || []
      tasksByDateMap.set(task.scheduled_date, [...existing, task.name])
    })
    
    // Convert to array format for calendar
    const tasks = Array.from(tasksByDateMap.entries()).map(([date, tasks]) => ({
      date,
      tasks
    }))
    
    console.log('Calendar tasks:', tasks)
    return tasks
  }, [milestones, dailyTasks])

  // Use base calendar hook with year/decade view support
  const {
    currentDate,
    isHydrated,
    calendarDays,
    showYearView,
    showDecadeView,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    setCurrentDate,
    setShowYearView,
    setShowDecadeView,
    handleMonthClick,
    handleYearClick,
    handleDecadeClick,
    generateYearMonths,
    generateYearWheel,
    futureRangeYears,
  } = useBaseCalendar({
    tasks: calendarTasks,
    onDateClick: handleDateClick,
    showYearDecadeView: true,
    futureRangeYears: 5,
    categorizedDates: {
      startDate: startDate,
      completionDate: endDate,
      milestones: milestones.map(m => m.target_date)
    }
  })

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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#ff7f00] to-[#ff9f40]">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-[#d7d2cb]">
              Create Manual Plan
            </h1>
            <p className="text-[#d7d2cb]/70 text-lg max-w-2xl mx-auto">
              Define your goal, set your timeline, and build your roadmap with milestones and tasks
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

        {/* Goal Details Card */}
        <FadeInWrapper delay={0.3} direction="up">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Goal Details
              </CardTitle>
              <CardDescription>
                Define your goal and timeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Goal Title */}
                <div className="space-y-2">
                  <label 
                    htmlFor="goalTitle" 
                    className="text-sm font-medium text-[#d7d2cb]"
                  >
                    Goal Title
                  </label>
                  <input
                    id="goalTitle"
                    type="text"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="e.g., Learn Web Development"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50 transition-all"
                    required
                  />
                </div>

                {/* Goal Description */}
                <div className="space-y-2">
                  <label 
                    htmlFor="goalDescription" 
                    className="text-sm font-medium text-[#d7d2cb]"
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    id="goalDescription"
                    value={goalDescription}
                    onChange={(e) => setGoalDescription(e.target.value)}
                    placeholder="Describe your goal in more detail..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50 transition-all resize-none"
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#d7d2cb]">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50 transition-all [color-scheme:dark]"
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
                      min={startDate}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeInWrapper>

        {/* Interactive Calendar */}
        <FadeInWrapper delay={0.4} direction="up">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Build Your Roadmap</CardTitle>
              <CardDescription>
                Click on any date to add milestones or tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {/* Month Navigation */}
              <div className="flex items-center justify-center gap-3 mb-6 px-4">
                {/* Hide arrows in decade view */}
                {!showDecadeView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={showYearView ? () => {
                      const newYear = currentDate.getFullYear() - 1
                      setCurrentDate(new Date(newYear, currentDate.getMonth(), 1))
                    } : goToPreviousMonth}
                    className="text-[#d7d2cb]/70 hover:text-[#ff7f00] hover:bg-white/10 w-10 h-10"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                )}
                <div className="min-w-[200px] text-center">
                  <div 
                    className={`${showYearView ? 'text-4xl font-bold' : 'text-2xl font-semibold'} text-[#d7d2cb] ${
                      showDecadeView ? '' : 'cursor-pointer hover:text-[#ff7f00]'
                    } transition-colors`}
                    onClick={showDecadeView ? undefined : (showYearView ? handleDecadeClick : handleYearClick)}
                  >
                    {showYearView ? currentDate.getFullYear() : currentDate.toLocaleDateString('en-US', { month: 'long' })}
                  </div>
                  {!showYearView && (
                    <div className="text-lg text-[#d7d2cb]/70 mt-1">
                      {currentDate.getFullYear()}
                    </div>
                  )}
                </div>
                {/* Hide arrows in decade view */}
                {!showDecadeView && !(showYearView && currentDate.getFullYear() >= new Date().getFullYear() + futureRangeYears) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={showYearView ? () => {
                      const newYear = currentDate.getFullYear() + 1
                      const maxYear = new Date().getFullYear() + futureRangeYears
                      if (newYear <= maxYear) {
                        setCurrentDate(new Date(newYear, currentDate.getMonth(), 1))
                      }
                    } : goToNextMonth}
                    className="text-[#d7d2cb]/70 hover:text-[#ff7f00] hover:bg-white/10 w-10 h-10"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                )}
                {!showYearView && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToToday}
                    className="ml-3 border-white/20 text-[#d7d2cb] hover:bg-white/10 text-base px-4 py-2"
                  >
                    Today
                  </Button>
                )}
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
                {/* Year View - Month Grid */}
                {showYearView && !showDecadeView ? (
                  <div className="grid grid-cols-4 gap-3 px-4">
                    {generateYearMonths().map((monthData) => (
                      <motion.button
                        key={monthData.month}
                        onClick={() => {
                          handleMonthClick(monthData.month)
                        }}
                        className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-[#d7d2cb] font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {monthData.name}
                      </motion.button>
                    ))}
                  </div>
                ) : showDecadeView ? (
                  /* Decade View - Year Wheel */
                  <div className="relative" style={{ height: '400px' }}>
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      <div className="space-y-2 overflow-y-auto max-h-[400px] px-4 py-2 custom-scrollbar">
                        {generateYearWheel().map((year) => {
                          const isCurrent = year === currentDate.getFullYear()
                          const actualCurrentYear = new Date().getFullYear()
                          const isPast = year < actualCurrentYear
                          return (
                            <motion.button
                              key={year}
                              onClick={() => {
                                setCurrentDate(new Date(year, currentDate.getMonth(), 1))
                                setShowDecadeView(false)
                                setShowYearView(true)
                              }}
                              className={`w-full p-3 rounded-xl border transition-all font-semibold text-lg ${
                                isCurrent 
                                  ? 'bg-[#ff7f00]/20 border-[#ff7f00]/50 text-[#ff7f00]' 
                                  : isPast 
                                  ? 'bg-white/5 border-white/10 text-[#d7d2cb]/40 hover:bg-white/10 hover:border-white/20'
                                  : 'bg-white/5 border-white/10 text-[#d7d2cb] hover:bg-white/10 hover:border-white/20'
                              }`}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {year}
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Month View - Day Grid */
                  <BaseCalendarGrid 
                    calendarDays={calendarDays}
                    onDateClick={handleDateClick}
                    isHydrated={isHydrated}
                    isTaskCompleted={() => false}
                    areAllTasksCompleted={() => false}
                    tasksByDate={new Map(calendarTasks.map(t => [t.date, t.tasks]))}
                    categorizedDates={{
                      startDate: startDate,
                      completionDate: endDate,
                      milestones: milestones.map(m => m.target_date)
                    }}
                  />
                )}
              </motion.div>

              {/* Day Options Popup */}
              <AnimatePresence>
                {showDayOptions && selectedDate && (
                  <motion.div 
                    className="absolute inset-0 z-10 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
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
                    
                    <motion.div 
                      className="relative w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto"
                      initial={{ opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: 8 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-6">
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

                        {/* Existing Items */}
                        {(() => {
                          const items = getItemsForDate(selectedDate)
                          return items.length > 0 ? (
                            <div className="mb-4 space-y-2">
                              <h4 className="text-xs font-semibold text-[#d7d2cb]/60 uppercase tracking-wide mb-2">
                                Items on this day
                              </h4>
                              {items.map(item => (
                                <div
                                  key={item.id}
                                  className={`p-3 rounded-lg border flex items-start gap-3 ${
                                    item.type === 'milestone' 
                                      ? 'bg-pink-500/10 border-pink-500/30' 
                                      : item.type === 'milestone_task'
                                      ? 'bg-purple-500/10 border-purple-500/30'
                                      : 'bg-white/5 border-white/10'
                                  }`}
                                >
                                  {item.type === 'milestone' ? (
                                    <Target className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <ListTodo className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                      item.type === 'milestone_task' ? 'text-purple-400' : 'text-[#ff7f00]'
                                    }`} />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${
                                      item.type === 'milestone' 
                                        ? 'text-pink-400' 
                                        : item.type === 'milestone_task'
                                        ? 'text-purple-400'
                                        : 'text-[#d7d2cb]'
                                    }`}>
                                      {item.name}
                                    </div>
                                    {item.milestoneName && (
                                      <div className="text-xs text-[#d7d2cb]/60 mt-1">
                                        Part of: {item.milestoneName}
                  </div>
                )}
                                    <div className="text-xs text-[#d7d2cb]/50 mt-1">
                                      {item.type === 'milestone' ? 'Milestone Completion' : item.type === 'milestone_task' ? 'Milestone Task' : 'Daily Task'}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (item.type === 'milestone') {
                                        removeMilestone(item.id)
                                      } else if (item.type === 'daily_task' && !item.milestoneId) {
                                        removeDailyTask(item.id)
                                      } else if (item.milestoneId) {
                                        removeTask(item.milestoneId, item.id)
                                      }
                                      // Refresh popup by closing and reopening
                                      const currentDate = selectedDate
                                      setShowDayOptions(false)
                                      setTimeout(() => {
                                        setSelectedDate(currentDate)
                                        setShowDayOptions(true)
                                      }, 100)
                                    }}
                                    className="text-[#d7d2cb]/40 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              <div className="border-t border-white/10 my-4"></div>
                            </div>
                          ) : null
                        })()}
                        
                        {/* Add New Items */}
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
                        <ListTodo className={`w-5 h-5 ${newTaskCategory === 'milestone_task' ? 'text-purple-400' : 'text-[#ff7f00]'}`} />
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
                            className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 transition-all ${
                              newTaskCategory === 'milestone_task' ? 'focus:ring-purple-500/50' : 'focus:ring-[#ff7f00]/50'
                            }`}
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
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50 transition-all [&>option]:bg-[#0a0a0a] [&>option]:text-[#d7d2cb]"
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
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50 transition-all [&>option]:bg-[#0a0a0a] [&>option]:text-[#d7d2cb]"
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
                          <div className="flex-1 relative group">
                            {newTaskCategory === 'milestone_task' && newTaskMilestoneId && selectedDate && (() => {
                              const milestone = milestones.find(m => m.id === newTaskMilestoneId)
                              return milestone && selectedDate > milestone.target_date
                            })() && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <div className="bg-red-500/90 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                                  Task cannot be after milestone completion date
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-red-500/90"></div>
                                </div>
                              </div>
                            )}
                            <Button
                              onClick={saveTask}
                              disabled={
                                !newTaskName.trim() || 
                                (newTaskCategory === 'milestone_task' && newTaskMilestoneId && selectedDate && (() => {
                                  const milestone = milestones.find(m => m.id === newTaskMilestoneId)
                                  return milestone && selectedDate > milestone.target_date
                                })())
                              }
                              className="w-full bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                            >
                              Add
                            </Button>
                    </div>
                  </div>
                </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </FadeInWrapper>


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
              disabled={isSubmitting || !goalTitle.trim() || milestones.length === 0}
              className="flex-1 bg-gradient-to-r from-[#ff7f00] to-[#ff9f40] hover:from-[#e67300] hover:to-[#ff7f00] disabled:opacity-50 disabled:cursor-not-allowed transition-all border-0 shadow-none focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50"
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
