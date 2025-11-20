'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityHeatmapNavigationProps {
  selectedMonth: number
  selectedYear: number
  onMonthChange: (month: number) => void
  onYearChange: (year: number) => void
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const shortMonthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export function ActivityHeatmapNavigation({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange
}: ActivityHeatmapNavigationProps) {
  const [showMonthSelector, setShowMonthSelector] = useState(false)
  const [showYearSelector, setShowYearSelector] = useState(false)

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        onMonthChange(11)
        onYearChange(selectedYear - 1)
      } else {
        onMonthChange(selectedMonth - 1)
      }
    } else {
      if (selectedMonth === 11) {
        onMonthChange(0)
        onYearChange(selectedYear + 1)
      } else {
        onMonthChange(selectedMonth + 1)
      }
    }
  }

  const handleMonthSelect = (monthIndex: number) => {
    onMonthChange(monthIndex)
    setShowMonthSelector(false)
  }

  const handleYearSelect = (year: number) => {
    onYearChange(year)
    setShowYearSelector(false)
  }

  const handleTodayClick = () => {
    const today = new Date()
    onMonthChange(today.getMonth())
    onYearChange(today.getFullYear())
    setShowMonthSelector(false)
    setShowYearSelector(false)
  }

  // Generate year options (current year ± 5 years)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => navigateMonth('prev')}
        className="p-2 rounded hover:bg-white/10 transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-8 h-8 text-[#d7d2cb]/70" />
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
      
      {/* Today Button */}
      <button
        onClick={handleTodayClick}
        className="px-4 py-2 rounded hover:bg-white/10 transition-colors text-[#d7d2cb]/70 text-sm font-medium"
        aria-label="Go to today"
      >
        Today
      </button>
    </div>
  )
}

