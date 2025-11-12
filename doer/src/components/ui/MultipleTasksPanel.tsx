'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Clock, Users } from 'lucide-react'
import { useState } from 'react'
import { TaskBlock } from './TaskBlock'
import { formatDuration } from '@/lib/task-time-utils'

interface OverlapGroup {
  tasks: any[]
  startTime: string
  endTime: string
  totalDuration: number
}

interface MultipleTasksPanelProps {
  overlapGroup: OverlapGroup
  topPosition: number
  height: number
  theme: 'dark' | 'light'
  onTaskClick: (task: any) => void
  onTaskComplete: (task: any) => void
  isExpanded: boolean
  onToggleExpanded: () => void
  style?: React.CSSProperties
  currentTime?: Date
}

export function MultipleTasksPanel({
  overlapGroup,
  topPosition,
  height,
  theme,
  onTaskClick,
  onTaskComplete,
  isExpanded,
  onToggleExpanded,
  style = {}
}: MultipleTasksPanelProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  const { tasks, startTime, endTime, totalDuration } = overlapGroup
  
  // Debug logging
  console.log('MultipleTasksPanel tasks:', tasks.map(t => ({ name: t.name, start_time: t.start_time, end_time: t.end_time })))
  
  // Format time range for display
  const formatTimeRange = (start: string, end: string) => {
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours)
      const min = parseInt(minutes)
      return `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:${min.toString().padStart(2, '0')}${hour >= 12 ? 'PM' : 'AM'}`
    }
    return `${formatTime(start)} - ${formatTime(end)}`
  }

  return (
    <motion.div
      className={`absolute rounded-lg border-2 cursor-pointer select-none transition-all duration-200 ${
        theme === 'dark'
          ? isExpanded 
            ? 'bg-gray-700/95 border-gray-500/60 hover:bg-gray-700/95 hover:border-gray-500/80'
            : 'bg-gray-700/20 border-gray-500/40 hover:bg-gray-700/30 hover:border-gray-500/60'
          : isExpanded
            ? 'bg-gray-600/95 border-gray-500/60 hover:bg-gray-600/95 hover:border-gray-500/80'
            : 'bg-gray-600/20 border-gray-500/40 hover:bg-gray-600/30 hover:border-gray-500/60'
      }`}
      style={{ 
        top: `${topPosition}px`, 
        height: isExpanded ? 'auto' : `${Math.max(height, 40)}px`,
        minHeight: `${Math.max(height, 40)}px`,
        zIndex: isExpanded ? 40 : (isHovered ? 20 : 10),
        opacity: isExpanded ? 1 : 0.95,
        ...style
      }}
      onClick={onToggleExpanded}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ 
        scale: 1.02,
        zIndex: 20
      }}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: 0.95, 
        scale: 1,
        height: isExpanded ? 'auto' : `${Math.max(height, 40)}px`
      }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col overflow-hidden">
        {/* Collapsed Header */}
        <div className="flex items-center justify-between p-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-300">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className={`flex items-center gap-1 text-xs text-gray-400 transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}>
              <Clock className="w-3 h-3" />
              <span>{formatTimeRange(startTime, endTime)}</span>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            <span className="text-xs text-gray-400">
              {formatDuration(totalDuration)}
            </span>
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </motion.div>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="border-t border-gray-500/20 bg-gray-800/10"
              initial={{ opacity: 0, maxHeight: 0 }}
              animate={{ opacity: 1, maxHeight: 300 }}
              exit={{ opacity: 0, maxHeight: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="p-2 space-y-1 overflow-y-auto">
                {tasks.map((task, index) => (
                  <motion.div
                    key={task.schedule_id}
                    className={`rounded-md border transition-all duration-200 ${
                      theme === 'dark'
                        ? 'bg-gray-700/30 border-gray-500/30 hover:bg-gray-700/50 hover:border-gray-500/50'
                        : 'bg-gray-600/30 border-gray-500/30 hover:bg-gray-600/50 hover:border-gray-500/50'
                    }`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskClick(task)
                    }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-200 truncate">
                            {(() => {
                              const name = task.name || ''
                              if (!name) return ''
                              
                              let cleaned = name.trim()
                              
                              // Pattern 1: Remove space(s) followed by a single digit (0-4) at the end
                              cleaned = cleaned.replace(/\s+[0-4]\s*$/, '')
                              
                              // Pattern 2: Remove a single digit (0-4) directly at the end (no space)
                              if (cleaned.length > 0) {
                                const lastChar = cleaned[cleaned.length - 1]
                                if (['0', '1', '2', '3', '4'].includes(lastChar)) {
                                  const beforeLast = cleaned.slice(0, -1)
                                  if (beforeLast.length > 0 && /[a-zA-Z\s]/.test(beforeLast[beforeLast.length - 1])) {
                                    cleaned = beforeLast.trim()
                                  } else if (cleaned.length > 1) {
                                    cleaned = beforeLast.trim()
                                  }
                                }
                              }
                              
                              // Pattern 3: Final cleanup - remove any trailing digits 0-4
                              cleaned = cleaned.replace(/[\s]*[0-4][\s]*$/, '')
                              
                              return cleaned.trim()
                            })()}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatTimeRange(task.start_time, task.end_time)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {formatDuration(task.duration_minutes || 60)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onTaskComplete(task)
                            }}
                            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {task.completed ? (
                              <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            ) : (
                              <div className="w-4 h-4 border-2 border-gray-400 rounded" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
