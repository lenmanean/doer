'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useTaskTimeSchedule } from '@/hooks/useTaskTimeSchedule'
import { TaskBlock } from './TaskBlock'
import { TaskTimeEditModal } from './TaskTimeEditModal'
import { CreateTaskModal } from './CreateTaskModal'
import { MultipleTasksPanel } from './MultipleTasksPanel'
import { calculateGridPosition, calculateTaskHeight, calculateTimeFromPosition, snapToGrid } from '@/lib/hour-view-utils'
import { formatDateForDB } from '@/lib/date-utils'
import { updateTaskCompletionUnified } from '@/lib/roadmap-client'
import { detectOverlappingTasks } from '@/lib/task-positioning'
import { calculateDuration } from '@/lib/task-time-utils'

interface HourViewProps {
  selectedDate: string  // The date from the clicked calendar tile
  onClose: () => void
  theme: 'dark' | 'light'
  planId: string  // Plan ID to fetch tasks
}

interface WeekDay {
  date: Date
  dateString: string
  dayName: string
  isSelected: boolean
}

type IntervalType = '1hr' | '30min' | '15min'

export default function HourView({ selectedDate, onClose, theme, planId }: HourViewProps) {
  // State management
  const [intervalType, setIntervalType] = useState<IntervalType>('1hr')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>()
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('09:00')
  const [currentSelectedDate, setCurrentSelectedDate] = useState<string>(selectedDate)
  const [expandedMultiPanels, setExpandedMultiPanels] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Handler functions (defined after hooks)

  const handleToggleMultiPanel = useCallback((panelId: string) => {
    setExpandedMultiPanels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(panelId)) {
        newSet.delete(panelId)
      } else {
        newSet.add(panelId)
      }
      return newSet
    })
  }, [])

  const handleTaskDelete = useCallback(async (task: any) => {
    // Implementation for task deletion
    console.log('Delete task:', task)
    // TODO: Implement actual deletion logic
  }, [])
  
  // Current time indicator state
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  
  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date())
    }
    
    // Update immediately
    updateTime()
    
    // Set up interval to update every minute
    const interval = setInterval(updateTime, 60000) // 60 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  // Load user's time format preference from settings and user ID
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        setUserId(user.id)

        const { data, error } = await supabase
          .from('user_settings')
          .select('preferences')
          .eq('user_id', user.id)
          .single()

        if (data?.preferences?.time_format) {
          setTimeFormat(data.preferences.time_format)
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setIsLoadingSettings(false)
      }
    }

    loadSettings()
  }, [])

  // Prevent background scrolling when modal is open
  useEffect(() => {
    // Store original overflow style
    const originalOverflow = document.body.style.overflow
    
    // Disable scrolling
    document.body.style.overflow = 'hidden'
    
    // Restore on cleanup
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Sync prop to state when prop changes
  useEffect(() => {
    setCurrentSelectedDate(selectedDate)
  }, [selectedDate])

  // Initialize week start based on selected date
  useEffect(() => {
    const selected = new Date(currentSelectedDate)
    const startOfWeek = new Date(selected)
    startOfWeek.setDate(selected.getDate() - selected.getDay()) // Start from Sunday
    setCurrentWeekStart(startOfWeek)
  }, [currentSelectedDate])

  // Calculate week date range for task fetching
  const weekDateRange = useMemo(() => {
    if (!currentWeekStart) return { start: '', end: '' }
    
    const endOfWeek = new Date(currentWeekStart)
    endOfWeek.setDate(endOfWeek.getDate() + 6)
    
    return {
      start: formatDateForDB(currentWeekStart),
      end: formatDateForDB(endOfWeek)
    }
  }, [currentWeekStart])

  // Use task time schedule hook
  const { tasksWithTime, updateTaskTime, getTasksForDate, refetch } = useTaskTimeSchedule(
    planId,
    weekDateRange
  )


  // Get week days
  const getWeekDays = (): WeekDay[] => {
    if (!currentWeekStart) return []
    
    const days: WeekDay[] = []
    const selectedDateObj = new Date(currentSelectedDate)
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(date.getDate() + i)
      const dateString = date.toISOString().split('T')[0]
      
      days.push({
        date,
        dateString,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isSelected: dateString === currentSelectedDate
      })
    }
    return days
  }
  
  // Calculate current time position for the indicator line
  const getCurrentTimePosition = useCallback(() => {
    const now = currentTime
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const totalMinutes = currentHour * 60 + currentMinute
    
    // Calculate position based on current interval type
    return calculateGridPosition(totalMinutes, intervalType)
  }, [currentTime, intervalType])
  
  // Check if current time is within the visible week
  const isCurrentTimeVisible = useMemo(() => {
    const today = new Date()
    const todayString = today.toISOString().split('T')[0]
    const weekDays = getWeekDays()
    return weekDays.some(day => day.dateString === todayString)
  }, [currentWeekStart, selectedDate])

  // Format time based on user preference
  const formatTime = (hour: number, minute: number = 0): string => {
    if (timeFormat === '24h') {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    } else {
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      if (minute === 0 && intervalType === '1hr') {
        return `${displayHour} ${period}`
      }
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
    }
  }

  // Week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev!)
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
      return newDate
    })
  }

  // Task handlers
  const handleTaskClick = useCallback((task: any) => {
    setSelectedTask(task)
    setShowEditModal(true)
  }, [])

  const handleTaskDragEnd = useCallback(async (task: any, offsetY: number, date: string) => {
    if (!task.start_time || !task.end_time) return

    // Calculate new start time based on drag offset
    const currentPosition = calculateGridPosition(
      parseInt(task.start_time.split(':')[0]) * 60 + parseInt(task.start_time.split(':')[1]),
      intervalType
    )
    const newPosition = currentPosition + offsetY
    const newStartTime = calculateTimeFromPosition(newPosition, intervalType)
    const snappedStartTime = snapToGrid(newStartTime, intervalType)

    // Calculate new end time (maintain duration)
    const durationMinutes = task.duration_minutes || 60
    const newStartMinutes = parseInt(snappedStartTime.split(':')[0]) * 60 + parseInt(snappedStartTime.split(':')[1])
    const newEndMinutes = newStartMinutes + durationMinutes
    const newEndTime = `${Math.floor(newEndMinutes / 60).toString().padStart(2, '0')}:${(newEndMinutes % 60).toString().padStart(2, '0')}`

    // Update task time
    const result = await updateTaskTime(task.schedule_id, snappedStartTime, newEndTime, date)
    
    if (!result.success) {
      console.error('Failed to update task time:', result.error)
      // TODO: Show error toast
    }
  }, [intervalType, updateTaskTime])

  const handleTaskComplete = useCallback(async (task: any) => {
    if (!userId || !planId) return

    try {
      await updateTaskCompletionUnified({
        userId,
        planId,
        taskId: task.task_id,
        isCompleted: !task.completed,
        scheduledDate: task.date
      })
      // Refresh tasks after completion
      refetch()
    } catch (error) {
      console.error('Error updating task completion:', error)
      // TODO: Show error toast
    }
  }, [userId, planId, refetch])

  const handleSaveTaskTime = useCallback(async (
    scheduleId: string,
    startTime: string,
    endTime: string
  ) => {
    if (!selectedTask) return { success: false, error: 'No task selected' }
    
    const result = await updateTaskTime(scheduleId, startTime, endTime, selectedTask.date)
    if (result.success) {
      setShowEditModal(false)
      setSelectedTask(null)
    }
    return result
  }, [selectedTask, updateTaskTime])

  const weekDays = getWeekDays()

  // Generate time slots based on interval type
  const timeSlots = useMemo(() => {
    const slots = []
    let minuteInterval: number
    
    switch (intervalType) {
      case '1hr':
        minuteInterval = 60
        break
      case '30min':
        minuteInterval = 30
        break
      case '15min':
        minuteInterval = 15
        break
      default:
        minuteInterval = 60
    }
    
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += minuteInterval) {
        slots.push({
          hour,
          minute: min,
          label: formatTime(hour, min)
        })
      }
    }
    return slots
  }, [intervalType, timeFormat])

  // Calculate row height based on interval type
  const getRowHeight = () => {
    switch (intervalType) {
      case '1hr':
        return 60
      case '30min':
        return 40
      case '15min':
        return 30
      default:
        return 60
    }
  }

  const rowHeight = getRowHeight()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`${
          theme === 'dark' 
            ? 'bg-[#0a0a0a]/95 border-white/10' 
            : 'bg-white/95 border-gray-200'
        } border rounded-xl shadow-2xl backdrop-blur-md w-[95vw] max-w-[1800px] h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-6">
            <h2 className={`text-xl font-semibold flex items-center gap-2 ${
              theme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
            }`}>
              <Clock className="w-5 h-5" />
              Hour View
            </h2>

            {/* Interval Toggle Buttons */}
            <div className="flex items-center gap-2">
              <span className={`text-sm mr-2 ${
                theme === 'dark' ? 'text-[#d7d2cb]/60' : 'text-gray-600'
              }`}>
                Interval:
              </span>
              {(['1hr', '30min', '15min'] as IntervalType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setIntervalType(type)}
                  className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                    intervalType === type
                      ? 'bg-[var(--primary)] text-white shadow-lg'
                      : theme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateWeek('prev')}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
                title="Previous Week"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className={`text-sm font-medium min-w-[140px] text-center ${
                theme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
              }`}>
                {currentWeekStart && (
                  <>
                    {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' - '}
                    {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </>
                )}
              </span>
              <button
                onClick={() => navigateWeek('next')}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
                title="Next Week"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              }`}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-hidden relative">
          <div
            ref={gridRef}
            className="h-full overflow-auto"
            style={{ scrollBehavior: 'smooth' }}
          >
            <AnimatePresence mode="wait">
              {/* Grid */}
              <motion.div
                key={intervalType}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="inline-grid relative"
                style={{ 
                  gridTemplateColumns: `140px repeat(7, minmax(150px, 1fr))`,
                  minWidth: '100%'
                }}
              >
                {/* Current Time Indicator */}
                {isCurrentTimeVisible && (
                  <motion.div
                    className="absolute left-0 right-0 z-30 group cursor-pointer"
                    style={{
                      top: `${getCurrentTimePosition() + 70}px`, // +70px to account for header height
                      height: '2px'
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="h-full bg-[var(--primary)] shadow-lg shadow-[var(--primary)]/50 relative">
                      {/* Time tab - minimized by default, expands on hover over entire line */}
                      <div className="absolute -left-1 -top-1 bg-[var(--primary)] rounded-full w-3 h-3 shadow-lg transition-all duration-200 ease-in-out overflow-hidden group-hover:w-auto group-hover:h-auto group-hover:rounded-md group-hover:px-2 group-hover:py-1">
                        <div className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium whitespace-nowrap transition-opacity duration-200">
                          {currentTime.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: timeFormat === '12h'
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              {/* Empty corner cell */}
              <div className={`sticky top-0 left-0 z-20 border-r border-b ${
                theme === 'dark'
                  ? 'bg-[#0a0a0a]/95 border-white/10'
                  : 'bg-white/95 border-gray-200'
              }`} style={{ height: '70px' }}>
                <div className="flex items-center justify-center h-full">
                  <span className={`text-xs font-medium ${
                    theme === 'dark' ? 'text-[#d7d2cb]/40' : 'text-gray-400'
                  }`}>
                    Time
                  </span>
                </div>
              </div>

              {/* Day Headers */}
              {weekDays.map((day, dayIndex) => (
                <div
                  key={day.dateString}
                  className={`sticky top-0 z-10 border-b p-4 text-center transition-colors relative ${
                    day.isSelected 
                      ? 'bg-[var(--primary)] text-white' 
                      : theme === 'dark'
                        ? 'bg-[#0a0a0a]/95 border-white/10 text-[#d7d2cb]'
                        : 'bg-white/95 border-gray-200 text-gray-900'
                  }`}
                  style={{ height: '70px' }}
                >
                  <div className="text-base font-semibold">{day.dayName}</div>
                  <div className="text-sm opacity-75 mt-1">
                    {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}

              {/* Time Grid Rows */}
              {timeSlots.map((slot, slotIndex) => (
                <>
                  {/* Time Label */}
                  <div
                    key={`time-${slot.hour}-${slot.minute}`}
                    className={`sticky left-0 z-10 border-r border-b p-3 flex items-center justify-end ${
                      theme === 'dark'
                        ? 'bg-[#0a0a0a]/95 border-white/10 text-[#d7d2cb]'
                        : 'bg-white/95 border-gray-200 text-gray-900'
                    }`}
                    style={{ height: `${rowHeight}px` }}
                  >
                    <div className="text-sm font-medium pr-2">
                      {slot.label}
                    </div>
                  </div>

                  {/* Time Slots for each day */}
                  {weekDays.map((day, dayIndex) => {
                    const dayTasks = getTasksForDate(day.dateString)
                    const tasksForDay = dayTasks
                    
                    // Calculate tasks that start in this time slot
                    const tasksInThisSlot = tasksForDay.filter(task => {
                      if (!task.start_time || !task.end_time) return false
                      
                      const taskStartHour = parseInt(task.start_time.split(':')[0])
                      const taskStartMinute = parseInt(task.start_time.split(':')[1])
                      
                      const taskStartMinutes = taskStartHour * 60 + taskStartMinute
                      const slotStartMinutes = slot.hour * 60 + slot.minute
                      const slotEndMinutes = slotStartMinutes + (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)
                      
                      // Only include tasks that START in this time slot
                      return taskStartMinutes >= slotStartMinutes && taskStartMinutes < slotEndMinutes
                    })
                    
                    // Calculate how many tasks overlap at each minute within this slot
                    const overlappingTasks = tasksInThisSlot.map(task => {
                      const taskStartHour = parseInt(task.start_time!.split(':')[0])
                      const taskStartMinute = parseInt(task.start_time!.split(':')[1])
                      const taskEndHour = parseInt(task.end_time!.split(':')[0])
                      const taskEndMinute = parseInt(task.end_time!.split(':')[1])
                      
                      const taskStartMinutes = taskStartHour * 60 + taskStartMinute
                      const taskEndMinutes = taskEndHour * 60 + taskEndMinute
                      const slotStartMinutes = slot.hour * 60 + slot.minute
                      const slotEndMinutes = slotStartMinutes + (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)
                      
                      return {
                        ...task,
                        startMinutes: Math.max(taskStartMinutes, slotStartMinutes),
                        endMinutes: Math.min(taskEndMinutes, slotEndMinutes),
                        originalStartMinutes: taskStartMinutes,
                        originalEndMinutes: taskEndMinutes
                      }
                    })
                    
                    // Detect overlapping tasks for this day
                    const overlappingGroups = detectOverlappingTasks(tasksForDay)
                    
                    // Filter to only render the group in the slot that contains the group's earliest start time
                    const relevantOverlapGroups = overlappingGroups.filter(group => {
                      const groupEarliestStart = Math.min(
                        ...group.tasks.map(t => {
                          const h = parseInt(t.start_time!.split(':')[0])
                          const m = parseInt(t.start_time!.split(':')[1])
                          return h * 60 + m
                        })
                      )
                      const slotStartMinutes = slot.hour * 60 + slot.minute
                      const slotEndMinutes = slotStartMinutes + (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)
                      return groupEarliestStart >= slotStartMinutes && groupEarliestStart < slotEndMinutes
                    })
                    
                    // Get tasks that are NOT in any overlap group (including all groups, not just relevant ones)
                    const allTasksInOverlapGroups = new Set(
                      overlappingGroups.flatMap(group => group.tasks.map(t => t.schedule_id))
                    )
                    
                    const nonOverlappingTasks = tasksInThisSlot.filter(task => 
                      !allTasksInOverlapGroups.has(task.schedule_id)
                    )
                    
                    return (
                      <div
                        key={`${day.dateString}-${slot.hour}-${slot.minute}`}
                        className={`border-b border-r transition-colors relative cursor-pointer ${
                          day.isSelected 
                            ? theme === 'dark'
                              ? 'bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20'
                              : 'bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20'
                            : theme === 'dark'
                              ? 'border-white/5 hover:bg-white/5'
                              : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                        }`}
                        style={{ 
                          height: `${rowHeight}px`,
                          minHeight: `${rowHeight}px`
                        }}
                        onClick={() => {
                          // Only open create modal if there are no tasks that start in this slot
                          if (tasksInThisSlot.length === 0) {
                            const timeString = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
                            console.log('Clicked time slot in HourView:', { slot, timeString, day: day.dateString })
                            
                            // Update state and then open modal
                            setSelectedTimeSlot(timeString)
                            setCurrentSelectedDate(day.dateString)
                            
                            // Use setTimeout to ensure state is updated before modal opens
                            setTimeout(() => {
                              setShowCreateModal(true)
                            }, 0)
                          }
                        }}
                      >
                        {/* Render MultipleTasksPanel for overlapping groups - only for the earliest task */}
                        {relevantOverlapGroups.map((overlapGroup) => {
                          // Find the earliest task in the group that starts in this slot
                          const earliestTaskInSlot = overlapGroup.tasks
                            .filter(task => {
                              if (!task.start_time || !task.end_time) return false
                              
                              const taskStartHour = parseInt(task.start_time.split(':')[0])
                              const taskStartMinute = parseInt(task.start_time.split(':')[1])
                              const taskStartMinutes = taskStartHour * 60 + taskStartMinute
                              const slotStartMinutes = slot.hour * 60 + slot.minute
                              const slotEndMinutes = slotStartMinutes + (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)
                              
                              return taskStartMinutes >= slotStartMinutes && taskStartMinutes < slotEndMinutes
                            })
                            .sort((a, b) => {
                              const aStartMinutes = parseInt(a.start_time!.split(':')[0]) * 60 + parseInt(a.start_time!.split(':')[1])
                              const bStartMinutes = parseInt(b.start_time!.split(':')[0]) * 60 + parseInt(b.start_time!.split(':')[1])
                              return aStartMinutes - bStartMinutes
                            })[0]
                          
                          if (!earliestTaskInSlot) return null
                          
                          // Calculate position based on the earliest task's start time
                          const taskStartHour = parseInt(earliestTaskInSlot.start_time!.split(':')[0])
                          const taskStartMinute = parseInt(earliestTaskInSlot.start_time!.split(':')[1])
                          const startMinutes = taskStartHour * 60 + taskStartMinute
                          const slotStartMinutes = slot.hour * 60 + slot.minute
                          
                          // Calculate position relative to the slot start
                          const relativeStartMinutes = Math.max(0, startMinutes - slotStartMinutes)
                          const topPosition = (relativeStartMinutes / (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)) * rowHeight
                          
                          // Calculate height based on the full overlap group duration
                          const groupStartMinutes = Math.min(...overlapGroup.tasks.map(t => {
                            const startHour = parseInt(t.start_time!.split(':')[0])
                            const startMinute = parseInt(t.start_time!.split(':')[1])
                            return startHour * 60 + startMinute
                          }))
                          const groupEndMinutes = Math.max(...overlapGroup.tasks.map(t => {
                            const endHour = parseInt(t.end_time!.split(':')[0])
                            const endMinute = parseInt(t.end_time!.split(':')[1])
                            return endHour * 60 + endMinute
                          }))
                          
                          const fullDurationMinutes = groupEndMinutes - groupStartMinutes
                          const height = Math.max(40, (fullDurationMinutes / (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)) * rowHeight)
                          
                          return (
                            <MultipleTasksPanel
                              key={overlapGroup.id}
                              overlapGroup={overlapGroup}
                              topPosition={topPosition}
                              height={height}
                              theme="dark"
                              onTaskClick={handleTaskClick}
                              onTaskComplete={handleTaskComplete}
                              isExpanded={expandedMultiPanels.has(overlapGroup.id)}
                              onToggleExpanded={() => handleToggleMultiPanel(overlapGroup.id)}
                            />
                          )
                        })}
                        
                        {/* Render individual TaskBlocks for non-overlapping tasks */}
                        {nonOverlappingTasks.map((task, taskIndex) => {
                          const taskStartHour = parseInt(task.start_time!.split(':')[0])
                          const taskStartMinute = parseInt(task.start_time!.split(':')[1])
                          const startMinutes = taskStartHour * 60 + taskStartMinute
                          const slotStartMinutes = slot.hour * 60 + slot.minute
                          
                          // Calculate task end time first
                          const taskEndMinutes = parseInt(task.end_time!.split(':')[0]) * 60 + parseInt(task.end_time!.split(':')[1])
                          
                          // Only render if task starts in this slot AND is scheduled for this day
                          const slotEndMinutes = slotStartMinutes + (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)
                          const startsInSlot = startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes
                          const isScheduledForThisDay = task.date === day.dateString
                          
                          if (!startsInSlot || !isScheduledForThisDay) return null
                          
                          // For non-expanded view, calculate position relative to the slot start
                          const relativeStartMinutes = Math.max(0, startMinutes - slotStartMinutes)
                          const topPosition = (relativeStartMinutes / (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)) * rowHeight
                          
                          // Calculate height based on full task duration
                          const fullDurationMinutes = taskEndMinutes - startMinutes
                          const height = Math.max(20, (fullDurationMinutes / (intervalType === '15min' ? 15 : intervalType === '30min' ? 30 : 60)) * rowHeight)
                          
                          return (
                            <TaskBlock
                              key={task.schedule_id}
                              task={{
                                ...task,
                                priority: task.priority ?? undefined
                              }}
                              topPosition={topPosition}
                              height={height}
                              theme="dark"
                              onDragStart={() => {}}
                              onDragEnd={() => {}} // Disabled dragging
                              onClick={() => handleTaskClick(task)}
                              onComplete={() => handleTaskComplete(task)}
                              style={{
                                left: '0%',
                                width: '100%',
                                zIndex: 5
                              }}
                            />
                          )
                        })}
                      </div>
                    )
                  })}
                </>
              ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${
          theme === 'dark' 
            ? 'border-white/10 bg-[#0a0a0a]/50' 
            : 'border-gray-200 bg-gray-50/50'
        }`}>
          <div className={`flex items-center justify-between text-sm ${
            theme === 'dark' ? 'text-[#d7d2cb]/60' : 'text-gray-600'
          }`}>
            <div>
              {timeSlots.length} time slots displayed • {weekDays.length} days
            </div>
            <div>
              Selected: {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Task Time Edit Modal */}
      <TaskTimeEditModal
        task={selectedTask}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedTask(null)
        }}
        onSave={handleSaveTaskTime}
        onDelete={async (task) => {
          setShowEditModal(false)
          setSelectedTask(null)
        }}
        theme={theme}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTaskCreated={() => {
          // Refresh the task list to show the new task
          refetch()
        }}
        selectedDate={selectedDate}
        selectedTime={selectedTimeSlot}
        theme="dark"
        currentWeekStart={currentWeekStart}
      />
    </motion.div>
  )
}
