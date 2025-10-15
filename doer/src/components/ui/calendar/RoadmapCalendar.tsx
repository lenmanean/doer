'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react'
import { Button } from '../Button'
import { useBaseCalendar, BaseCalendarProps, BaseCalendarGrid } from './BaseCalendar'

export interface RoadmapCalendarProps extends BaseCalendarProps {
  // Roadmap-specific props can be added here
  getMilestoneStatus?: (milestone: any) => 'completed' | 'in_progress'
  disableDayPopup?: boolean // Disable the automatic day popup for tasks
}

export const RoadmapCalendar = (props: RoadmapCalendarProps) => {
  const {
    defaultView = 'month',
    hideDayView = true,
    disableDayPopup = false,
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
    toggleTaskCompletion,
    
    // Props
    hideDayView: baseHideDayView,
    showYearDecadeView,
    futureRangeYears
  } = useBaseCalendar({ ...baseProps, hideDayView })

  // Enhanced date click handler for roadmap
  const handleRoadmapDateClick = (dateString: string) => {
    handleDateClick(dateString)
    
    // Only show popup if not disabled and date has tasks
    if (!disableDayPopup) {
      const tasksForDate = getTasksForDate(dateString)
      if (tasksForDate.length > 0) {
        setSelectedDayTasks({ date: dateString, tasks: tasksForDate })
      }
    }
  }

  // Enhanced start date click handler
  const handleRoadmapStartDateClick = () => {
    setShowStartDatePopup(true)
  }

  return (
    <div className="space-y-4 relative">
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
            onClick={showDecadeView ? undefined : (showYearDecadeView ? (showYearView ? handleDecadeClick : handleYearClick) : handleYearClick)}
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
        animate={selectedDayTasks || showStartDatePopup ? { scale: 0.98, opacity: 0.7 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          filter: selectedDayTasks || showStartDatePopup ? 'blur(10px)' : 'blur(0px)',
          transition: 'filter 0.3s ease-out'
        }}
      >
        <AnimatePresence mode="wait">
          {/* Roadmap Year View (Month Selection) */}
          {showYearView && showYearDecadeView && !showDecadeView && (
            <motion.div
              key="year-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="grid grid-cols-4 gap-4 p-6"
            >
              {generateYearMonths().map((month) => (
                <motion.button
                  key={month.month}
                  onClick={() => handleMonthClick(month.month)}
                  className="p-6 text-center rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center min-h-[80px]"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="text-2xl font-semibold text-[#d7d2cb] text-center leading-tight">{month.name}</div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Roadmap Decade View (Year Wheel) */}
          {showDecadeView && showYearDecadeView && (
            <motion.div
              key="decade-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="p-6"
            >
              <div className="relative">
                <div className="max-h-80 overflow-y-auto scrollbar-hide">
                  <div className="space-y-2">
                    {generateYearWheel().map((year) => (
                      <motion.button
                        key={year}
                        onClick={() => {
                          setCurrentDate(new Date(year, currentDate.getMonth(), 1))
                          setShowDecadeView(false)
                        }}
                        className={`w-full p-4 text-center rounded-lg hover:bg-white/10 transition-colors ${
                          year === currentDate.getFullYear() ? 'bg-[#ff7f00]/20 border border-[#ff7f00]/30' : ''
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`text-2xl font-semibold ${
                          year === currentDate.getFullYear() ? 'text-[#ff7f00]' : 'text-[#d7d2cb]'
                        }`}>
                          {year}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Calendar Days - Only show when not in year/decade views */}
          {!showYearView && !showDecadeView && (
            <motion.div
              key="month-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <BaseCalendarGrid 
                calendarDays={calendarDays}
                onDateClick={handleRoadmapDateClick}
                isHydrated={isHydrated}
                isTaskCompleted={isTaskCompleted}
                areAllTasksCompleted={areAllTasksCompleted}
                tasksByDate={tasksByDate}
                categorizedDates={categorizedDates}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Day Tasks Popup - Contained within calendar */}
      <AnimatePresence>
        {selectedDayTasks && (
          <motion.div 
            className="absolute inset-0 z-10 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Subtle backdrop - no dark overlay */}
            <motion.div 
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={() => setSelectedDayTasks(null)}
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
                      const [year, month, day] = selectedDayTasks.date.split('-').map(Number)
                      const date = new Date(year, month - 1, day)
                      const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
                      const dateStr = date.toLocaleDateString('en-US', { 
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
                
                {/* Tasks List */}
                <div className="space-y-2">
                  {selectedDayTasks.tasks
                    .sort((a, b) => {
                      // Sort order: daily tasks first, then milestone tasks, then milestone markers
                      const aIsMilestoneMarker = typeof a === 'string' && a.startsWith('🎯')
                      const aIsMilestoneTask = typeof a === 'string' && a.startsWith('🏆')
                      const bIsMilestoneMarker = typeof b === 'string' && b.startsWith('🎯')
                      const bIsMilestoneTask = typeof b === 'string' && b.startsWith('🏆')
                      
                      // Daily tasks (neither milestone marker nor milestone task) come first
                      if (!aIsMilestoneMarker && !aIsMilestoneTask && (bIsMilestoneMarker || bIsMilestoneTask)) return -1
                      if ((aIsMilestoneMarker || aIsMilestoneTask) && !bIsMilestoneMarker && !bIsMilestoneTask) return 1
                      
                      // Among same type, maintain original order
                      return 0
                    })
                    .map((task, index) => {
                    const isCompleted = isTaskCompleted(task, selectedDayTasks.date)
                    const isMilestoneMarker = typeof task === 'string' && task.startsWith('🎯')
                    const isMilestoneTask = typeof task === 'string' ? task.startsWith('🏆') : false
                    
                    return (
                      <motion.div 
                        key={index} 
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors backdrop-blur-sm ${
                          isMilestoneMarker
                            ? 'bg-pink-500/10 hover:bg-pink-500/15 border border-pink-500/30'
                            : isMilestoneTask 
                            ? 'bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20' 
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        transition={{ duration: 0.1 }}
                      >
                        {!isMilestoneMarker && (
                          <motion.button
                            onClick={() => toggleTaskCompletion(task, selectedDayTasks.date)}
                            className="flex-shrink-0 mt-0.5"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {isCompleted ? (
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                isMilestoneTask ? 'bg-purple-500' : 'bg-green-500'
                              }`}>
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            ) : (
                              <div className={`w-5 h-5 border-2 rounded-full ${
                                isMilestoneTask ? 'border-purple-500' : 'border-[#ff7f00]'
                              }`} />
                            )}
                          </motion.button>
                        )}
                        <span className={`text-sm flex-1 ${
                          isMilestoneMarker
                            ? 'text-[#d7d2cb] font-semibold'
                            : isCompleted 
                            ? 'line-through text-[#d7d2cb]/50' 
                            : isMilestoneTask 
                              ? 'text-purple-300' 
                              : 'text-[#d7d2cb]'
                        }`}>
                          {(() => {
                            if (typeof task === 'string') {
                              // Remove both target and trophy emojis from display
                              if (task.startsWith('🎯')) {
                                return task.substring(2).trim()
                              } else if (task.startsWith('🏆')) {
                                return task.substring(2).trim()
                              }
                            }
                            return task
                          })()}
                        </span>
                        {isMilestoneMarker && (
                          <span className="text-xs text-pink-400 bg-pink-500/20 px-2 py-1 rounded backdrop-blur-sm border border-pink-500/30">
                            Milestone
                          </span>
                        )}
                        {isMilestoneTask && !isMilestoneMarker && (
                          <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded backdrop-blur-sm border border-purple-500/30">
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

      {/* Start Date Popup - Contained within calendar */}
      <AnimatePresence>
        {showStartDatePopup && (
          <motion.div 
            className="absolute inset-0 z-10 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Subtle backdrop - no dark overlay */}
            <motion.div 
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={() => setShowStartDatePopup(false)}
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
                
                {/* Content */}
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
    </div>
  )
}
