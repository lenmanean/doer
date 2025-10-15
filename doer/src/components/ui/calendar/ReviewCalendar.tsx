'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon
} from 'lucide-react'
import { Button } from '../Button'
import { toLocalMidnight, formatDateForDisplay } from '@/lib/date-utils'
import { useBaseCalendar, BaseCalendarProps, BaseCalendarGrid } from './BaseCalendar'

export interface ReviewCalendarProps extends BaseCalendarProps {
  // Review-specific props can be added here
}

export const ReviewCalendar = (props: ReviewCalendarProps) => {
  const {
    defaultView = 'month',
    hideDayView = true,
    ...baseProps
  } = props

  const [selectedDayTasks, setSelectedDayTasks] = useState<{date: string, tasks: string[]} | null>(null)
  const [showStartDatePopup, setShowStartDatePopup] = useState(false)

  const {
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
    
    // Props
    showYearDecadeView,
    futureRangeYears
  } = useBaseCalendar({ 
    ...baseProps, 
    defaultView, 
    hideDayView,
    onStartDateClick: () => setShowStartDatePopup(true)
  })

  // Enhanced date click handler for review
  const handleReviewDateClick = (dateString: string) => {
    handleDateClick(dateString)
    
    // Check if this is the starting date
    if (categorizedDates?.startDate) {
      const toDateString = (dateInput: string | Date) => {
        if (dateInput instanceof Date) {
          return `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, '0')}-${String(dateInput.getDate()).padStart(2, '0')}`
        }
        return dateInput
      }
      
      if (toDateString(categorizedDates.startDate) === dateString) {
        setShowStartDatePopup(true)
        return
      }
    }
    
    // Check if this date has tasks and show popup
    const tasksForDate = getTasksForDate(dateString)
    if (tasksForDate.length > 0) {
      setSelectedDayTasks({ date: dateString, tasks: tasksForDate })
    }
  }

  if (!isHydrated) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded"></div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-3 mb-6 px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          className="text-[#d7d2cb]/70 hover:text-[#ff7f00] hover:bg-white/10 w-10 h-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="min-w-[200px] text-center">
          <div className="text-2xl font-semibold text-[#d7d2cb]">
            {formatDateForDisplay(currentDate, { month: 'long' })}
          </div>
          <div className="text-lg text-[#d7d2cb]/70 mt-1">
            {currentDate.getFullYear()}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="text-[#d7d2cb]/70 hover:text-[#ff7f00] hover:bg-white/10 w-10 h-10"
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
        animate={selectedDayTasks || showStartDatePopup ? { scale: 0.98, opacity: 0.7 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          filter: selectedDayTasks || showStartDatePopup ? 'blur(10px)' : 'blur(0px)',
          transition: 'filter 0.3s ease-out'
        }}
      >
        <BaseCalendarGrid
          calendarDays={calendarDays}
          onDateClick={handleReviewDateClick}
          isHydrated={isHydrated}
          isTaskCompleted={isTaskCompleted}
          areAllTasksCompleted={areAllTasksCompleted}
          tasksByDate={tasksByDate}
          categorizedDates={categorizedDates}
          showAllTaskIndicators={true}
        />
      </motion.div>

      {/* Start Date Popup */}
      <AnimatePresence>
        {showStartDatePopup && (
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
              onClick={() => setShowStartDatePopup(false)}
            />

            <motion.div
              className="relative w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#d7d2cb]">
                    Start Date
                  </h3>
                  <button
                    onClick={() => setShowStartDatePopup(false)}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-sm text-[#d7d2cb]">
                      Your journey begins here. This is the start date of your roadmap.
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Tasks Popup - Read-only for review */}
      <AnimatePresence>
        {selectedDayTasks && (
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
              onClick={() => setSelectedDayTasks(null)}
            />

            <motion.div
              className="relative w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl"
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
                      const [year, month, day] = selectedDayTasks.date.split('-').map(Number)
                      const date = new Date(year, month - 1, day)
                      const weekday = formatDateForDisplay(date, { weekday: 'long' })
                      const dateStr = formatDateForDisplay(date, {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric'
                      })
                      return (
                        <>
                          {weekday} <span className="text-sm text-[#d7d2cb]/60">({dateStr})</span>
                        </>
                      )
                    })()}
                  </h3>
                  <button
                    onClick={() => setSelectedDayTasks(null)}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedDayTasks.tasks
                    .sort((a, b) => {
                      // Sort order: daily tasks first, then milestone tasks, then milestone markers
                      const aObj = typeof a === 'object' && a !== null ? (a as Record<string, any>) : null
                      const bObj = typeof b === 'object' && b !== null ? (b as Record<string, any>) : null
                      
                      const aIsMilestoneMarker = (aObj && aObj.category === 'milestone_marker') || (typeof a === 'string' && a.startsWith('🎯'))
                      const aIsMilestoneTask = (aObj && aObj.isMilestoneTask) || (typeof a === 'string' && a.startsWith('🏆'))
                      const bIsMilestoneMarker = (bObj && bObj.category === 'milestone_marker') || (typeof b === 'string' && b.startsWith('🎯'))
                      const bIsMilestoneTask = (bObj && bObj.isMilestoneTask) || (typeof b === 'string' && b.startsWith('🏆'))
                      
                      // Daily tasks (neither milestone marker nor milestone task) come first
                      if (!aIsMilestoneMarker && !aIsMilestoneTask && (bIsMilestoneMarker || bIsMilestoneTask)) return -1
                      if ((aIsMilestoneMarker || aIsMilestoneTask) && !bIsMilestoneMarker && !bIsMilestoneTask) return 1
                      
                      // Among same type, maintain original order
                      return 0
                    })
                    .map((task, index) => {
                    // Handle both old string format and new object format
                    const taskObj = typeof task === 'object' && task !== null ? (task as Record<string, any>) : null
                    const taskName = typeof task === 'string' ? task : (taskObj?.name || 'Unnamed task')
                    const taskCategory = taskObj ? (taskObj.category || 'daily_task') : 'daily_task'
                    const isMilestoneTask = taskObj ? taskObj.isMilestoneTask : (typeof task === 'string' && task.startsWith('🏆'))
                    const isMilestoneMarker = taskCategory === 'milestone_marker' || (typeof task === 'string' && task.startsWith('🎯'))
                    
                    return (
                      <motion.div 
                        key={index} 
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          isMilestoneMarker
                            ? 'bg-pink-500/10 hover:bg-pink-500/15 border border-pink-500/30'
                            : isMilestoneTask 
                            ? 'bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20' 
                            : 'bg-white/5 hover:bg-white/8'
                        }`}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.1 }}
                      >
                        <span className={`text-sm flex-1 ${
                          isMilestoneMarker ? 'text-[#d7d2cb] font-semibold' : isMilestoneTask ? 'text-purple-300' : 'text-[#d7d2cb]'
                        }`}>
                          {(() => {
                            if (typeof taskName === 'string') {
                              // Remove both target and trophy emojis from display
                              if (taskName.startsWith('🎯')) {
                                return taskName.substring(2).trim()
                              } else if (taskName.startsWith('🏆')) {
                                return taskName.substring(2).trim()
                              }
                            }
                            return taskName
                          })()}
                        </span>
                        {isMilestoneMarker && (
                          <span className="text-xs text-pink-400 bg-pink-500/20 px-2 py-1 rounded border border-pink-500/30">
                            Milestone
                          </span>
                        )}
                        {isMilestoneTask && !isMilestoneMarker && (
                          <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded border border-purple-500/30">
                            Milestone Task
                          </span>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}