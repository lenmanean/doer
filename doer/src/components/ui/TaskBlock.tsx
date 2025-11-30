'use client'

import { motion } from 'framer-motion'
import { Check, RefreshCw, Calendar, Link2, Lock, Trash2 } from 'lucide-react'
import { formatDuration } from '@/lib/task-time-utils'
import { useState } from 'react'

function getPriorityColors(priority?: number, completed: boolean = false) {
  if (completed) {
    return {
      background: 'bg-green-500/20',
      border: 'border-green-500/50',
      text: 'text-green-300',
      solidBackground: 'rgb(34, 197, 94)'
    }
  }

  switch (priority) {
    case 1:
      return {
        background: 'bg-red-500/20',
        border: 'border-red-500/50',
        text: 'text-red-300',
        solidBackground: 'rgb(239, 68, 68)'
      }
    case 2:
      return {
        background: 'bg-orange-500/20',
        border: 'border-orange-500/50',
        text: 'text-orange-300',
        solidBackground: 'rgb(249, 115, 22)'
      }
    case 3:
      return {
        background: 'bg-yellow-500/20',
        border: 'border-yellow-500/50',
        text: 'text-yellow-300',
        solidBackground: 'rgb(234, 179, 8)'
      }
    case 4:
      return {
        background: 'bg-blue-500/20',
        border: 'border-blue-500/50',
        text: 'text-blue-300',
        solidBackground: 'rgb(59, 130, 246)'
      }
    default:
      return {
        background: 'bg-gray-500/20',
        border: 'border-gray-500/50',
        text: 'text-gray-300',
        solidBackground: 'rgb(107, 114, 128)'
      }
  }
}

interface TaskBlockProps {
  task: {
    schedule_id: string
    task_id: string
    name: string
    details?: string
    duration_minutes: number | null
    completed: boolean
    priority?: number | null
    is_recurring?: boolean
    status?: string
    reschedule_count?: number
    reschedule_reason?: any
    start_time?: string | null
    end_time?: string | null
    date?: string
    is_calendar_event?: boolean
    is_detached?: boolean
    is_deleted_in_calendar?: boolean
  }
  topPosition: number
  height: number
  theme: 'dark' | 'light'
  onDragStart: () => void
  onDragEnd: (newStartTime: string, offset: number) => void
  onClick: () => void
  onComplete: () => void
  style?: React.CSSProperties
  isInsideMultiPanel?: boolean
  currentTime?: Date
}

export function TaskBlock({ 
  task, 
  topPosition, 
  height, 
  onClick, 
  onComplete,
  style = {},
  isInsideMultiPanel = false,
  currentTime = new Date()
}: TaskBlockProps) {
  const colors = getPriorityColors(task.priority ?? undefined, task.completed)
  const [isHovered, setIsHovered] = useState(false)
  
  const isOverdue = !task.completed && (
    task.status === 'overdue' || 
    (task.end_time && task.date && (() => {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      
      // If task is scheduled for a past date, it's overdue
      if (task.date < todayStr) return true
      
      // If task is scheduled for today, check if end_time has passed
      if (task.date === todayStr) {
        const [endHour, endMinute] = task.end_time.split(':').map(Number)
        const endTime = new Date()
        endTime.setHours(endHour, endMinute, 0, 0)
        return currentTime > endTime
      }
      
      return false
    })())
  )
  
  const hasPendingReschedule = task.status === 'pending_reschedule'
  const isRejectedOverdue = isOverdue && !hasPendingReschedule && !task.completed
  const isRescheduled = task.status === 'rescheduled' || (task.reschedule_count !== undefined && task.reschedule_count !== null && task.reschedule_count > 0)
  
  const overdueColors = {
    background: 'bg-orange-500/30',
    border: 'border-orange-500',
    text: 'text-orange-200',
    solidBackground: 'rgb(249, 115, 22)'
  }
  
  const rejectedOverdueColors = {
    background: 'bg-gray-500/15',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    solidBackground: 'rgb(107, 114, 128)'
  }
  
  // Don't change task colors when overdue - only show badge
  // Colors only change when user rejects the reschedule (isRejectedOverdue)
  const displayColors = isRejectedOverdue 
    ? rejectedOverdueColors 
    : colors
  
  // Get task name - ensure it's a string, never render numbers
  const taskNameString = task.name ? String(task.name) : ''
  
  // Calendar events are read-only (not detached)
  const isReadOnly = task.is_calendar_event && !task.is_detached
  const isDeleted = task.is_deleted_in_calendar === true
  
  // Deleted events get special styling
  const deletedColors = {
    background: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    text: 'text-gray-400',
    solidBackground: 'rgb(75, 85, 99)'
  }
  
  const finalColors = isDeleted ? deletedColors : displayColors
  
  return (
    <motion.div
      className={`${isInsideMultiPanel ? 'relative' : 'absolute'} rounded-lg p-2 ${isReadOnly || isDeleted ? 'cursor-not-allowed' : 'cursor-pointer'} select-none ${finalColors.background} ${finalColors.border} border-2 ${isReadOnly || isDeleted ? '' : 'hover:shadow-lg'} transition-all duration-200 ${
        isRejectedOverdue 
          ? 'opacity-60 ring-1 ring-gray-500/30' 
          : ''
      } ${
        isReadOnly
          ? 'ring-1 ring-blue-400/30 opacity-90'
          : ''
      } ${
        isDeleted
          ? 'opacity-50 ring-1 ring-gray-500/20'
          : ''
      }`}
      style={{ 
        ...(isInsideMultiPanel ? {} : { top: `${topPosition}px` }), 
        height: isHovered ? 'auto' : `${Math.max(height, 40)}px`,
        minHeight: `${Math.max(height, 40)}px`,
        zIndex: isHovered ? 30 : 5,
        opacity: isDeleted ? 0.5 : (isHovered ? 1 : 0.9),
        backgroundColor: isHovered && !isReadOnly && !isDeleted ? finalColors.solidBackground : undefined,
        ...style
      }}
      onClick={isReadOnly || isDeleted ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={isReadOnly || isDeleted ? {} : { scale: 1.05, zIndex: 30 }}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between gap-2 min-h-full">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start gap-1.5 flex-nowrap">
            <span className={`text-xs font-medium ${finalColors.text} truncate flex-1 min-w-0`} title={taskNameString}>
              {taskNameString}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isDeleted ? (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 bg-gray-500/20 text-gray-400 border border-gray-500/30" title="Deleted in Google Calendar">
                  <Trash2 className="w-2.5 h-2.5" />
                </span>
              ) : task.is_calendar_event === true ? (
                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${
                  task.is_detached
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                    : 'bg-blue-500/30 text-blue-200 border border-blue-400/50'
                }`} title={task.is_detached ? "Calendar event (detached)" : "Calendar event (read-only)"}>
                  <Calendar className="w-2.5 h-2.5" />
                  {isReadOnly && <Lock className="w-2 h-2 ml-0.5" />}
                  {task.is_detached && <Link2 className="w-2 h-2 ml-0.5" />}
                </span>
              ) : null}
              {task.is_recurring === true ? (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 bg-white/5 border border-white/20 text-[#d7d2cb]/80" title="Recurring task">
                  <RefreshCw className="w-2.5 h-2.5" />
                </span>
              ) : null}
              {isOverdue === true && !task.completed ? (
                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${
                  isRejectedOverdue
                    ? 'bg-gray-500/40 text-gray-300 border border-gray-400/50'
                    : 'bg-orange-500/40 text-orange-200 border border-orange-400/50'
                }`} title="Overdue task">
                  ⚠ {isRejectedOverdue ? 'Overdue' : ''}
                </span>
              ) : null}
            </div>
          </div>
          {task.duration_minutes !== null && task.duration_minutes !== undefined && task.duration_minutes > 0 ? (
            <div 
              className={`text-xs mt-1 ${displayColors.text} transition-opacity duration-200`}
              style={{ opacity: isHovered ? 0.8 : 0 }}
            >
              {formatDuration(task.duration_minutes)}
            </div>
          ) : null}
          {task.details && task.details.trim() !== '' ? (
            <div
              className={`mt-1 text-[11px] leading-snug ${displayColors.text} transition-all duration-200`}
              style={{
                opacity: isHovered ? 0.95 : 0,
                maxHeight: isHovered ? 200 : 0,
                overflow: 'hidden'
              }}
            >
              {task.details}
            </div>
          ) : null}
          {isRescheduled === true && task.reschedule_count !== undefined && task.reschedule_count !== null && task.reschedule_count > 0 ? (
            <div
              className={`mt-1.5 text-[11px] leading-snug ${displayColors.text} transition-all duration-200 italic`}
              style={{
                opacity: isHovered ? 0.85 : 0,
                maxHeight: isHovered ? 50 : 0,
                overflow: 'hidden'
              }}
            >
              {task.reschedule_count === 1 
                ? 'Rescheduled once' 
                : `Rescheduled ${task.reschedule_count} times`}
            </div>
          ) : null}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!isReadOnly) {
            onComplete()
            }
          }}
          disabled={isReadOnly}
          className={`flex-shrink-0 p-1 rounded transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{
            backgroundColor: isHovered && !isReadOnly ? 'rgba(255,255,255,0.08)' : 'transparent'
          }}
          title={isReadOnly ? 'Calendar events are read-only' : (task.completed ? 'Mark incomplete' : 'Mark complete')}
          aria-label={isReadOnly ? 'Calendar event is read-only' : (task.completed ? 'Mark task incomplete' : 'Mark task complete')}
        >
          {task.completed ? (
            <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center shadow">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : (
            <div
              className={`w-4 h-4 border-2 rounded ${displayColors.border}`}
              style={{
                borderColor: isHovered ? 'rgba(255,255,255,0.9)' : undefined
              }}
            />
          )}
        </button>
      </div>
    </motion.div>
  )
}
