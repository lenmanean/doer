'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

  // Generate last 12 months of dates
  const months = useMemo(() => {
    const today = new Date()
    const months: Array<{ month: string; year: number; days: Array<{ date: string; count: number; tasks?: string[] }> }> = []
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('en-US', { month: 'short' })
      const year = date.getFullYear()
      
      // Get first day of month and day of week (0 = Sunday)
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
      const firstDayOfWeek = firstDay.getDay()
      
      // Get number of days in month
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      const daysInMonth = lastDay.getDate()
      
      const days: Array<{ date: string; count: number; tasks?: string[] }> = []
      
      // Add empty cells for days before month starts
      for (let j = 0; j < firstDayOfWeek; j++) {
        days.push({ date: '', count: 0 })
      }
      
      // Add days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dayData = data.find(d => d.date === dateStr)
        days.push({
          date: dateStr,
          count: dayData?.count || 0,
          tasks: dayData?.tasks
        })
      }
      
      months.push({ month: monthName, year, days })
    }
    
    return months
  }, [data])

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-gray-800/50'
    if (count >= 1 && count <= 2) return 'bg-green-500/40'
    if (count >= 3 && count <= 4) return 'bg-green-500/60'
    return 'bg-green-500'
  }

  const handleDayHover = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if (!date) return
    setHoveredDate(date)
    setTooltipPosition({ x: e.clientX, y: e.clientY })
  }

  const handleDayClick = (date: string) => {
    if (!date || !onDayClick) return
    onDayClick(date)
  }

  const hoveredData = hoveredDate ? data.find(d => d.date === hoveredDate) : null

  return (
    <div className={cn('relative', className)}>
      <div className="space-y-4">
        {months.map((month, monthIndex) => (
          <div key={`${month.year}-${month.month}`} className="flex items-start gap-2">
            <div className="w-12 text-xs text-[#d7d2cb]/60 text-right pt-1">
              {month.month}
            </div>
            <div className="flex-1 grid grid-cols-7 gap-1">
              {month.days.map((day, dayIndex) => {
                if (!day.date) {
                  return <div key={`empty-${dayIndex}`} className="w-3 h-3" />
                }
                
                return (
                  <motion.div
                    key={day.date}
                    className={cn(
                      'w-3 h-3 rounded-sm cursor-pointer transition-all',
                      getColor(day.count),
                      hoveredDate === day.date && 'ring-2 ring-white/50 scale-110'
                    )}
                    onMouseEnter={(e) => handleDayHover(e, day.date)}
                    onMouseLeave={() => {
                      setHoveredDate(null)
                      setTooltipPosition(null)
                    }}
                    onClick={() => handleDayClick(day.date)}
                    whileHover={{ scale: 1.2 }}
                    transition={{ duration: 0.2 }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 text-xs text-[#d7d2cb]/60">
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
            className="fixed z-50 bg-[#0a0a0a] border border-white/20 rounded-lg p-3 shadow-xl pointer-events-none"
            style={{
              left: `${tooltipPosition.x + 10}px`,
              top: `${tooltipPosition.y - 10}px`,
              transform: 'translateY(-100%)'
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

