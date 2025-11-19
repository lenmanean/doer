'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
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
  const gridWrapperRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const squareRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const motionSquareRefs = useRef<Map<string, HTMLDivElement>>(new Map())

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
    const lastDayOfWeek = lastDay.getDay()

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

    // Add empty cells for days after month ends to complete the last week
    const daysAfterMonth = 6 - lastDayOfWeek
    for (let j = 0; j < daysAfterMonth; j++) {
      days.push({ date: '', count: 0 })
    }

    return days
  }, [data, selectedMonth, selectedYear])

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-gray-800/50'
    if (count >= 1 && count <= 2) return 'bg-green-500/40'
    if (count >= 3 && count <= 4) return 'bg-green-500/60'
    return 'bg-green-500'
  }

  const handleDayHover = (date: string) => {
    if (!date) return
    setHoveredDate(date)
    
    // Get the square container
    const squareContainer = squareRefs.current.get(date)
    
    if (!squareContainer || !containerRef.current) return
    
    // Calculate position
    const containerRect = containerRef.current.getBoundingClientRect()
    const squareRect = squareContainer.getBoundingClientRect()
    
    // Calculate the exact center X of the square in viewport coordinates
    const squareCenterX = squareRect.left + (squareRect.width / 2)
    const squareTopY = squareRect.top
    
    // Convert to container-relative coordinates
    // The container has position: relative, so tooltip is positioned relative to it
    const x = squareCenterX - containerRect.left
    const y = squareTopY - containerRect.top
    
    setTooltipPosition({ x, y })
  }

  // Recalculate tooltip position after it renders to ensure proper centering
  useEffect(() => {
    if (!tooltipRef.current || !tooltipPosition || !hoveredDate) return
    
    const tooltip = tooltipRef.current
    const squareContainer = squareRefs.current.get(hoveredDate)
    const container = containerRef.current
    
    if (!tooltip || !squareContainer || !container) return
    
    // Use requestAnimationFrame to ensure tooltip is fully rendered
    requestAnimationFrame(() => {
      if (!tooltip || !squareContainer || !container) return
      
      const containerRect = container.getBoundingClientRect()
      const squareRect = squareContainer.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      
      // Calculate the exact center X of the square
      const squareCenterX = squareRect.left + (squareRect.width / 2)
      const squareTopY = squareRect.top
      
      // Convert to container-relative coordinates
      const x = squareCenterX - containerRect.left
      const y = squareTopY - containerRect.top
      
      // Only update if position has changed (avoid infinite loop)
      if (Math.abs(tooltipPosition.x - x) > 0.1 || Math.abs(tooltipPosition.y - y) > 0.1) {
        setTooltipPosition({ x, y })
      }
    })
  }, [hoveredDate, tooltipPosition])

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

  const handleTodayClick = () => {
    const today = new Date()
    setSelectedMonth(today.getMonth())
    setSelectedYear(today.getFullYear())
    setShowMonthSelector(false)
    setShowYearSelector(false)
  }

  // Generate year options (current year ± 5 years)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

  const hoveredData = hoveredDate ? data.find(d => d.date === hoveredDate) : null

  return (
    <div ref={containerRef} data-heatmap-container className={cn('relative overflow-visible', className)}>
      {/* Month/Year Navigation */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded hover:bg-white/10 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-8 h-8 text-[#d7d2cb]/70" />
          </button>
          
          {/* Today Button */}
          <button
            onClick={handleTodayClick}
            className="px-4 py-2 rounded hover:bg-white/10 transition-colors text-[#d7d2cb]/70 text-sm font-medium"
            aria-label="Go to today"
          >
            Today
          </button>
          
          {/* Month Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMonthSelector(!showMonthSelector)
                setShowYearSelector(false)
              }}
              className={cn(
                'px-12 py-6 rounded hover:bg-white/10 transition-colors text-[#d7d2cb] font-medium text-2xl',
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
                    className="absolute top-full left-0 mt-2 z-50 bg-[#0a0a0a] border border-white/20 rounded-lg p-4 shadow-xl min-w-[240px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {monthNames.map((month, index) => (
                        <button
                          key={index}
                          onClick={() => handleMonthSelect(index)}
                          className={cn(
                            'px-4 py-2 text-sm rounded hover:bg-white/10 transition-colors text-left',
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
                    <div className="mt-4 pt-4 border-t border-white/10 relative">
                      <button
                        onClick={() => {
                          setShowYearSelector(!showYearSelector)
                        }}
                        className="w-full px-4 py-2 rounded hover:bg-white/10 transition-colors text-sm text-[#d7d2cb]/70 hover:text-[#d7d2cb] flex items-center justify-between"
                      >
                        <span>{selectedYear}</span>
                        <ChevronDown className={cn('w-4 h-4 transition-transform', showYearSelector && 'rotate-180')} />
                      </button>
                      
                      {/* Year Selector */}
                      <AnimatePresence>
                        {showYearSelector && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="absolute left-full ml-2 top-0 z-50 bg-[#0a0a0a] border border-white/20 rounded-lg p-4 shadow-xl"
                            style={{ maxHeight: '200px', overflowY: 'auto' }}
                          >
                            <div className="flex flex-col gap-2">
                              {yearOptions.map((year) => (
                                <button
                                  key={year}
                                  onClick={() => handleYearSelect(year)}
                                  className={cn(
                                    'px-6 py-2 text-base rounded hover:bg-white/10 transition-colors text-left min-w-[160px]',
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
            className="p-2 rounded hover:bg-white/10 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-8 h-8 text-[#d7d2cb]/70" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div ref={gridWrapperRef} className="w-full px-2">
        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-sm text-[#d7d2cb]/50 text-center">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div ref={gridRef} className="grid grid-cols-7 gap-1.5 overflow-visible">
          {monthData.map((day, dayIndex) => {
            if (!day.date) {
              return (
                <div 
                  key={`empty-${dayIndex}`} 
                  className="aspect-square border border-white/5 rounded-sm"
                />
              )
            }

            return (
              <div 
                key={day.date} 
                ref={(el) => {
                  if (el) squareRefs.current.set(day.date, el)
                  else squareRefs.current.delete(day.date)
                }}
                className="relative aspect-square overflow-visible p-0.5"
                onMouseEnter={() => handleDayHover(day.date)}
                onMouseLeave={() => {
                  setHoveredDate(null)
                  setTooltipPosition(null)
                }}
              >
                <motion.div
                  ref={(el) => {
                    if (el) motionSquareRefs.current.set(day.date, el)
                    else motionSquareRefs.current.delete(day.date)
                  }}
                  className={cn(
                    'w-full h-full rounded-sm cursor-pointer transition-all',
                    getColor(day.count),
                    hoveredDate === day.date && 'ring-2 ring-white/70 shadow-lg shadow-white/20'
                  )}
                  onClick={() => handleDayClick(day.date)}
                  whileHover={{ scale: 1.05, zIndex: 10 }}
                  transition={{ duration: 0.2 }}
                  style={{ transformOrigin: 'center' }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3 text-xs text-[#d7d2cb]/60">
        <span className="font-medium">No activity</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-800/50" />
          <div className="w-3 h-3 rounded-sm bg-green-500/40" />
          <div className="w-3 h-3 rounded-sm bg-green-500/60" />
          <div className="w-3 h-3 rounded-sm bg-green-500" />
        </div>
        <span className="font-medium">High activity</span>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredDate && hoveredData && tooltipPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            ref={tooltipRef}
            className="absolute z-[100] bg-[#0a0a0a] border border-white/20 rounded-lg p-3 shadow-xl pointer-events-none whitespace-nowrap"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, calc(-100% - 8px))',
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
