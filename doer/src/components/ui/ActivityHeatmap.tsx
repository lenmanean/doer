'use client'

import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ActivityHeatmapData {
  date: string
  count: number
  tasks?: string[]
}

interface ActivityHeatmapProps {
  data: ActivityHeatmapData[]
  className?: string
  onDayClick?: (date: string) => void
}

export function ActivityHeatmap({ data, className, onDayClick }: ActivityHeatmapProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [showMonthSelector, setShowMonthSelector] = useState(false)
  const [showYearSelector, setShowYearSelector] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]

  // Generate days for selected month
  const monthData = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1)
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0)
    const firstDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: Array<{ date: string; count: number; tasks?: string[] }> = []

    // Add empty cells for days before month starts
    for (let j = 0; j < firstDayOfWeek; j++) {
      days.push({ date: '', count: 0 })
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayData = data.find(d => d.date === dateStr)
      days.push({
        date: dateStr,
        count: dayData?.count || 0,
        tasks: dayData?.tasks
      })
    }

    return days
  }, [data, selectedMonth, selectedYear])

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-gray-800/50'
    if (count >= 1 && count <= 2) return 'bg-green-500/40'
    if (count >= 3 && count <= 4) return 'bg-green-500/60'
    return 'bg-green-500'
  }

  const handleDayHover = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if (!date) return
    setHoveredDate(date)
    const rect = e.currentTarget.getBoundingClientRect()
    const containerRect = e.currentTarget.closest('[data-heatmap-container]')?.getBoundingClientRect()
    if (containerRect) {
      // Position relative to container
      const x = rect.left - containerRect.left + rect.width / 2
      const y = rect.top - containerRect.top
      setTooltipPosition({ x, y })
    } else {
      // Fallback to absolute positioning
      setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top })
    }
  }

  const handleDayClick = (date: string) => {
    if (!date || !onDayClick) return
    onDayClick(date)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11)
        setSelectedYear(selectedYear - 1)
      } else {
        setSelectedMonth(selectedMonth - 1)
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0)
        setSelectedYear(selectedYear + 1)
      } else {
        setSelectedMonth(selectedMonth + 1)
      }
    }
  }

  const handleMonthSelect = (monthIndex: number) => {
    setSelectedMonth(monthIndex)
    setShowMonthSelector(false)
  }

  const handleYearSelect = (year: number) => {
    setSelectedYear(year)
    setShowYearSelector(false)
  }

  // Generate year options (current year ± 5 years)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

  const hoveredData = hoveredDate ? data.find(d => d.date === hoveredDate) : null

  // Group days by week for y-axis labels
  const weeksData = useMemo(() => {
    const weeks: Array<Array<{ date: string; count: number; tasks?: string[]; dayNumber: number }>> = []
    let currentWeek: Array<{ date: string; count: number; tasks?: string[]; dayNumber: number }> = []
    
    monthData.forEach((day, index) => {
      if (!day.date) {
        // Empty cell
        currentWeek.push({ ...day, dayNumber: 0 })
      } else {
        // Extract day number from date
        const dayNumber = parseInt(day.date.split('-')[2], 10)
        currentWeek.push({ ...day, dayNumber })
      }
      
      // If we've filled 7 days (a week), start a new week
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })
    
    // Add the last week if it's not complete
    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }
    
    return weeks
  }, [monthData])

  return (
    <div ref={containerRef} data-heatmap-container className={cn('relative overflow-visible', className)}>
      {/* Month/Year Navigation */}
      <div className="flex items-center justify-center mb-1">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-[#d7d2cb]/70" />
          </button>
          
          {/* Month Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMonthSelector(!showMonthSelector)
                setShowYearSelector(false)
              }}
              className={cn(
                'px-5 py-2.5 rounded hover:bg-white/10 transition-colors text-[#d7d2cb] font-medium text-lg',
                showMonthSelector && 'bg-white/10'
              )}
            >
              <span>{monthNames[selectedMonth]}</span>
            </button>

            <AnimatePresence>
              {showMonthSelector && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setShowMonthSelector(false)
                      setShowYearSelector(false)
                    }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 z-50 bg-[#0a0a0a] border border-white/20 rounded-lg p-2 shadow-xl min-w-[120px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-3 gap-1">
                      {monthNames.map((month, index) => (
                        <button
                          key={index}
                          onClick={() => handleMonthSelect(index)}
                          className={cn(
                            'px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors text-left',
                            selectedMonth === index
                              ? 'bg-orange-500/20 text-orange-500'
                              : 'text-[#d7d2cb]/70 hover:text-[#d7d2cb]'
                          )}
                        >
                          {shortMonthNames[index]}
                        </button>
                      ))}
                    </div>
                    
                    {/* Year Selector Toggle */}
                    <div className="mt-2 pt-2 border-t border-white/10 relative">
                      <button
                        onClick={() => {
                          setShowYearSelector(!showYearSelector)
                        }}
                        className="w-full px-2 py-1 rounded hover:bg-white/10 transition-colors text-xs text-[#d7d2cb]/70 hover:text-[#d7d2cb] flex items-center justify-between"
                      >
                        <span>{selectedYear}</span>
                        <ChevronDown className={cn('w-3 h-3 transition-transform', showYearSelector && 'rotate-180')} />
                      </button>
                      
                      {/* Year Selector */}
                      <AnimatePresence>
                        {showYearSelector && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="absolute left-full ml-2 top-0 z-50 bg-[#0a0a0a] border border-white/20 rounded-lg p-2 shadow-xl"
                            style={{ maxHeight: '200px', overflowY: 'auto' }}
                          >
                            <div className="flex flex-col gap-1">
                              {yearOptions.map((year) => (
                                <button
                                  key={year}
                                  onClick={() => handleYearSelect(year)}
                                  className={cn(
                                    'px-3 py-1 text-sm rounded hover:bg-white/10 transition-colors text-left min-w-[80px]',
                                    selectedYear === year
                                      ? 'bg-orange-500/20 text-orange-500'
                                      : 'text-[#d7d2cb]/70 hover:text-[#d7d2cb]'
                                  )}
                                >
                                  {year}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => navigateMonth('next')}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-[#d7d2cb]/70" />
          </button>
        </div>
      </div>

      {/* Calendar Grid with Y-axis Labels */}
      <div className="flex justify-center">
        <div className="flex gap-2">
          {/* Y-axis (day numbers) */}
          <div className="flex flex-col gap-1 pt-6">
            {weeksData.map((week, weekIndex) => {
              // Get the day numbers for this week (filter out empty days)
              const dayNumbers = week
                .map(day => day.dayNumber)
                .filter(num => num > 0)
              
              if (dayNumbers.length === 0) {
                return <div key={`week-${weekIndex}`} className="h-12" />
              }
              
              // Format: "1" or "2-8" or "9-15" etc.
              const label = dayNumbers.length === 1 
                ? dayNumbers[0].toString()
                : `${dayNumbers[0]}-${dayNumbers[dayNumbers.length - 1]}`
              
              return (
                <div
                  key={`week-${weekIndex}`}
                  className="text-xs text-[#d7d2cb]/60 text-right pr-2 h-12 flex items-center justify-end"
                >
                  {label}
                </div>
              )
            })}
          </div>

          {/* Main Calendar Grid */}
          <div>
            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-xs text-[#d7d2cb]/50 text-center w-12">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 overflow-hidden">
              {monthData.map((day, dayIndex) => {
                if (!day.date) {
                  return <div key={`empty-${dayIndex}`} className="w-12 h-12" />
                }

                return (
                  <div key={day.date} className="relative w-12 h-12 overflow-hidden">
                    <motion.div
                      className={cn(
                        'w-12 h-12 rounded-sm cursor-pointer transition-all',
                        getColor(day.count),
                        hoveredDate === day.date && 'ring-1 ring-white/50'
                      )}
                      onMouseEnter={(e) => handleDayHover(e, day.date)}
                      onMouseLeave={() => {
                        setHoveredDate(null)
                        setTooltipPosition(null)
                      }}
                      onClick={() => handleDayClick(day.date)}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                      style={{ transformOrigin: 'center' }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-2 text-xs text-[#d7d2cb]/60">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-800/50" />
          <div className="w-3 h-3 rounded-sm bg-green-500/40" />
          <div className="w-3 h-3 rounded-sm bg-green-500/60" />
          <div className="w-3 h-3 rounded-sm bg-green-500" />
        </div>
        <span>More</span>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredDate && hoveredData && tooltipPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute z-[100] bg-[#0a0a0a] border border-white/20 rounded-lg p-3 shadow-xl pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y - 10}px`,
              transform: 'translate(-50%, -100%)',
              maxWidth: '200px'
            }}
          >
            <div className="text-sm font-semibold text-[#d7d2cb] mb-1">
              {new Date(hoveredDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div className="text-xs text-[#d7d2cb]/70">
              {hoveredData.count} {hoveredData.count === 1 ? 'task' : 'tasks'} completed
            </div>
            {hoveredData.tasks && hoveredData.tasks.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="text-xs text-[#d7d2cb]/60 max-h-32 overflow-y-auto">
                  {hoveredData.tasks.slice(0, 5).map((task, i) => (
                    <div key={i} className="truncate">• {task}</div>
                  ))}
                  {hoveredData.tasks.length > 5 && (
                    <div className="text-[#d7d2cb]/40">+{hoveredData.tasks.length - 5} more</div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
