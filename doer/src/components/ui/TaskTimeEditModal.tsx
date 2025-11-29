'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, AlertCircle, Trash2, Edit3, Check, X as XIcon, RefreshCw, Calendar, Link2, Lock } from 'lucide-react'
import { calculateDuration, isValidTimeFormat, formatDuration } from '@/lib/task-time-utils'
import { convertUrlsToLinks } from '@/lib/url-utils'
import { TimePicker } from './TimePicker'

const getPriorityLabel = (priority?: number | null) => {
  switch (priority) {
    case 1:
      return 'Critical'
    case 2:
      return 'High'
    case 3:
      return 'Medium'
    case 4:
      return 'Low'
    default:
      return null
  }
}

const getPriorityBadgeClasses = (priority: number | null | undefined, theme: 'dark' | 'light') => {
  if (priority == null) {
    return ''
  }

  const darkThemeMap: Record<number, string> = {
    1: 'bg-red-500/20 text-red-300 border-red-500/40',
    2: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    3: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    4: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
  }

  const lightThemeMap: Record<number, string> = {
    1: 'bg-red-100 text-red-700 border-red-200',
    2: 'bg-orange-100 text-orange-700 border-orange-200',
    3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    4: 'bg-blue-100 text-blue-700 border-blue-200'
  }

  return theme === 'dark'
    ? (darkThemeMap[priority] || 'bg-white/10 text-[#d7d2cb] border-white/20')
    : (lightThemeMap[priority] || 'bg-gray-100 text-gray-700 border-gray-200')
}

interface TaskTimeEditModalProps {
  task: {
    schedule_id: string
    task_id: string
    name: string
    details?: string
    start_time: string | null
    end_time: string | null
    duration_minutes: number | null
    is_recurring?: boolean
    is_indefinite?: boolean
    recurrence_days?: number[]
    recurrence_start_date?: string
    recurrence_end_date?: string
    date?: string
    status?: string
    completed?: boolean
    plan_id?: string | null
    priority?: number | null
    is_calendar_event?: boolean
    is_detached?: boolean
  } | null
  isOpen: boolean
  onClose: () => void
  onSave: (scheduleId: string, startTime: string, endTime: string, recurrenceData?: { isRecurring: boolean; isIndefinite: boolean; recurrenceDays: number[]; recurrenceStartDate?: string; recurrenceEndDate?: string }) => Promise<{ success: boolean; error?: string }>
  onDelete: (task: any) => Promise<void>
  theme: 'dark' | 'light'
}

export function TaskTimeEditModal({ task, isOpen, onClose, onSave, onDelete, theme }: TaskTimeEditModalProps) {
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Recurring task state
  const [isRecurring, setIsRecurring] = useState(false)
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([])
  const [recurrenceStartDate, setRecurrenceStartDate] = useState('')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  
  // Edit state for name and description
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [isRescheduling, setIsRescheduling] = useState(false)

  // Initialize times when task changes
  useEffect(() => {
    if (task) {
      // Convert HH:MM:SS format to HH:MM format
      const formatTime = (time: string | null) => {
        if (!time) return ''
        // If time includes seconds, remove them
        if (time.includes(':') && time.split(':').length === 3) {
          return time.substring(0, 5) // Take only HH:MM part
        }
        return time
      }
      
      const formattedStartTime = formatTime(task.start_time)
      const formattedEndTime = formatTime(task.end_time)
      
      
      setStartTime(formattedStartTime)
      setEndTime(formattedEndTime)
      setError(null)
      
      // Initialize recurring task state
      setIsRecurring(task.is_recurring || false)
      setIsIndefinite(task.is_indefinite || false)
      setRecurrenceDays(task.recurrence_days || [])
      setRecurrenceStartDate(task.recurrence_start_date || '')
      setRecurrenceEndDate(task.recurrence_end_date || '')
      
      // Initialize edit state
      setEditedName(task.name || '')
      setEditedDescription(task.details || '')
      setIsEditingName(false)
      setIsEditingDescription(false)
    }
  }, [task])

  // Calculate duration in real-time
  const calculatedDuration = startTime && endTime && isValidTimeFormat(startTime) && isValidTimeFormat(endTime)
    ? calculateDuration(startTime, endTime)
    : 0


  // Handle day toggle for recurrence
  const handleDayToggle = (day: number) => {
    setRecurrenceDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  // Handle name edit
  const handleNameEdit = () => {
    setIsEditingName(true)
  }

  const handleNameSave = () => {
    setIsEditingName(false)
    // Here you would typically save the name to the backend
    // For now, we'll just update the local state
  }

  const handleNameCancel = () => {
    setEditedName(task?.name || '')
    setIsEditingName(false)
  }

  // Handle description edit
  const handleDescriptionEdit = () => {
    setIsEditingDescription(true)
  }

  const handleDescriptionSave = () => {
    setIsEditingDescription(false)
    // Here you would typically save the description to the backend
    // For now, we'll just update the local state
  }

  const handleDescriptionCancel = () => {
    setEditedDescription(task?.details || '')
    setIsEditingDescription(false)
  }

  const handleSave = async () => {
    if (!task) return

    // Validate
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      setError('Invalid time format. Use HH:MM (e.g., 09:30)')
      return
    }

    if (calculatedDuration <= 0) {
      setError('End time must be after start time')
      return
    }

    // Check if this is a synthetic task (indefinite recurring)
    const isSynthetic = task.schedule_id?.startsWith('synthetic-')
    
    // For synthetic recurring tasks, only allow updating recurrence settings, not time
    if (isSynthetic && isRecurring && !isIndefinite) {
      setError('Cannot edit time for synthetic recurring tasks. Only recurrence days can be updated.')
      return
    }
    
    // For synthetic indefinite recurring tasks, allow updating recurrence days and default times
    if (isSynthetic && isRecurring && isIndefinite) {
      // Allow the save to proceed - it will update the task's recurrence_days and default times
    }

    setSaving(true)
    setError(null)

    const result = await onSave(task.schedule_id, startTime, endTime, isRecurring ? {
      isRecurring,
      isIndefinite,
      recurrenceDays,
      recurrenceStartDate,
      recurrenceEndDate
    } : undefined)

    setSaving(false)

    if (result.success) {
      onClose()
    } else {
      setError(result.error || 'Failed to save')
    }
  }

  const handleDelete = async () => {
    if (!task) return
    
    setSaving(true)
    try {
      await onDelete(task)
      onClose()
    } catch (error) {
      setError('Failed to delete task')
    } finally {
      setSaving(false)
    }
  }

  if (!task) return null

  // Calendar events are read-only (not detached)
  const isReadOnly = task.is_calendar_event && !task.is_detached

  const priorityLabel = getPriorityLabel(task.priority ?? null)
  const priorityBadgeClass = priorityLabel ? getPriorityBadgeClasses(task.priority ?? null, theme) : ''

  // Format recurrence days
  const formatRecurrenceDays = (days: number[]) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days.map(day => dayNames[day]).join(', ')
  }

  // Check if task is overdue
  const isOverdue = () => {
    if (!task || task.completed) return false
    
    // Check status
    if (task.status === 'overdue') return true
    
    // Check date and end_time
    if (task.date && task.end_time) {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      
      // If task is scheduled for a past date, it's overdue
      if (task.date < todayStr) return true
      
      // If task is scheduled for today, check if end_time has passed
      if (task.date === todayStr) {
        const [endHour, endMinute] = task.end_time.split(':').map(Number)
        const endTime = new Date()
        endTime.setHours(endHour, endMinute, 0, 0)
        return new Date() > endTime
      }
    }
    
    return false
  }

  // Handle reschedule
  const handleReschedule = async () => {
    if (!task) return
    
    setIsRescheduling(true)
    setError(null)
    
    try {
      const response = await fetch('/api/tasks/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: task.plan_id || null,
          taskId: task.task_id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger reschedule')
      }

      if (data.success && data.results && data.results.length > 0) {
        // Reschedule proposal created successfully
        // The RescheduleApprovalModal will show up automatically
        // Close this modal so the user can see the reschedule proposal
        onClose()
      } else {
        setError('Task is not overdue or could not be rescheduled')
      }
    } catch (error) {
      console.error('Error triggering reschedule:', error)
      setError(error instanceof Error ? error.message : 'Failed to trigger reschedule')
    } finally {
      setIsRescheduling(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`${
              theme === 'dark' 
                ? 'bg-[#0a0a0a]/95 border-white/10' 
                : 'bg-white/95 border-gray-200'
            } border rounded-xl shadow-2xl backdrop-blur-md w-full max-w-md overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <Clock className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-[#ff7f00]' : 'text-orange-600'
                }`} />
                <h2 className={`text-lg font-semibold ${
                  theme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
                }`}>
                  Edit Task
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {priorityLabel && (
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${priorityBadgeClass}`}
                  >
                    {priorityLabel}
                  </div>
                )}
                {/* Recurring Badge */}
                {isRecurring && (
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    theme === 'dark' 
                      ? 'bg-[#ff7f00]/20 text-[#ff7f00] border border-[#ff7f00]/30' 
                      : 'bg-orange-100 text-orange-700 border border-orange-200'
                  }`}>
                    Recurring
                  </div>
                )}
                <button
                  onClick={onClose}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Task Name (editable) */}
              <div>
                <div className="flex items-center gap-2">
                  {isEditingName ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className={`flex-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#ff7f00] ${
                          theme === 'dark'
                            ? 'bg-white/5 border-white/10 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                        autoFocus
                      />
                      <button
                        onClick={handleNameSave}
                        className="p-1 rounded hover:bg-green-500/20 text-green-400"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNameCancel}
                        className="p-1 rounded hover:bg-red-500/20 text-red-400"
                        title="Cancel"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2">
                      <h3 className={`text-xl font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {editedName}
                      </h3>
                      {!isReadOnly && (
                        <button
                          onClick={handleNameEdit}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-300"
                          title="Edit name"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Task Description (editable) */}
              <div>
                <div className="flex items-start gap-2">
                  {isEditingDescription ? (
                    <div className="flex-1 flex items-start gap-2">
                      <textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className={`flex-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#ff7f00] resize-none ${
                          theme === 'dark'
                            ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                            : 'bg-white border-gray-300 text-gray-600'
                        }`}
                        rows={3}
                        placeholder="Enter task description..."
                        autoFocus
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={handleDescriptionSave}
                          className="p-1 rounded hover:bg-green-500/20 text-green-400"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleDescriptionCancel}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400"
                          title="Cancel"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-start gap-2">
                      <div className="flex-1">
                        {editedDescription ? (
                          <p className={`text-sm ${
                            theme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-600'
                          }`}>
                            {convertUrlsToLinks(editedDescription)}
                          </p>
                        ) : (
                          <p className={`text-sm italic ${
                            theme === 'dark' ? 'text-[#d7d2cb]/40' : 'text-gray-400'
                          }`}>
                            No description provided
                          </p>
                        )}
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={handleDescriptionEdit}
                          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-300 flex-shrink-0"
                          title="Edit description"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar Event Read-Only Warning */}
              {isReadOnly && (
                <div className={`p-3 rounded-lg border ${
                  theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <Lock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium mb-1 ${
                        theme === 'dark' ? 'text-blue-300' : 'text-blue-800'
                      }`}>
                        Read-Only Calendar Event
                      </p>
                      <p className={`text-xs ${
                        theme === 'dark' ? 'text-blue-400/80' : 'text-blue-700'
                      }`}>
                        This task is synced from your calendar and is read-only. You cannot edit calendar events in DOER. To make changes, edit the event in your calendar and sync again.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar Event Detached Warning */}
              {task.is_calendar_event && task.is_detached && (
                <div className={`p-3 rounded-lg border ${
                  theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <Calendar className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium mb-1 ${
                        theme === 'dark' ? 'text-blue-300' : 'text-blue-800'
                      }`}>
                        <Link2 className="w-3 h-3 inline mr-1" />
                        Detached from Calendar
                      </p>
                      <p className={`text-xs ${
                        theme === 'dark' ? 'text-blue-400/80' : 'text-blue-700'
                      }`}>
                        This task has been detached from the calendar. Your changes will not be overwritten by calendar sync.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Start Time */}
              <div>
                <label htmlFor="start-time" className={`text-sm font-medium block mb-2 ${
                  theme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                }`}>
                  Start Time
                </label>
                <TimePicker
                  id="start-time"
                  value={startTime}
                  onChange={(value) => {
                    if (!isReadOnly) {
                      setStartTime(value)
                      setError(null)
                    }
                  }}
                  theme={theme}
                  disabled={isReadOnly}
                />
              </div>

              {/* End Time */}
              <div>
                <label htmlFor="end-time" className={`text-sm font-medium block mb-2 ${
                  theme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                }`}>
                  End Time
                </label>
                <TimePicker
                  id="end-time"
                  value={endTime}
                  onChange={(value) => {
                    if (!isReadOnly) {
                      setEndTime(value)
                      setError(null)
                    }
                  }}
                  theme={theme}
                  disabled={isReadOnly}
                />
              </div>

              {/* Duration Display */}
              {calculatedDuration > 0 && (
                <div className={`p-3 rounded-lg ${
                  theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                }`}>
                  <div className={`text-sm ${
                    theme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                  }`}>
                    Duration
                  </div>
                  <div className={`text-lg font-semibold ${
                    theme === 'dark' ? 'text-[#ff7f00]' : 'text-orange-600'
                  }`}>
                    {formatDuration(calculatedDuration)}
                  </div>
                </div>
              )}


              {/* Recurring Task Settings */}
              {isRecurring && !isReadOnly && (
                <div className="space-y-4">
                  {/* Day Selection */}
                  <div>
                    <label className={`text-sm font-medium block mb-3 ${
                      theme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                    }`}>
                      Recurrence Days
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { day: 1, name: 'M' },
                        { day: 2, name: 'T' },
                        { day: 3, name: 'W' },
                        { day: 4, name: 'T' },
                        { day: 5, name: 'F' },
                        { day: 6, name: 'S' },
                        { day: 0, name: 'S' }
                      ].map(({ day, name }) => (
                        <button
                          key={day}
                          onClick={() => handleDayToggle(day)}
                          className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                            recurrenceDays.includes(day)
                              ? 'bg-[#ff7f00] text-white shadow-md'
                              : theme === 'dark'
                                ? 'bg-[#2a2a2a] text-[#d7d2cb] hover:bg-[#3a3a3a] border border-white/10'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Indefinite Toggle */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        id="isIndefinite"
                        checked={isIndefinite}
                        onChange={(e) => setIsIndefinite(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        onClick={() => setIsIndefinite(!isIndefinite)}
                        className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                          isIndefinite 
                            ? 'bg-[#ff7f00] border-[#ff7f00]' 
                            : theme === 'dark' 
                              ? 'bg-transparent border-white/20 hover:border-white/40' 
                              : 'bg-transparent border-gray-300 hover:border-gray-400'
                        }`}
                      />
                    </div>
                    <label htmlFor="isIndefinite" className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-700'
                    }`}>
                      Indefinite?
                    </label>
                  </div>

                  {/* Date Range (only if not indefinite) */}
                  {!isIndefinite && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="recurrence-start" className={`text-sm font-medium block mb-2 ${
                          theme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                        }`}>
                          Start Date
                        </label>
                        <input
                          id="recurrence-start"
                          type="date"
                          value={recurrenceStartDate}
                          onChange={(e) => setRecurrenceStartDate(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#ff7f00] ${
                            theme === 'dark'
                              ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label htmlFor="recurrence-end" className={`text-sm font-medium block mb-2 ${
                          theme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                        }`}>
                          End Date
                        </label>
                        <input
                          id="recurrence-end"
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#ff7f00] ${
                            theme === 'dark'
                              ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reschedule Button for Overdue Tasks */}
              {isOverdue() && !isReadOnly && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-2 p-3 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-white/5 border-white/20'
                      : 'bg-gray-100 border-gray-300'
                  } border`}
                >
                  <AlertCircle className={`w-4 h-4 flex-shrink-0 ${
                    theme === 'dark' ? 'text-[#d7d2cb]/60' : 'text-gray-600'
                  }`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
                    }`}>This task is overdue</p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-[#d7d2cb]/60' : 'text-gray-600'
                    }`}>Trigger a reschedule to find a new time slot</p>
                  </div>
                  <button
                    onClick={handleReschedule}
                    disabled={isRescheduling}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
                      isRescheduling
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        : 'bg-[#ff7f00] hover:bg-[#ff8c1a] text-white'
                    } disabled:opacity-50`}
                  >
                    {isRescheduling ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Rescheduling...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Reschedule</span>
                      </>
                    )}
                  </button>
                </motion.div>
              )}

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/50"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-500">{error}</span>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-between p-6 border-t ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              {!isReadOnly && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                    'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50'
                  } disabled:opacity-50`}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Task
                </button>
              )}
              {isReadOnly && <div />}
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  } disabled:opacity-50`}
                >
                  Close
                </button>
                {!isReadOnly && (
                  <button
                    onClick={handleSave}
                    disabled={saving || calculatedDuration <= 0}
                    className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                      calculatedDuration <= 0
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        : 'bg-[#ff7f00] hover:bg-[#ff8c1a] text-white'
                    } disabled:opacity-50`}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}