'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  Circle
} from 'lucide-react'
import { Button } from '../Button'
import { Badge } from '../Badge'
import { cn } from '@/lib/utils'

export interface CalendarTask {
  date: string
  tasks: string[]
}

export interface HighlightedDates {
  startDate?: string | Date
  milestones?: (string | Date)[]
  milestoneObjects?: any[] // Full milestone objects for status checking
  completionDate?: string | Date
}

export interface BaseCalendarProps {
  tasks: CalendarTask[]
  onTaskClick?: (task: string, date: string) => void
  onDateClick?: (date: string) => void
  onStartDateClick?: () => void
  defaultView?: 'month' | 'day'
  hideDayView?: boolean
  showYearDecadeView?: boolean
  futureRangeYears?: number
  highlightedDates?: string[]
  categorizedDates?: HighlightedDates
  completedTasks?: Set<string>
  completedMilestoneTasks?: Set<string>
  getMilestoneStatus?: (milestone: any) => 'completed' | 'in_progress'
}

export interface CalendarDay {
  date: Date
  dateString: string
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  hasTasks: boolean
  allTasksCompleted: boolean
  hasMilestoneTasks: boolean
  highlightType: 'start' | 'milestone' | 'completion' | 'none'
  tasks: string[]
}

// Core calendar logic that all calendar types will use
export const useBaseCalendar = (props: BaseCalendarProps) => {
  const {
    tasks,
    onTaskClick,
    onDateClick,
    onStartDateClick,
    defaultView = 'month',
    hideDayView = true,
    showYearDecadeView = false,
    futureRangeYears = 5,
    highlightedDates = [],
    categorizedDates,
    completedTasks: externalCompletedTasks = new Set(),
    completedMilestoneTasks: externalCompletedMilestoneTasks = new Set(),
    getMilestoneStatus
  } = props

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [isHydrated, setIsHydrated] = useState(false)
  
  // Year/Decade view states
  const [showYearView, setShowYearView] = useState(false)
  const [showDecadeView, setShowDecadeView] = useState(false)

  // Ensure hydration safety
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Ensure calendar never goes beyond the configured future range
  useEffect(() => {
    const maxYear = new Date().getFullYear() + futureRangeYears
    if (currentDate.getFullYear() > maxYear) {
      setCurrentDate(new Date(maxYear, currentDate.getMonth(), 1))
    }
  }, [currentDate, futureRangeYears])

  // Create a map of tasks by date for quick lookup
  const tasksByDate = useMemo(() => {
    const map = new Map<string, string[]>()
    tasks.forEach(task => {
      map.set(task.date, task.tasks)
    })
    return map
  }, [tasks])

  // Get tasks for a specific date
  const getTasksForDate = (date: string) => {
    return tasksByDate.get(date) || []
  }

  // Get tasks for selected date
  const selectedDateTasks = getTasksForDate(selectedDate)

  // Create unique task ID
  const createTaskId = (task: string, date: string) => {
    return `${date}-${task}`
  }

  // Check if task is completed
  const isTaskCompleted = (task: string | any, date: string) => {
    // Handle both string and object formats for backward compatibility
    let taskName: string
    let isMilestoneTask: boolean
    
    if (typeof task === 'string') {
      taskName = task
      isMilestoneTask = task.startsWith('🏆') && !task.startsWith('🎯')
    } else if (typeof task === 'object' && task.name) {
      taskName = task.name
      // Use the isMilestoneTask property if available, otherwise fall back to name checking
      if (task.isMilestoneTask !== undefined) {
        isMilestoneTask = task.isMilestoneTask && task.category !== 'milestone_marker'
      } else {
        isMilestoneTask = (task.name.startsWith('🏆') || task.name.includes('Milestone')) && !task.name.startsWith('🎯')
      }
    } else {
      // Fallback for unexpected formats
      taskName = String(task)
      isMilestoneTask = false
    }
    
    const taskId = createTaskId(taskName, date)
    
    if (isMilestoneTask) {
      return externalCompletedMilestoneTasks?.has(taskId) || false
    } else {
      return externalCompletedTasks?.has(taskId) || false
    }
  }

  // Check if all tasks for a day are completed
  const areAllTasksCompleted = (date: string) => {
    const tasksForDate = getTasksForDate(date)
    if (tasksForDate.length === 0) return false
    
    // Filter out milestone markers (🎯) - these are completion indicators, not actual tasks
    const actualTasks = tasksForDate.filter((task: string) => {
      return !task.startsWith('🎯')
    })
    
    // If only milestone markers exist, don't consider day as having completable tasks
    if (actualTasks.length === 0) return false
    
    return actualTasks.every(task => isTaskCompleted(task, date))
  }

  // Toggle task completion - delegate to parent component
  const toggleTaskCompletion = (task: string | any, date: string) => {
    // Handle both string and object formats for backward compatibility
    const taskName = typeof task === 'string' ? task : (task.name || String(task))
    onTaskClick?.(taskName, date)
  }

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const nextMonth = new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
      // Don't allow navigation beyond the configured future range
      const maxYear = new Date().getFullYear() + futureRangeYears
      if (nextMonth.getFullYear() > maxYear) {
        return prev
      }
      return nextMonth
    })
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setSelectedDate(todayString)
  }

  // Year view handlers
  const handleMonthClick = (month: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), month, 1))
    setShowYearView(false)
  }

  const handleYearClick = () => {
    if (showYearDecadeView) {
      setShowYearView(true)
    }
  }

  const handleDecadeClick = () => {
    if (showYearDecadeView) {
      setShowDecadeView(true)
    }
  }

  // Generate year view months
  const generateYearMonths = () => {
    const months = []
    for (let i = 0; i < 12; i++) {
      months.push({
        month: i,
        name: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'long' }),
        hasTasks: false
      })
    }
    return months
  }

  // Generate year wheel for decade view - years from 2000 to configured future range
  const generateYearWheel = () => {
    const years = []
    // Get the actual current year (not the selected year)
    const actualCurrentYear = new Date().getFullYear()
    const maxYear = actualCurrentYear + futureRangeYears
    // Generate years from 2000 to configured future range
    for (let year = 2000; year <= maxYear; year++) {
      years.push(year)
    }
    return years
  }

  // Generate calendar days
  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const days: CalendarDay[] = []
    const today = new Date()
    
    for (let i = 0; i < 35; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const isCurrentMonth = date.getMonth() === month
      const isToday = date.toDateString() === today.toDateString()
      const isSelected = dateString === selectedDate
      const dayTasks = getTasksForDate(dateString)
      
      // Filter out milestone markers (🎯) from actual tasks
      const actualTasks = dayTasks.filter(task => {
        if (typeof task === 'string') {
          return !task.startsWith('🎯') // Exclude milestone markers
        }
        return true // Keep objects
      })
      
      const hasTasks = actualTasks.length > 0
      const allTasksCompleted = areAllTasksCompleted(dateString)
      
      // Check if day has milestone tasks (exclude milestone markers which are completion indicators)
      const hasMilestoneTasks = actualTasks.some(task => {
        // Handle both string and object formats for backward compatibility
        if (typeof task === 'string') {
          // Check for 🏆 prefix (milestone tasks) but exclude 🎯 markers
          return task.startsWith('🏆') && !task.startsWith('🎯')
        } else if (typeof task === 'object' && task !== null) {
          // Type guard to access object properties
          const taskObj = task as Record<string, any>
          if (!taskObj.name) return false
          
          // Use the isMilestoneTask property if available, otherwise fall back to name checking
          if (taskObj.isMilestoneTask !== undefined) {
            return taskObj.isMilestoneTask && taskObj.category !== 'milestone_marker'
          }
          // Fallback to checking for 🏆 prefix or "Milestone" in name
          return (taskObj.name.startsWith('🏆') || taskObj.name.includes('Milestone')) && !taskObj.name.startsWith('🎯')
        }
        return false
      })
      
      // Check categorized highlighting
      let highlightType: 'start' | 'milestone' | 'completion' | 'none' = 'none'
      if (categorizedDates) {
        // Helper function to convert Date or string to comparable date string
        const toDateString = (dateInput: string | Date | undefined) => {
          if (!dateInput) return ''
          if (dateInput instanceof Date) {
            return `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, '0')}-${String(dateInput.getDate()).padStart(2, '0')}`
          }
          return dateInput
        }

        const startDateStr = toDateString(categorizedDates.startDate)
        const completionDateStr = toDateString(categorizedDates.completionDate)
        const milestoneDateStrs = categorizedDates.milestones?.map(toDateString) || []

        if (startDateStr === dateString) {
          highlightType = 'start'
        } else if (completionDateStr === dateString) {
          highlightType = 'completion'
        } else if (milestoneDateStrs.includes(dateString)) {
          // Check if this is a milestone date
          // If all tasks complete AND milestone complete, treat as completion (green)
          // Otherwise, keep as milestone (purple)
          const milestoneIndex = milestoneDateStrs.indexOf(dateString)
          
          // Use milestoneObjects if available (contains full milestone data)
          const milestone = categorizedDates.milestoneObjects?.[milestoneIndex]
          
          if (allTasksCompleted && milestone && getMilestoneStatus) {
            const milestoneStatus = getMilestoneStatus(milestone)
            if (milestoneStatus === 'completed') {
              highlightType = 'completion' // Green background + green ring
            } else {
              highlightType = 'milestone' // Purple background
            }
          } else {
            highlightType = 'milestone' // Purple background
          }
        }
      } else {
        // Fallback to old highlighting logic
        const isHighlighted = highlightedDates.includes(dateString)
        if (isHighlighted) {
          highlightType = 'completion' // Default to completion for backward compatibility
        }
      }
      
      days.push({
        date,
        dateString,
        isCurrentMonth,
        isToday,
        isSelected,
        hasTasks,
        allTasksCompleted,
        hasMilestoneTasks,
        highlightType,
        tasks: dayTasks
      })
    }
    
    return days
  }

  const calendarDays = generateCalendarDays()

  const handleDateClick = (dateString: string) => {
    // Check if this is the starting date
    if (categorizedDates?.startDate) {
      const toDateString = (dateInput: string | Date) => {
        if (dateInput instanceof Date) {
          return `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, '0')}-${String(dateInput.getDate()).padStart(2, '0')}`
        }
        return dateInput
      }
      
      if (toDateString(categorizedDates.startDate) === dateString && onStartDateClick) {
        onStartDateClick()
        return
      }
    }
    
    setSelectedDate(dateString)
    onDateClick?.(dateString)
  }

  return {
    // State
    currentDate,
    selectedDate,
    isHydrated,
    showYearView,
    showDecadeView,
    calendarDays,
    selectedDateTasks,
    tasksByDate,
    categorizedDates,
    
    // Actions
    setCurrentDate,
    setSelectedDate,
    setShowYearView,
    setShowDecadeView,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    handleDateClick,
    handleMonthClick,
    handleYearClick,
    handleDecadeClick,
    generateYearMonths,
    generateYearWheel,
    getTasksForDate,
    isTaskCompleted,
    areAllTasksCompleted,
    toggleTaskCompletion,
    
    // Props passed through
    hideDayView,
    showYearDecadeView,
    futureRangeYears,
    getMilestoneStatus
  }
}

// Base calendar grid component
export const BaseCalendarGrid = ({ 
  calendarDays, 
  onDateClick, 
  isHydrated,
  isTaskCompleted,
  areAllTasksCompleted,
  tasksByDate,
  categorizedDates,
  showAllTaskIndicators = false,
  getMilestoneStatus
}: { 
  calendarDays: CalendarDay[]
  onDateClick: (dateString: string) => void
  isHydrated: boolean
  isTaskCompleted: (task: string, date: string) => boolean
  areAllTasksCompleted: (date: string) => boolean
  tasksByDate: Map<string, string[]>
  categorizedDates?: HighlightedDates
  showAllTaskIndicators?: boolean
  getMilestoneStatus?: (milestone: any) => 'completed' | 'in_progress'
}) => {
  return (
    <>
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-[var(--muted-foreground)] py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          // Determine if milestone day is complete: all milestone tasks + daily tasks for that day must be complete
          // Check if this is a milestone date and get the milestone status
          let isMilestoneComplete = false
          if (day.highlightType === 'milestone' && categorizedDates?.milestoneObjects) {
            const toDateString = (dateInput: string | Date | undefined) => {
              if (!dateInput) return ''
              if (dateInput instanceof Date) {
                return `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, '0')}-${String(dateInput.getDate()).padStart(2, '0')}`
              }
              return dateInput
            }
            
            const milestoneDateStrs = categorizedDates.milestones?.map(toDateString) || []
            const milestoneIndex = milestoneDateStrs.indexOf(day.dateString)
            
            if (milestoneIndex >= 0 && categorizedDates.milestoneObjects[milestoneIndex]) {
              const milestone = categorizedDates.milestoneObjects[milestoneIndex]
              // Milestone is complete if ALL its milestone tasks are done AND all daily tasks for that day are done
              if (areAllTasksCompleted(day.dateString) && getMilestoneStatus) {
                isMilestoneComplete = getMilestoneStatus(milestone) === 'completed'
              }
            }
          }
          
          return (
            <motion.button
              key={day.dateString}
              onClick={() => onDateClick(day.dateString)}
              className={cn(
                'relative p-2 h-20 rounded-lg border transition-all duration-200 hover:opacity-90',
                // Background/border styling with solid backgrounds for special days
                day.highlightType === 'start' ? 'bg-[#ff7f00] border-[#ff7f00] text-white' :
                day.highlightType === 'milestone' ? (
                  isMilestoneComplete ? 'bg-green-400 border-green-400 text-white' : 'bg-pink-500 border-pink-500 text-white'
                ) :
                day.highlightType === 'completion' ? 'bg-green-500 border-green-500 text-white' : 
                'border-[var(--border)] bg-[var(--accent)]',
                // Ring colors based on task type and highlight type
                day.hasTasks && day.highlightType === 'none' ? (
                  // Normal days with tasks
                  day.allTasksCompleted ? 'ring-1 ring-green-500/50' : 
                  day.hasMilestoneTasks ? 'ring-1 ring-purple-500/50' : 
                  'ring-1 ring-[#ff7f00]/30'
                ) : day.hasTasks && (day.highlightType === 'milestone' || day.highlightType === 'completion') ? (
                  // Milestone/completion days with tasks - show green ring when complete, otherwise show task type color
                  day.highlightType === 'milestone' && isMilestoneComplete ? 'ring-2 ring-green-300' :
                  day.highlightType === 'completion' && day.allTasksCompleted ? 'ring-2 ring-green-500' :
                  day.hasMilestoneTasks ? 'ring-2 ring-purple-500' : 'ring-2 ring-[#ff7f00]'
                ) : '',
                // Add a thicker border/ring to indicate selection without changing the background color
                // Also add z-index to ensure selection ring appears above other tiles
                day.isSelected ? 'ring-4 ring-blue-500/40 z-10' : ''
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{ scale: day.isSelected ? 1.05 : 1 }}
              transition={{ duration: 0.15 }}
            >
              <span className={cn(
                'text-sm font-medium',
                // Color based on highlight type - white for special days, theme-aware for normal days
                day.highlightType === 'start' || day.highlightType === 'completion' || 
                (day.highlightType === 'milestone' && isMilestoneComplete) ? 'text-white' :
                day.highlightType === 'milestone' ? 'text-white' :
                day.isToday ? 'text-[var(--primary)]' :
                'text-[var(--foreground)]'
              )}>
                {day.date.getDate()}
              </span>
            </motion.button>
          )
        })}
      </div>
    </>
  )
}
