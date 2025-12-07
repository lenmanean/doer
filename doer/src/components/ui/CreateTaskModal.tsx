'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Calendar, Clock, Plus, Settings, ChevronDown, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeAwareInput } from '@/components/ui/ThemeAwareInput'
import { TimePicker } from './TimePicker'
import { supabase } from '@/lib/supabase/client'
import { 
  calculateDuration, 
  formatDuration, 
  isValidTimeFormat, 
  parseTimeToMinutes,
  validateTaskDuration,
  getDurationSuggestion,
  TASK_DURATION_MIN_MINUTES,
  isCrossDayTask as checkIsCrossDayTask,
  splitCrossDayScheduleEntry,
  shouldSkipPastTaskInstance,
  getCurrentDateTime,
  isTaskInPast
} from '@/lib/task-time-utils'
import { formatDateForDB, getToday } from '@/lib/date-utils'
import { useAITaskGeneration } from '@/hooks/useAITaskGeneration'
import { convertUrlsToLinks } from '@/lib/url-utils'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useUsageSummary } from '@/hooks/useUsageSummary'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: (taskData?: any) => void
  selectedDate?: string
  selectedTime?: string
  theme?: 'light' | 'dark'
  currentWeekStart?: Date
  timeFormat?: '12h' | '24h'
}

type TaskMode = 'ai' | 'manual' | 'todo-list'

interface ModeSelectDropdownProps {
  currentMode: TaskMode
  onModeChange: (mode: TaskMode) => void
}

const modeOptions: { value: TaskMode; label: string; isNew?: boolean }[] = [
  { value: 'manual', label: 'Manual Mode' },
  { value: 'todo-list', label: 'To-Do List Mode', isNew: true }
]

function TodoListPreviewItem({ 
  task, 
  index, 
  isEditing, 
  onEdit, 
  onSave, 
  onCancel,
  currentTheme 
}: {
  task: any
  index: number
  isEditing: boolean
  onEdit: () => void
  onSave: (edited: any) => void
  onCancel: () => void
  currentTheme: string
}) {
  const [editedName, setEditedName] = useState(task.name)
  const [editedDuration, setEditedDuration] = useState(task.duration_minutes)
  const [editedPriority, setEditedPriority] = useState(task.priority)

  useEffect(() => {
    if (isEditing) {
      setEditedName(task.name)
      setEditedDuration(task.duration_minutes)
      setEditedPriority(task.priority)
    }
  }, [isEditing, task])

  if (isEditing) {
    return (
      <div className={`p-2 rounded border ${
        currentTheme === 'dark'
          ? 'bg-white/5 border-white/10'
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="space-y-2">
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className={`w-full px-2 py-1 rounded border text-sm ${
              currentTheme === 'dark'
                ? 'bg-white/10 border-white/20 text-[#d7d2cb]'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={editedDuration}
              onChange={(e) => setEditedDuration(parseInt(e.target.value) || 5)}
              min="5"
              max="360"
              className={`w-20 px-2 py-1 rounded border text-sm ${
                currentTheme === 'dark'
                  ? 'bg-white/10 border-white/20 text-[#d7d2cb]'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            <select
              value={editedPriority}
              onChange={(e) => setEditedPriority(parseInt(e.target.value))}
              className={`px-2 py-1 rounded border text-sm ${
                currentTheme === 'dark'
                  ? 'bg-white/10 border-white/20 text-[#d7d2cb]'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value={1}>Critical</option>
              <option value={2}>High</option>
              <option value={3}>Medium</option>
              <option value={4}>Low</option>
            </select>
            <button
              type="button"
              onClick={() => onSave({
                ...task,
                name: editedName,
                duration_minutes: editedDuration,
                priority: editedPriority
              })}
              className="px-2 py-1 text-xs bg-[var(--primary)] text-white rounded"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={`px-2 py-1 text-xs rounded ${
                currentTheme === 'dark'
                  ? 'bg-white/10 text-[#d7d2cb]'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-2 rounded border ${
      currentTheme === 'dark'
        ? 'bg-white/5 border-white/10'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${
          currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
        }`}>
          {task.name}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${
            currentTheme === 'dark' ? 'text-[#d7d2cb]/60' : 'text-gray-600'
          }`}>
            {task.duration_minutes} min
          </span>
          <button
            type="button"
            onClick={onEdit}
            className={`text-xs underline ${
              currentTheme === 'dark' 
                ? 'text-[#d7d2cb]/60 hover:text-[#d7d2cb]' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Edit
          </button>
        </div>
      </div>
      {task.suggested_date && task.suggested_time && (
        <div className={`text-xs mt-1 ${
          currentTheme === 'dark' ? 'text-[#d7d2cb]/60' : 'text-gray-600'
        }`}>
          {task.suggested_date} at {task.suggested_time}
        </div>
      )}
    </div>
  )
}

function ModeSelectDropdown({ currentMode, onModeChange }: ModeSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-[#d7d2cb]/60 hover:text-[#d7d2cb] hover:bg-white/5 flex items-center gap-1"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>Switch Mode</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Dropdown Menu */}
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 right-0 mt-1 w-48 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden"
              role="listbox"
            >
              {modeOptions.map((option) => {
                const isSelected = option.value === currentMode
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onModeChange(option.value)
                      setIsOpen(false)
                    }}
                    className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-[var(--secondary)] transition-colors ${
                      isSelected
                        ? 'bg-[var(--primary)]/20 border-l-2 border-[var(--primary)]'
                        : 'text-[var(--foreground)]'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span>{option.label}</span>
                      {option.isNew && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--primary)]/20 text-[var(--primary)] rounded border border-[var(--primary)]/30">
                          New
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  selectedDate = '',
  selectedTime = '',
  theme = 'dark',
  currentWeekStart,
  timeFormat = '12h'
}: CreateTaskModalProps) {
  // Force dark mode for now - theme functionality disabled
  const currentTheme = 'dark'
  const { user } = useSupabase()
  const {
    loading: loadingUsage,
    error: usageError,
    getMetric: getUsageMetric,
  } = useUsageSummary(user?.id)
  const aiCreditsUsage = getUsageMetric('api_credits')
  const aiCreditsDepleted = aiCreditsUsage ? aiCreditsUsage.available <= 0 : false
  const aiCreditsBanner = useMemo(() => {
    if (!user?.id) return null

    const baseClasses =
      currentTheme === 'dark'
        ? 'rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-[#d7d2cb]'
        : 'rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-800'

    if (loadingUsage) {
      return (
        <div className={baseClasses}>
          Checking your AI credits…
        </div>
      )
    }

    if (usageError) {
      return (
        <div
          className={`rounded-lg border px-4 py-3 text-xs ${
            currentTheme === 'dark'
              ? 'border-red-500/40 bg-red-500/10 text-red-200'
              : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          Unable to load AI credits. Please try again.
        </div>
      )
    }

    if (aiCreditsUsage) {
      if (aiCreditsDepleted) {
        return (
          <div
            className={`rounded-lg border px-4 py-3 text-xs font-medium ${
              currentTheme === 'dark'
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : 'border-red-200 bg-red-50 text-red-600'
            }`}
          >
            No AI credits remaining this billing cycle.
          </div>
        )
      }

      return (
        <div className={baseClasses}>
          <span className="font-semibold">
            {aiCreditsUsage.available.toLocaleString()} of {aiCreditsUsage.allocation.toLocaleString()} AI credits
          </span>{' '}
          remaining this cycle.
        </div>
      )
    }

    return (
      <div className={baseClasses}>
        Usage data will appear after your first AI-generated task this cycle.
      </div>
    )
  }, [aiCreditsDepleted, aiCreditsUsage, currentTheme, loadingUsage, usageError, user?.id])
  
  const [formData, setFormData] = useState({
    name: '',
    details: '',
    startTime: selectedTime || '',
    endTime: '',
    date: selectedDate || '',
    priority: 3 as number, // Default to Medium (3)
    isRecurring: false,
    recurrenceDays: [] as number[],
    recurrenceInterval: 1,
    recurrenceStartDate: '',
    recurrenceEndDate: '',
    isIndefinite: false
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  
  // Mode state: 'ai' | 'manual' | 'todo-list'
  const [mode, setMode] = useState<'ai' | 'manual' | 'todo-list'>('ai')
  const isAIMode = mode === 'ai'
  
  // Manual mode multi-task state
  const [manualTasks, setManualTasks] = useState<Array<{
    id: string
    name: string
    details: string
    startTime: string
    endTime: string
    date: string
    priority: number
    isRecurring: boolean
    recurrenceDays: number[]
    recurrenceInterval: number
    recurrenceStartDate: string
    recurrenceEndDate: string
    isIndefinite: boolean
  }>>([
    {
      id: `manual-task-${Date.now()}`,
      name: '',
      details: '',
      startTime: selectedTime || '',
      endTime: '',
      date: selectedDate || '',
      priority: 3,
      isRecurring: false,
      recurrenceDays: [],
      recurrenceInterval: 1,
      recurrenceStartDate: '',
      recurrenceEndDate: '',
      isIndefinite: false
    }
  ])
  
  // AI mode state
  const [aiDescription, setAiDescription] = useState('')
  const [aiStartTime, setAiStartTime] = useState<string>('')
  const [aiGeneratedTask, setAiGeneratedTask] = useState<any>(null)
  const [showAIPreview, setShowAIPreview] = useState(false)
  const [aiFollowUp, setAiFollowUp] = useState<any>(null)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [followUpDuration, setFollowUpDuration] = useState<string>('')
  const [followUpEndDate, setFollowUpEndDate] = useState<string>('')
  const [followUpIsIndefinite, setFollowUpIsIndefinite] = useState<boolean>(false)
  const [isEditingAITask, setIsEditingAITask] = useState(false)
  const [editableAITask, setEditableAITask] = useState<any>(null)
  
  // To-Do List mode state
  const [todoListTasks, setTodoListTasks] = useState<Array<{id: string, name: string, priority?: number}>>([
    { id: `task-${Date.now()}`, name: '', priority: 3 }
  ])
  const [todoListPreview, setTodoListPreview] = useState<any[] | null>(null)
  const [isAnalyzingTodoList, setIsAnalyzingTodoList] = useState(false)
  const [todoListError, setTodoListError] = useState<string | null>(null)
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null)
  
  // Cross-day task handling
  const [showCrossDayWarning, setShowCrossDayWarning] = useState(false)
  const [crossDayTaskData, setCrossDayTaskData] = useState<any>(null)
  
  // Past date warning handling
  const [showPastDateWarning, setShowPastDateWarning] = useState(false)
  const [pastDateTaskData, setPastDateTaskData] = useState<any>(null)
  
  // Unsaved changes protection
  const [showUnsavedChangesWarning, setShowUnsavedChangesWarning] = useState(false)
  const [isIntentionalCancel, setIsIntentionalCancel] = useState(false)
  const initialStateRef = useRef<any>(null)
  
  // AI generation hook
  const { generateTask, isLoading: isAILoading, error: aiError, clearError } = useAITaskGeneration()

  // Helper function to check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialStateRef.current) return false
    
    const initialState = initialStateRef.current
    
    // Check AI mode changes
    if (mode === 'ai') {
      const hasAIDescription = aiDescription.trim().length > 0
      const hasAIStartTime = aiStartTime.trim().length > 0
      const hasAIGeneratedTask = aiGeneratedTask !== null
      const hasShowAIPreview = showAIPreview !== initialState.showAIPreview
      const hasFollowUp = aiFollowUp !== null || showFollowUp !== initialState.showFollowUp
      const isEditing = isEditingAITask !== initialState.isEditingAITask
      
      return hasAIDescription || hasAIStartTime || hasAIGeneratedTask || hasShowAIPreview || hasFollowUp || isEditing
    }
    
    // Check Manual mode changes
    if (mode === 'manual') {
      // Check if any manual task has non-empty data
      const hasManualTaskData = manualTasks.some(task => {
        return task.name.trim().length > 0 ||
               task.details.trim().length > 0 ||
               task.startTime.trim().length > 0 ||
               task.endTime.trim().length > 0 ||
               task.date.trim().length > 0 ||
               task.recurrenceDays.length > 0 ||
               task.recurrenceStartDate.trim().length > 0 ||
               task.recurrenceEndDate.trim().length > 0 ||
               task.isRecurring !== (initialState.manualTasks?.[0]?.isRecurring ?? false) ||
               task.isIndefinite !== (initialState.manualTasks?.[0]?.isIndefinite ?? false) ||
               task.priority !== (initialState.manualTasks?.[0]?.priority ?? 3)
      })
      
      // Also check if number of tasks changed
      const taskCountChanged = manualTasks.length !== (initialState.manualTasks?.length || 1)
      
      return hasManualTaskData || taskCountChanged
    }
    
    // Check Todo List mode changes
    if (mode === 'todo-list') {
      const hasTodoListData = todoListTasks.some(task => task.name.trim().length > 0)
      const hasTodoListPreview = todoListPreview !== null
      const taskCountChanged = todoListTasks.length !== (initialState.todoListTasks?.length || 1)
      
      return hasTodoListData || hasTodoListPreview || taskCountChanged
    }
    
    return false
  }, [
    mode,
    aiDescription,
    aiStartTime,
    aiGeneratedTask,
    showAIPreview,
    aiFollowUp,
    showFollowUp,
    isEditingAITask,
    manualTasks,
    todoListTasks,
    todoListPreview
  ])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset intentional cancel flag and unsaved changes warning
      setIsIntentionalCancel(false)
      setShowUnsavedChangesWarning(false)
      
      // Save initial state for comparison
      const startTime = selectedTime || ''
      
      const initial = {
        mode: 'ai',
        formData: {
          name: '',
          details: '',
          startTime: startTime,
          endTime: '',
          date: selectedDate || '',
          priority: 3,
          isRecurring: false,
          recurrenceDays: [],
          recurrenceInterval: 1,
          recurrenceStartDate: '',
          recurrenceEndDate: '',
          isIndefinite: false
        },
        manualTasks: [{
          id: `manual-task-${Date.now()}`,
          name: '',
          details: '',
          startTime: startTime,
          endTime: '',
          date: selectedDate || '',
          priority: 3,
          isRecurring: false,
          recurrenceDays: [],
          recurrenceInterval: 1,
          recurrenceStartDate: '',
          recurrenceEndDate: '',
          isIndefinite: false
        }],
        aiDescription: '',
        aiStartTime: '',
        aiGeneratedTask: null,
        showAIPreview: false,
        aiFollowUp: null,
        showFollowUp: false,
        isEditingAITask: false,
        todoListTasks: [{ id: `task-${Date.now()}`, name: '', priority: 3 }],
        todoListPreview: null
      }
      
      initialStateRef.current = initial
      
      setFormData({
        name: '',
        details: '',
        startTime: startTime,
        endTime: '', // Always empty - user must set this
        date: selectedDate || '',
        priority: 3, // Default to Medium
        isRecurring: false,
        recurrenceDays: [],
        recurrenceInterval: 1,
        recurrenceStartDate: '',
        recurrenceEndDate: '',
        isIndefinite: false
      })
      setIsRecurring(false)
      setIsIndefinite(false)
      setError(null)
      
      // Reset mode and state
      setMode('ai') // Always start in AI mode
      setAiDescription('')
      setAiStartTime(selectedTime || '')
      setAiGeneratedTask(null)
      setShowAIPreview(false)
      setAiFollowUp(null)
      setShowFollowUp(false)
      setFollowUpDuration('')
      setFollowUpEndDate('')
      setFollowUpIsIndefinite(false)
      setIsEditingAITask(false)
      setEditableAITask(null)
      
      // Reset To-Do List state
      setTodoListTasks([{ id: `task-${Date.now()}`, name: '', priority: 3 }])
      setTodoListPreview(null)
      setIsAnalyzingTodoList(false)
      setTodoListError(null)
      
      // Reset Manual mode multi-task state
      setManualTasks([{
        id: `manual-task-${Date.now()}`,
        name: '',
        details: '',
        startTime: selectedTime || '',
        endTime: '',
        date: selectedDate || '',
        priority: 3,
        isRecurring: false,
        recurrenceDays: [],
        recurrenceInterval: 1,
        recurrenceStartDate: '',
        recurrenceEndDate: '',
        isIndefinite: false
      }])
      
      clearError()
    }
  }, [isOpen, selectedTime, selectedDate, clearError])

  // Handle modal close attempts with unsaved changes protection
  const handleCloseAttempt = () => {
    // If intentional cancel was clicked, close immediately without warning
    if (isIntentionalCancel) {
      setIsIntentionalCancel(false)
      onClose()
      return
    }

    // If there are unsaved changes, show warning
    if (hasUnsavedChanges) {
      setShowUnsavedChangesWarning(true)
    } else {
      // No unsaved changes, close immediately
      onClose()
    }
  }

  // Handle intentional cancel button click - bypass warning
  const handleCancelClick = () => {
    setIsIntentionalCancel(true)
    onClose()
  }

  // Handle confirmation to discard unsaved changes
  const handleConfirmDiscard = () => {
    setShowUnsavedChangesWarning(false)
    setIsIntentionalCancel(false)
    onClose()
  }

  // Handle browser navigation/refresh with unsaved changes
  useEffect(() => {
    if (!isOpen || !hasUnsavedChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isOpen, hasUnsavedChanges])

  // Check if task spans across midnight
  const isCrossDayTask = useMemo(() => {
    if (!formData.startTime || !formData.endTime) return false
    return checkIsCrossDayTask(formData.startTime, formData.endTime)
  }, [formData.startTime, formData.endTime])

  // Calculate duration when start time or end time changes
  const calculatedDuration = useMemo(() => {
    if (formData.startTime && formData.endTime) {
      return calculateDuration(formData.startTime, formData.endTime)
    }
    return 0
  }, [formData.startTime, formData.endTime])

  // Set default recurring days when recurring is enabled
  useEffect(() => {
    if (isRecurring && formData.recurrenceDays.length === 0) {
      // Default to the day of the selected date, parsed as local date
      if (!formData.date) return // Should not happen if a slot is clicked
      const [year, month, day] = formData.date.split('-').map(Number)
      const selectedDateObj = new Date(year, month - 1, day) // Month is 0-indexed
      const dayOfWeek = selectedDateObj.getDay()
      setFormData(prev => ({ ...prev, recurrenceDays: [dayOfWeek] }))
    }
  }, [isRecurring, formData.date, formData.recurrenceDays.length])

  // Get the day of the selected date for highlighting
  const selectedDateDay = useMemo(() => {
    if (!formData.date) return null
    // Parse date string as local date to avoid timezone issues
    const [year, month, day] = formData.date.split('-').map(Number)
    const selectedDateObj = new Date(year, month - 1, day) // Month is 0-indexed
    return selectedDateObj.getDay()
  }, [formData.date])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleRecurringToggle = (checked: boolean) => {
    setIsRecurring(checked)
    setFormData(prev => ({ 
      ...prev, 
      isRecurring: checked,
      // Clear date when recurring so recurrence days drive generation
      date: checked ? '' : prev.date
    }))
    if (!checked) {
      setIsIndefinite(false)
      setFormData(prev => ({ 
        ...prev, 
        isIndefinite: false,
        recurrenceDays: [],
        recurrenceStartDate: '',
        recurrenceEndDate: ''
      }))
    }
  }

  const handleIndefiniteToggle = (checked: boolean) => {
    setIsIndefinite(checked)
    setFormData(prev => ({ ...prev, isIndefinite: checked }))
    if (checked) {
      setFormData(prev => ({ ...prev, recurrenceEndDate: '' }))
    }
  }

  // Utilities for displaying times/dates according to user preference
  const formatTimeForDisplay = (time24: string) => {
    if (!time24) return ''
    if (timeFormat === '24h') return time24
    const [hour, minute] = time24.split(':').map(Number)
    let h = hour % 12
    if (h === 0) h = 12
    const period = hour >= 12 ? 'PM' : 'AM'
    return `${h}:${minute.toString().padStart(2, '0')} ${period}`
  }

  const formatDateForLabel = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getNextDateString = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + 1)
    return `${dt.getFullYear()}-${(dt.getMonth() + 1).toString().padStart(2, '0')}-${dt
      .getDate()
      .toString()
      .padStart(2, '0')}`
  }

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      recurrenceDays: prev.recurrenceDays.includes(day)
        ? prev.recurrenceDays.filter(d => d !== day)
        : [...prev.recurrenceDays, day]
    }))
  }

  // Manual mode multi-task helpers
  const handleManualTaskChange = (taskId: string, field: string, value: any) => {
    setManualTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, [field]: value } : task
    ))
  }

  const handleAddManualTask = () => {
    setManualTasks(prev => [...prev, {
      id: `manual-task-${Date.now()}`,
      name: '',
      details: '',
      startTime: '',
      endTime: '',
      date: selectedDate || '',
      priority: 3,
      isRecurring: false,
      recurrenceDays: [],
      recurrenceInterval: 1,
      recurrenceStartDate: '',
      recurrenceEndDate: '',
      isIndefinite: false
    }])
  }

  const handleRemoveManualTask = (taskId: string) => {
    if (manualTasks.length > 1) {
      setManualTasks(prev => prev.filter(task => task.id !== taskId))
    }
  }

  const handleManualTaskRecurringToggle = (taskId: string, checked: boolean) => {
    setManualTasks(prev => prev.map(task => 
      task.id === taskId ? {
        ...task,
        isRecurring: checked,
        date: checked ? '' : task.date,
        isIndefinite: checked ? task.isIndefinite : false,
        recurrenceDays: checked ? task.recurrenceDays : [],
        recurrenceStartDate: checked ? task.recurrenceStartDate : '',
        recurrenceEndDate: checked ? task.recurrenceEndDate : ''
      } : task
    ))
  }

  const handleManualTaskIndefiniteToggle = (taskId: string, checked: boolean) => {
    setManualTasks(prev => prev.map(task => 
      task.id === taskId ? {
        ...task,
        isIndefinite: checked,
        recurrenceEndDate: checked ? '' : task.recurrenceEndDate
      } : task
    ))
  }

  const handleManualTaskDayToggle = (taskId: string, day: number) => {
    setManualTasks(prev => prev.map(task => 
      task.id === taskId ? {
        ...task,
        recurrenceDays: task.recurrenceDays.includes(day)
          ? task.recurrenceDays.filter(d => d !== day)
          : [...task.recurrenceDays, day]
      } : task
    ))
  }

  // Cross-day task handlers
  const handleCrossDayConfirm = async () => {
    if (!crossDayTaskData) return

    setIsLoading(true)
    setIsCreating(true)
    setError(null)
    setShowCrossDayWarning(false)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create tasks')
      }

      // Calculate the end date (next day) using local date parsing to avoid TZ issues
      const [startYear, startMonth, startDay] = crossDayTaskData.date.split('-').map(Number)
      const startDate = new Date(startYear, startMonth - 1, startDay)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 1)

      // Create the task with retry if schema cache hasn't picked up default_* columns yet
      const baseInsert = {
        plan_id: null as string | null,
        user_id: user.id,
        name: crossDayTaskData.name,
        details: crossDayTaskData.details,
        estimated_duration_minutes: calculatedDuration,
        priority: crossDayTaskData.priority || 3, // Use priority from form data
        category: null as any,
        idx: null as any,
        assigned_to_plan: false,
        is_recurring: !!crossDayTaskData.isRecurring,
        is_indefinite: crossDayTaskData.isRecurring ? !!crossDayTaskData.isIndefinite : false,
        recurrence_days: crossDayTaskData.isRecurring ? crossDayTaskData.recurrenceDays : null,
        recurrence_start_date: crossDayTaskData.isRecurring && !crossDayTaskData.isIndefinite ? crossDayTaskData.recurrenceStartDate : null,
        recurrence_end_date: crossDayTaskData.isRecurring && !crossDayTaskData.isIndefinite ? crossDayTaskData.recurrenceEndDate : null
      }

      const withDefaults = {
        ...baseInsert,
        default_start_time: crossDayTaskData.isRecurring && crossDayTaskData.isIndefinite ? crossDayTaskData.startTime : null,
        default_end_time: crossDayTaskData.isRecurring && crossDayTaskData.isIndefinite ? crossDayTaskData.endTime : null
      }

      let task: any | null = null
      try {
        const res = await supabase.from('tasks').insert(withDefaults).select('id').single()
        if (res.error) throw res.error
        task = res.data
      } catch (err: any) {
        // Retry without default_* if column missing in schema cache
        const msg: string = err?.message || ''
        if (msg.includes('default_start_time') || msg.includes('default_end_time')) {
          const res2 = await supabase.from('tasks').insert(baseInsert).select('id').single()
          if (res2.error) throw res2.error
          task = res2.data
        } else {
          throw err
        }
      }

      // If recurring, generate entries across selected days and weeks
      const isRecurring = !!crossDayTaskData.isRecurring && Array.isArray(crossDayTaskData.recurrenceDays) && crossDayTaskData.recurrenceDays.length > 0
      if (isRecurring) {
        // For indefinite recurring cross-day: generate current week only (no bulk future weeks)
        // Determine starting week baseline
        let weekStart: Date
        if (currentWeekStart) {
          weekStart = new Date(currentWeekStart)
        } else {
          const [y, m, d] = crossDayTaskData.date.split('-').map(Number)
          const start = crossDayTaskData.date ? new Date(y, m - 1, d) : new Date()
          weekStart = new Date(start)
          // Normalize to Sunday start to align with existing recurring generation logic
          weekStart.setDate(start.getDate() - start.getDay())
        }

        // How many weeks to generate
        let weeksToGenerate = 1
        if (crossDayTaskData.isIndefinite) {
          weeksToGenerate = 1 // limit indefinite to current week only
        } else if (crossDayTaskData.recurrenceStartDate && crossDayTaskData.recurrenceEndDate) {
          const s = new Date(crossDayTaskData.recurrenceStartDate)
          const e = new Date(crossDayTaskData.recurrenceEndDate)
          const diffWeeks = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 7))
          weeksToGenerate = Math.max(1, diffWeeks)
        }

        const startMinutesFromStart = parseTimeToMinutes(crossDayTaskData.startTime)
        const startDayDuration = (24 * 60) - startMinutesFromStart
        const endDayDuration = parseTimeToMinutes(crossDayTaskData.endTime)

        const entries: any[] = []
        for (let w = 0; w < weeksToGenerate; w++) {
          const base = new Date(weekStart)
          base.setDate(weekStart.getDate() + w * 7)
          for (let i = 0; i < 7; i++) {
            const day = new Date(base)
            day.setDate(base.getDate() + i)
            const dayOfWeek = day.getDay()

            if (crossDayTaskData.recurrenceDays.includes(dayOfWeek)) {
              // Create start-day segment for this occurrence
              const startDateStr = formatDateForDB(day)
              const nextDay = new Date(day)
              nextDay.setDate(day.getDate() + 1)
              const nextDateStr = formatDateForDB(nextDay)

              entries.push({
                plan_id: null,
                task_id: task.id,
                user_id: user.id,
                date: startDateStr,
                start_time: crossDayTaskData.startTime,
                end_time: '23:59',
                duration_minutes: startDayDuration,
                day_index: 0
              })
              // Always create the following-day segment to complete the span
              entries.push({
                plan_id: null,
                task_id: task.id,
                user_id: user.id,
                date: nextDateStr,
                start_time: '00:00',
                end_time: crossDayTaskData.endTime,
                duration_minutes: endDayDuration,
                day_index: 0
              })
            }
          }
        }

        if (entries.length > 0) {
          const { error: bulkErr } = await supabase.from('task_schedule').insert(entries)
          if (bulkErr) throw bulkErr
        }
      } else {
        // Single occurrence: create two schedule entries (start day to 23:59, next day from 00:00)
        const startDayDuration = (24 * 60) - parseTimeToMinutes(crossDayTaskData.startTime)
        const { error: startScheduleError } = await supabase
          .from('task_schedule')
          .insert({
            plan_id: null,
            task_id: task.id,
            user_id: user.id,
            date: crossDayTaskData.date,
            start_time: crossDayTaskData.startTime,
            end_time: '23:59',
            duration_minutes: startDayDuration,
            day_index: 0
          })
        if (startScheduleError) throw startScheduleError

        const endDayDuration = parseTimeToMinutes(crossDayTaskData.endTime)
        const { error: endScheduleError } = await supabase
          .from('task_schedule')
          .insert({
            plan_id: null,
            task_id: task.id,
            user_id: user.id,
            date: formatDateForDB(endDate),
            start_time: '00:00',
            end_time: crossDayTaskData.endTime,
            duration_minutes: endDayDuration,
            day_index: 0
          })
        if (endScheduleError) throw endScheduleError
      }

      // For recurring creations, skip optimistic flood; rely on refetch
      if (!isRecurring) {
        // Prepare optimistic updates as two schedule entries to match DB
        const startDayDuration = (24 * 60) - parseTimeToMinutes(crossDayTaskData.startTime)
        const endDayDuration = parseTimeToMinutes(crossDayTaskData.endTime)
        const         optimisticStartDay = {
          schedule_id: `temp-start-${Date.now()}`,
          task_id: task.id,
          name: crossDayTaskData.name,
          details: crossDayTaskData.details,
          priority: formData.priority || 3,
          estimated_duration_minutes: startDayDuration,
          complexity_score: null,
          start_time: crossDayTaskData.startTime,
          end_time: '23:59',
          duration_minutes: startDayDuration,
          day_index: 0,
          date: crossDayTaskData.date,
          completed: false,
          is_recurring: crossDayTaskData.isRecurring,
          is_indefinite: crossDayTaskData.isIndefinite,
          recurrence_days: crossDayTaskData.recurrenceDays,
          recurrence_start_date: crossDayTaskData.recurrenceStartDate,
          recurrence_end_date: crossDayTaskData.recurrenceEndDate
        }

        const optimisticEndDay = {
          schedule_id: `temp-end-${Date.now()}`,
          task_id: task.id,
          name: crossDayTaskData.name,
          details: crossDayTaskData.details,
          priority: formData.priority || 3,
          estimated_duration_minutes: endDayDuration,
          complexity_score: null,
          start_time: '00:00',
          end_time: crossDayTaskData.endTime,
          duration_minutes: endDayDuration,
          day_index: 0,
          date: formatDateForDB(endDate),
          completed: false,
          is_recurring: crossDayTaskData.isRecurring,
          is_indefinite: crossDayTaskData.isIndefinite,
          recurrence_days: crossDayTaskData.recurrenceDays,
          recurrence_start_date: crossDayTaskData.recurrenceStartDate,
          recurrence_end_date: crossDayTaskData.recurrenceEndDate
        }

        onTaskCreated(optimisticStartDay)
        onTaskCreated(optimisticEndDay)
      }
      onClose()
    } catch (err) {
      console.error('Error creating cross-day task:', err)
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsLoading(false)
      setIsCreating(false)
      setCrossDayTaskData(null)
    }
  }

  const handleCrossDayCancel = () => {
    setShowCrossDayWarning(false)
    setCrossDayTaskData(null)
  }

  // Past date warning handlers
  const handlePastDateConfirm = async () => {
    if (!pastDateTaskData) return

    setIsLoading(true)
    setIsCreating(true)
    setError(null)
    setShowPastDateWarning(false)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create tasks')
      }

      // Proceed with creating the task schedule (task already created)
      const { error: singleTaskError } = await supabase.from('task_schedule').insert({
        plan_id: null,
        user_id: user.id,
        task_id: pastDateTaskData.taskId,
        day_index: 0,
        date: pastDateTaskData.taskData.date,
        start_time: pastDateTaskData.taskData.startTime,
        end_time: pastDateTaskData.taskData.endTime,
        duration_minutes: pastDateTaskData.duration,
        status: 'scheduled'
      })
      if (singleTaskError) throw singleTaskError

      // Continue with callback and close
      onTaskCreated()
      setTimeout(() => onClose(), 100)
      setPastDateTaskData(null)
    } catch (err: any) {
      console.error('Error creating past date task:', err)
      setError(err.message || 'Failed to create task')
      setIsLoading(false)
      setIsCreating(false)
    }
  }

  const handlePastDateCancel = () => {
    setShowPastDateWarning(false)
    setPastDateTaskData(null)
    setIsLoading(false)
    setIsCreating(false)
    // Note: The task was already created, so we might want to delete it
    // For now, we'll leave it as a task without a schedule entry
  }

  // Manual mode multi-task submit handler
  const handleManualTasksSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsLoading(true)
    setIsCreating(true)
    setError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create tasks')
      }

      // Validate all tasks
      const validTasks = manualTasks.filter(task => 
        task.name.trim() && 
        task.startTime && 
        task.endTime && 
        (!task.isRecurring || task.date || task.recurrenceDays.length > 0)
      )

      if (validTasks.length === 0) {
        throw new Error('Please add at least one valid task with name, start time, and end time')
      }

      // First pass: Validate all tasks before creating any
      const tasksWithErrors: Array<{ task: any; error: string }> = []
      const tasksToCreate: Array<{ taskData: any; duration: number; isCrossDay: boolean }> = []
      
      for (const taskData of validTasks) {
        // Validate recurring task date range if not indefinite
        if (taskData.isRecurring && !taskData.isIndefinite) {
          if (!taskData.recurrenceStartDate || !taskData.recurrenceEndDate) {
            tasksWithErrors.push({
              task: taskData,
              error: 'Please select start and end dates for recurring tasks'
            })
            continue
          }
          
          if (new Date(taskData.recurrenceStartDate) >= new Date(taskData.recurrenceEndDate)) {
            tasksWithErrors.push({
              task: taskData,
              error: 'End date must be after start date'
            })
            continue
          }
        }
        // Calculate duration
        if (!taskData.startTime || !taskData.endTime) {
          tasksWithErrors.push({
            task: taskData,
            error: 'Missing start or end time'
          })
          continue
        }
        
        const duration = calculateDuration(taskData.startTime, taskData.endTime)
        const isCrossDay = checkIsCrossDayTask(taskData.startTime, taskData.endTime)

        console.log(`🔍 Duration calculation for "${taskData.name}":`, {
          startTime: taskData.startTime,
          endTime: taskData.endTime,
          isCrossDay,
          calculatedDuration: duration,
          durationHours: (duration / 60).toFixed(1)
        })

        if (duration <= 0) {
          console.error(`❌ Invalid duration (<= 0) for task: ${taskData.name}`, { duration, isCrossDay })
          tasksWithErrors.push({
            task: taskData,
            error: 'Invalid duration: end time must be after start time'
          })
          continue
        }

        // Validate duration meets minimum requirement (5 minutes)
        // Manual tasks have no maximum duration limit (only AI-generated tasks are limited to 6 hours)
        const validation = validateTaskDuration(duration, false, true)
        if (!validation.isValid) {
          console.error(`❌ Duration validation failed for task: ${taskData.name}`, {
            duration,
            validation,
            minRequired: TASK_DURATION_MIN_MINUTES
          })
          const suggestion = getDurationSuggestion(taskData.startTime, taskData.endTime)
          tasksWithErrors.push({
            task: taskData,
            error: `${validation.error} ${suggestion}`
          })
          continue
        }
        
        console.log(`✅ Duration validation passed for task: ${taskData.name}`, { duration })

        // Task is valid, add to creation list
        tasksToCreate.push({ taskData, duration, isCrossDay })
      }

      // If there are validation errors, show them and stop
      if (tasksWithErrors.length > 0) {
        const errorMessages = tasksWithErrors.map(({ task, error }) => 
          `"${task.name}": ${error}`
        ).join('\n')
        throw new Error(`Please fix the following errors:\n${errorMessages}`)
      }

      // Second pass: Create all valid tasks
      console.log(`🚀 Starting task creation for ${tasksToCreate.length} task(s)`)
      for (const { taskData, duration, isCrossDay } of tasksToCreate) {
        console.log(`📝 Processing task: ${taskData.name}`, { isRecurring: taskData.isRecurring, isIndefinite: taskData.isIndefinite, isCrossDay })
        // Create task
        const baseInsert = {
          plan_id: null as string | null,
          user_id: user.id,
          name: taskData.name,
          details: taskData.details || '',
          estimated_duration_minutes: duration,
          priority: taskData.priority || 3,
          category: null as any,
          idx: null as any,
          assigned_to_plan: false,
          is_recurring: !!taskData.isRecurring,
          is_indefinite: taskData.isRecurring ? !!taskData.isIndefinite : false,
          recurrence_days: taskData.isRecurring ? taskData.recurrenceDays : null,
          recurrence_start_date: taskData.isRecurring && !taskData.isIndefinite ? taskData.recurrenceStartDate : null,
          recurrence_end_date: taskData.isRecurring && !taskData.isIndefinite ? taskData.recurrenceEndDate : null
        }

        const withDefaults = {
          ...baseInsert,
          default_start_time: taskData.isRecurring && taskData.isIndefinite ? taskData.startTime : null,
          default_end_time: taskData.isRecurring && taskData.isIndefinite ? taskData.endTime : null
        }

        let task: any | null = null
        try {
          const res = await supabase.from('tasks').insert(withDefaults).select('id').single()
          if (res.error) throw res.error
          task = res.data
        } catch (err: any) {
          const msg: string = err?.message || ''
          if (msg.includes('default_start_time') || msg.includes('default_end_time')) {
            const res2 = await supabase.from('tasks').insert(baseInsert).select('id').single()
            if (res2.error) throw res2.error
            task = res2.data
          } else {
            throw err
          }
        }

        if (!task) {
          console.error('Failed to create task:', taskData.name)
          continue
        }

        console.log('✅ Task created successfully:', { taskId: task.id, name: taskData.name, isRecurring: taskData.isRecurring, isIndefinite: taskData.isIndefinite })

        // Handle recurring tasks
        if (taskData.isRecurring && taskData.isIndefinite) {
          // Indefinite recurring - skip schedule creation (API will synthesize)
          console.log('⏭️ Skipping schedule creation for indefinite recurring task:', taskData.name)
          continue
        }

        // Handle cross-day tasks
        if (isCrossDay && !taskData.isRecurring) {
          // Use helper function to split cross-day task across two days
          const splitEntries = splitCrossDayScheduleEntry(
            taskData.date,
            taskData.startTime,
            taskData.endTime,
            task.id,
            user.id,
            null, // plan_id
            0 // day_index
          )
          
          const { error: splitError } = await supabase.from('task_schedule').insert(splitEntries)
          if (splitError) throw splitError
        } else if (taskData.isRecurring && !taskData.isIndefinite) {
          // Recurring with date range
          const startDate = new Date(taskData.recurrenceStartDate)
          const endDate = new Date(taskData.recurrenceEndDate)
          const weekStart = new Date(startDate)
          weekStart.setDate(startDate.getDate() - startDate.getDay())

          const diffWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
          const weeksToGenerate = Math.max(1, diffWeeks)
          const scheduleEntries = []

          // Check if this recurring task is cross-day
          const recurringIsCrossDay = checkIsCrossDayTask(taskData.startTime, taskData.endTime)

          // Get current date/time for filtering past tasks
          const { todayStr, currentTimeStr } = getCurrentDateTime()

          for (let week = 0; week < weeksToGenerate; week++) {
            const currentWeekStart = new Date(weekStart)
            currentWeekStart.setDate(weekStart.getDate() + (week * 7))

            for (let i = 0; i < 7; i++) {
              const currentDate = new Date(currentWeekStart)
              currentDate.setDate(currentWeekStart.getDate() + i)
              const dayOfWeek = currentDate.getDay()
              const taskDateStr = formatDateForDB(currentDate)

              if (taskData.recurrenceDays.includes(dayOfWeek) &&
                  taskDateStr >= taskData.recurrenceStartDate &&
                  taskDateStr <= taskData.recurrenceEndDate) {
                
                // Skip past dates/times
                if (shouldSkipPastTaskInstance(taskDateStr, taskData.endTime, todayStr, currentTimeStr)) {
                  continue
                }

                if (recurringIsCrossDay) {
                  // Split cross-day recurring task across two days
                  // For cross-day tasks, we need to check both parts
                  const nextDayDateStr = formatDateForDB(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1))
                  
                  // Only create entries if the task hasn't finished yet
                  if (!shouldSkipPastTaskInstance(nextDayDateStr, taskData.endTime, todayStr, currentTimeStr)) {
                    const splitEntries = splitCrossDayScheduleEntry(
                      taskDateStr,
                      taskData.startTime,
                      taskData.endTime,
                      task.id,
                      user.id,
                      null, // plan_id
                      i + (week * 7) // day_index
                    )
                    scheduleEntries.push(...splitEntries)
                  }
                } else {
                  // Non-cross-day recurring task
                  scheduleEntries.push({
                    plan_id: null,
                    user_id: user.id,
                    task_id: task.id,
                    day_index: i + (week * 7),
                    date: taskDateStr,
                    start_time: taskData.startTime,
                    end_time: taskData.endTime,
                    duration_minutes: duration,
                    status: 'scheduled'
                  })
                }
              }
            }
          }

          if (scheduleEntries.length > 0) {
            const { error: scheduleError } = await supabase.from('task_schedule').insert(scheduleEntries)
            if (scheduleError) throw scheduleError
          }
        } else {
          // Single non-recurring task
          // Note: Cross-day single tasks are handled above at line 1099
          // This case only handles non-cross-day single tasks
          
          // Check if task is in the past (but don't skip, just validate)
          const { todayStr, currentTimeStr } = getCurrentDateTime()
          const taskDateStr = taskData.date || formatDateForDB(new Date())
          
          if (isTaskInPast(taskDateStr, taskData.endTime, todayStr, currentTimeStr)) {
            // Task is in the past - show confirmation dialog
            setPastDateTaskData({
              taskData,
              duration,
              taskId: task.id
            })
            setShowPastDateWarning(true)
            setIsLoading(false)
            setIsCreating(false)
            return
          }
          
          const { error: singleTaskError } = await supabase.from('task_schedule').insert({
            plan_id: null,
            user_id: user.id,
            task_id: task.id,
            day_index: 0,
            date: taskData.date,
            start_time: taskData.startTime,
            end_time: taskData.endTime,
            duration_minutes: duration,
            status: 'scheduled'
          })
          if (singleTaskError) throw singleTaskError
        }
      }

      console.log('✅ All tasks processed, calling onTaskCreated callback')
      try {
        onTaskCreated()
        console.log('✅ onTaskCreated called successfully')
      } catch (callbackErr) {
        console.error('❌ Error in onTaskCreated callback:', callbackErr)
        // Don't throw - we still want to close the modal
      }
      console.log('✅ Closing modal')
      setTimeout(() => onClose(), 100)
    } catch (err) {
      console.error('Error creating manual tasks:', err)
      
      // Parse database constraint violation errors and show user-friendly messages
      let errorMessage = 'Failed to create tasks'
      
      if (err instanceof Error) {
        errorMessage = err.message
        
        // Check for time order constraint violation (start_time must be before end_time)
        if (err.message.includes('task_schedule_time_order_check') || 
            err.message.includes('time_order_check')) {
          errorMessage = 'Invalid time range: end time must be after start time. For tasks that span midnight, they will be automatically split across two days.'
        }
        
        // Check for duration constraint violation
        else if (err.message.includes('tasks_duration_check') || 
                 err.message.includes('duration_check') ||
                 (err.message.includes('violates check constraint') && err.message.includes('duration'))) {
          errorMessage = `Task duration must be at least ${TASK_DURATION_MIN_MINUTES} minutes. Please adjust your start or end time to meet this requirement.`
        }
        
        // Check for other common constraint violations
        else if (err.message.includes('tasks_priority_check')) {
          errorMessage = 'Task priority must be between 1 and 4. Please select a valid priority.'
        }
        // Generic constraint violation
        else if (err.message.includes('violates check constraint') || (err as any).code === '23514') {
          // Try to extract more specific error message
          if (err.message.includes('time')) {
            errorMessage = 'Invalid time range detected. Please check your start and end times.'
          } else if (err.message.includes('duration')) {
            errorMessage = `Task duration must be at least ${TASK_DURATION_MIN_MINUTES} minutes. Please adjust your start or end time.`
          }
        }
      } else if (typeof err === 'object' && err !== null) {
        const errObj = err as any
        if (errObj.code === '23514') {
          if (errObj.message?.includes('time_order') || errObj.message?.includes('time')) {
            errorMessage = 'Invalid time range: end time must be after start time. For tasks that span midnight, they will be automatically split across two days.'
          } else if (errObj.message?.includes('duration')) {
            errorMessage = `Task duration must be at least ${TASK_DURATION_MIN_MINUTES} minutes. Please adjust your start or end time.`
          }
        }
      }
      
      setError(errorMessage)
    } finally {
      console.log('🧹 Finally block executing - clearing loading state')
      setIsLoading(false)
      setIsCreating(false)
      console.log('✅ Loading state cleared')
    }
  }

  // To-Do List handlers
  const handleTodoListAnalyze = async () => {
    // Validate tasks
    const validTasks = todoListTasks.filter(t => t.name.trim())
    if (validTasks.length === 0) {
      setTodoListError('Please add at least one task')
      return
    }

    setIsAnalyzingTodoList(true)
    setTodoListError(null)

    try {
      // Step 1: Analyze tasks with AI
      const response = await fetch('/api/tasks/todo-list-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: validTasks.map(t => ({
            name: t.name,
            priority: t.priority || 3
          }))
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze tasks')
      }

      const data = await response.json()
      if (!data.success || !data.tasks) {
        throw new Error('Invalid response from analysis service')
      }

      // Step 2: Get user's workday settings for scheduling
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in')
      }

      const { data: settings } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single()

      const preferences = settings?.preferences || {}
      const workdaySettings = preferences.workday || {}
      const workdayStartHour = workdaySettings.workday_start_hour || 9
      const workdayEndHour = workdaySettings.workday_end_hour || 17
      const lunchStartHour = workdaySettings.lunch_start_hour || 12
      const lunchEndHour = workdaySettings.lunch_end_hour || 13

      // Step 3: Get current schedule for the next week
      const today = new Date()
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + 7)

      const { data: existingSchedules } = await supabase
        .from('task_schedule')
        .select('date, start_time, end_time')
        .eq('user_id', user.id)
        .gte('date', formatDateForDB(today))
        .lte('date', formatDateForDB(endDate))
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      // Step 4: Generate suggested schedule times using scheduler
      const { timeBlockScheduler } = await import('@/lib/time-block-scheduler')
      
      const schedulerTasks = data.tasks.map((task: any, idx: number) => ({
        id: `temp-${idx}`,
        name: task.name,
        estimated_duration_minutes: task.duration_minutes,
        priority: task.priority,
        idx: idx + 1,
        complexity_score: (5 - task.priority) * 2
      }))

      const lunchMinutes = Math.max(0, lunchEndHour - lunchStartHour) * 60
      const baseWorkdayMinutes = Math.max(60, (workdayEndHour - workdayStartHour) * 60 - lunchMinutes)
      const weekdayMaxMinutes = Math.max(120, Math.round(baseWorkdayMinutes * 0.6))

      let weekendStartHourPref = Math.max(workdayStartHour, 9)
      let weekendEndHourPref = Math.min(workdayEndHour + 2, 20)
      if (weekendEndHourPref <= weekendStartHourPref) {
        weekendStartHourPref = workdayStartHour
        weekendEndHourPref = workdayEndHour
      }
      const weekendCapacityMinutes = Math.max(60, (weekendEndHourPref - weekendStartHourPref) * 60 - lunchMinutes)
      const weekendMaxMinutes = Math.min(480, Math.max(180, weekendCapacityMinutes))

      const schedulerBaseOptions = {
        workdayStartHour,
        workdayStartMinute: 0,
        workdayEndHour,
        lunchStartHour,
        lunchEndHour,
        allowWeekends: true,
        weekendStartHour: weekendStartHourPref,
        weekendStartMinute: 0,
        weekendEndHour: weekendEndHourPref,
        weekendLunchStartHour: lunchStartHour,
        weekendLunchEndHour: lunchEndHour,
        weekdayMaxMinutes,
        weekendMaxMinutes
      }

      const schedulerOptions = {
        ...schedulerBaseOptions,
        tasks: schedulerTasks,
        startDate: today,
        endDate: endDate,
        currentTime: today,
        existingSchedules: existingSchedules || []
      }

      const { placements } = timeBlockScheduler(schedulerOptions)

      // Step 5: Combine analyzed tasks with suggested schedule times
      const previewTasks = data.tasks.map((task: any, idx: number) => {
        const placement = placements.find(p => p.task_id === `temp-${idx}`)
        return {
          ...task,
          tempId: `temp-${idx}`,
          suggested_date: placement?.date,
          suggested_time: placement?.start_time,
          suggested_end_time: placement?.end_time
        }
      })

      setTodoListPreview(previewTasks)
    } catch (err) {
      console.error('Error analyzing todo list:', err)
      setTodoListError(err instanceof Error ? err.message : 'Failed to analyze tasks')
    } finally {
      setIsAnalyzingTodoList(false)
    }
  }

  const handleTodoListSchedule = async () => {
    if (!todoListPreview || todoListPreview.length === 0) {
      setTodoListError('Please analyze tasks first')
      return
    }

    setIsLoading(true)
    setTodoListError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create tasks')
      }

      // Get user's workday settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single()

      const preferences = settings?.preferences || {}
      const workdaySettings = preferences.workday || {}
      const workdayStartHour = workdaySettings.workday_start_hour || 9
      const workdayEndHour = workdaySettings.workday_end_hour || 17
      const lunchStartHour = workdaySettings.lunch_start_hour || 12
      const lunchEndHour = workdaySettings.lunch_end_hour || 13

      // Get current schedule for the next week to avoid conflicts
      const today = new Date()
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + 7)

      const { data: existingSchedules } = await supabase
        .from('task_schedule')
        .select('date, start_time, end_time')
        .eq('user_id', user.id)
        .gte('date', formatDateForDB(today))
        .lte('date', formatDateForDB(endDate))
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      // Create tasks first (using preview data which may have been edited)
      const createdTasks = []
      for (const previewTask of todoListPreview) {
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .insert({
            plan_id: null,
            user_id: user.id,
            name: previewTask.name,
            details: previewTask.details || '',
            estimated_duration_minutes: previewTask.duration_minutes,
            priority: previewTask.priority || 3,
            category: null,
            idx: null,
            assigned_to_plan: false
          })
          .select()
          .single()

        if (taskError) throw taskError
        createdTasks.push({ ...task, previewTask })
      }

      // Use time-block-scheduler to schedule tasks (re-schedule with actual task IDs)
      const { timeBlockScheduler } = await import('@/lib/time-block-scheduler')
      
      const schedulerTasks = createdTasks.map((task, idx) => ({
        id: task.id,
        name: task.name,
        estimated_duration_minutes: task.estimated_duration_minutes,
        priority: task.priority,
        idx: idx + 1,
        complexity_score: (5 - task.priority) * 2
      }))

      const lunchMinutes = Math.max(0, lunchEndHour - lunchStartHour) * 60
      const baseWorkdayMinutes = Math.max(60, (workdayEndHour - workdayStartHour) * 60 - lunchMinutes)
      const weekdayMaxMinutes = Math.max(120, Math.round(baseWorkdayMinutes * 0.6))

      let weekendStartHourPref = Math.max(workdayStartHour, 9)
      let weekendEndHourPref = Math.min(workdayEndHour + 2, 20)
      if (weekendEndHourPref <= weekendStartHourPref) {
        weekendStartHourPref = workdayStartHour
        weekendEndHourPref = workdayEndHour
      }
      const weekendCapacityMinutes = Math.max(60, (weekendEndHourPref - weekendStartHourPref) * 60 - lunchMinutes)
      const weekendMaxMinutes = Math.min(480, Math.max(180, weekendCapacityMinutes))

      const schedulerBaseOptions = {
        workdayStartHour,
        workdayStartMinute: 0,
        workdayEndHour,
        lunchStartHour,
        lunchEndHour,
        allowWeekends: true,
        weekendStartHour: weekendStartHourPref,
        weekendStartMinute: 0,
        weekendEndHour: weekendEndHourPref,
        weekendLunchStartHour: lunchStartHour,
        weekendLunchEndHour: lunchEndHour,
        weekdayMaxMinutes,
        weekendMaxMinutes
      }

      const schedulerOptions = {
        ...schedulerBaseOptions,
        tasks: schedulerTasks,
        startDate: today,
        endDate: endDate,
        currentTime: today,
        existingSchedules: existingSchedules || []
      }

      const { placements } = timeBlockScheduler(schedulerOptions)

      // Create schedule entries
      if (placements.length > 0) {
        const scheduleEntries = placements.map(placement => ({
          plan_id: null,
          user_id: user.id,
          task_id: placement.task_id,
          day_index: placement.day_index,
          date: placement.date,
          start_time: placement.start_time,
          end_time: placement.end_time,
          duration_minutes: placement.duration_minutes,
          status: 'scheduled'
        }))

        const { error: scheduleError } = await supabase
          .from('task_schedule')
          .insert(scheduleEntries)

        if (scheduleError) throw scheduleError
      }

      onTaskCreated()
      setTimeout(() => onClose(), 100)
    } catch (err) {
      console.error('Error scheduling todo list:', err)
      setTodoListError(err instanceof Error ? err.message : 'Failed to schedule tasks')
    } finally {
      setIsLoading(false)
    }
  }

  // AI generation handlers
  const handleAIGenerate = async () => {
    if (!aiDescription.trim()) {
      setError('Please describe the task you want to create')
      return
    }

    // Extract day of week from selectedDate if available
    let selectedDayOfWeek: string | undefined = undefined
    if (selectedDate) {
      const [year, month, day] = selectedDate.split('-').map(Number)
      const dateObj = new Date(year, month - 1, day)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      selectedDayOfWeek = dayNames[dateObj.getDay()]
    }

    // Use the selected time from the field if provided, otherwise use selectedTime prop
    const timeToUse = aiStartTime || selectedTime || undefined

    // Build enhanced description with day context if available
    let enhancedDescription = aiDescription
    if (selectedDayOfWeek && !aiDescription.toLowerCase().includes(selectedDayOfWeek.toLowerCase())) {
      // Only add day context if user hasn't already mentioned it
      const dayMentions = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'today', 'tomorrow']
      const hasDayMention = dayMentions.some(day => aiDescription.toLowerCase().includes(day))
      if (!hasDayMention) {
        enhancedDescription = `${aiDescription} (preferred day: ${selectedDayOfWeek})`
      }
    }

    // Ensure selectedDate is passed when user selected a time slot
    // selectedDate prop takes precedence over formData.date
    const dateToUse = selectedDate && selectedDate.trim() ? selectedDate : undefined
    
    const result = await generateTask({
      description: enhancedDescription,
      constrainedDate: dateToUse,
      constrainedTime: timeToUse,
      timeFormat: timeFormat
    })

    if (result) {
      // Check if this is a recurring task follow-up
      if ('isRecurring' in result && result.isRecurring && 'followUpQuestion' in result) {
        setAiFollowUp(result)
        setShowFollowUp(true)
        setError(null)
      } else {
        // Regular task or recurring task with full details
        setAiGeneratedTask(result)
        setShowAIPreview(true)
        setError(null)
      }
    }
  }

  const handleFollowUpSubmit = async () => {
    // Validate that either indefinite is selected or end date is provided
    if (!followUpIsIndefinite && !followUpEndDate.trim()) {
      setError('Please either select "Indefinite" or provide an end date')
      return
    }

    // Build the follow-up response combining duration and end date info
    let followUpResponse = ''
    
    // Include duration if provided by user, or use inferred duration if available
    if (followUpDuration.trim()) {
      followUpResponse += `${followUpDuration.trim()} each session`
    } else if (aiFollowUp.inferredDuration) {
      // Use inferred duration from AI (for quick tasks)
      followUpResponse += `${aiFollowUp.inferredDuration} minutes each session`
    }
    
    // Add indefinite or end date
    if (followUpIsIndefinite) {
      if (followUpResponse) followUpResponse += ', indefinite'
      else followUpResponse = 'indefinite'
    } else if (followUpEndDate.trim()) {
      // Format date as YYYY-MM-DD for parsing
      const dateStr = followUpEndDate.trim()
      if (followUpResponse) followUpResponse += `, until ${dateStr}`
      else followUpResponse = `until ${dateStr}`
    }

    const result = await generateTask({
      description: followUpResponse,
      followUpData: aiFollowUp
    })

    if (result) {
      setAiGeneratedTask(result)
      setShowFollowUp(false)
      setShowAIPreview(true)
      setError(null)
    }
  }

  const handleAIApply = async () => {
    if (!aiGeneratedTask) return
    try {
      setIsLoading(true)
      setIsCreating(true)
      setError(null)

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create tasks')
      }

      const taskName = aiGeneratedTask.name
      const taskDetails = aiGeneratedTask.details || ''
      // Prioritize selectedDate if user explicitly selected a time slot
      // Otherwise use AI's suggested date
      const taskDate = selectedDate || aiGeneratedTask.suggested_date
      // Prioritize selectedTime if user explicitly selected a time slot
      const taskStart = selectedTime || aiGeneratedTask.suggested_time
      
      // Calculate end time: use AI's suggestion if available, otherwise calculate from start time and duration
      let taskEnd = aiGeneratedTask.suggested_end_time
      if (!taskEnd && taskStart) {
        // Calculate end time from start time and duration
        const duration = aiGeneratedTask.duration_minutes || 30
        const [startHour, startMinute] = taskStart.split(':').map(Number)
        const startMinutes = startHour * 60 + startMinute
        const endMinutes = startMinutes + duration
        const endHour = Math.floor(endMinutes / 60) % 24
        const endMinute = endMinutes % 60
        taskEnd = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
      }

      // Calculate duration
      const duration = calculateDuration(taskStart, taskEnd)
      if (duration <= 0) {
        throw new Error('Invalid AI time range')
      }

      // Create task (free mode)
      const aiPriority = aiGeneratedTask.priority || 3 // Default to 3 if not provided
      const isRecurring = aiGeneratedTask.isRecurring || false
      const isIndefinite = aiGeneratedTask.isIndefinite || false
      
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          plan_id: null,
          user_id: user.id,
          name: taskName,
          details: taskDetails,
          estimated_duration_minutes: duration,
          priority: aiPriority,
          category: null,
          idx: null,
          assigned_to_plan: false,
          is_recurring: isRecurring,
          is_indefinite: isRecurring ? isIndefinite : false,
          recurrence_days: isRecurring ? (aiGeneratedTask.recurrenceDays || []) : null,
          recurrence_start_date: isRecurring && !isIndefinite ? (aiGeneratedTask.recurrenceStartDate || null) : null,
          recurrence_end_date: isRecurring && !isIndefinite ? (aiGeneratedTask.recurrenceEndDate || null) : null
        })
        .select('id')
        .single()

      if (taskError) throw taskError

      // For recurring tasks, skip schedule creation (API will synthesize occurrences)
      if (isRecurring && isIndefinite) {
        // Trigger UI refresh
        onTaskCreated()
        setTimeout(() => onClose(), 50)
        return
      }

      // For non-recurring or date-range recurring, create schedule entries
      if (!isRecurring) {
        // Single task schedule entry
        const { error: scheduleError } = await supabase
          .from('task_schedule')
          .insert({
            plan_id: null,
            user_id: user.id,
            task_id: task.id,
            day_index: 0,
            date: taskDate,
            start_time: taskStart,
            end_time: taskEnd,
            duration_minutes: duration,
            status: 'scheduled'
          })

        if (scheduleError) throw scheduleError
      } else if (isRecurring && !isIndefinite && aiGeneratedTask.recurrenceDays && aiGeneratedTask.recurrenceStartDate && aiGeneratedTask.recurrenceEndDate) {
        // Recurring with date range - generate schedule entries
        // (Similar logic to manual recurring tasks)
        const scheduleEntries = []
        const startDate = new Date(aiGeneratedTask.recurrenceStartDate)
        const endDate = new Date(aiGeneratedTask.recurrenceEndDate)
        const weekStart = new Date(startDate)
        weekStart.setDate(startDate.getDate() - startDate.getDay()) // Start of week (Sunday)
        
        const diffWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
        const weeksToGenerate = Math.max(1, diffWeeks)
        
        for (let week = 0; week < weeksToGenerate; week++) {
          const currentWeekStart = new Date(weekStart)
          currentWeekStart.setDate(weekStart.getDate() + (week * 7))
          
          for (let i = 0; i < 7; i++) {
            const currentDate = new Date(currentWeekStart)
            currentDate.setDate(currentWeekStart.getDate() + i)
            const dayOfWeek = currentDate.getDay()
            const taskDateStr = currentDate.toISOString().split('T')[0]
            
            if (aiGeneratedTask.recurrenceDays.includes(dayOfWeek) && 
                taskDateStr >= aiGeneratedTask.recurrenceStartDate && 
                taskDateStr <= aiGeneratedTask.recurrenceEndDate) {
              scheduleEntries.push({
                plan_id: null,
                user_id: user.id,
                task_id: task.id,
                day_index: i + (week * 7),
                date: taskDateStr,
                start_time: taskStart,
                end_time: taskEnd,
                duration_minutes: duration,
                status: 'scheduled'
              })
            }
          }
        }
        
        if (scheduleEntries.length > 0) {
          const { error: scheduleError } = await supabase
            .from('task_schedule')
            .insert(scheduleEntries)
          
          if (scheduleError) throw scheduleError
        }
        
        // Trigger UI refresh
        onTaskCreated()
        setTimeout(() => onClose(), 50)
        return
      }

      // Optimistic task for immediate UI
      onTaskCreated({
        schedule_id: `temp-${Date.now()}`,
        task_id: task.id,
        name: taskName,
        details: taskDetails,
        priority: aiPriority,
        estimated_duration_minutes: duration,
        complexity_score: null,
        start_time: taskStart,
        end_time: taskEnd,
        duration_minutes: duration,
        day_index: 0,
        date: taskDate,
        completed: false,
      })

      // Close modal
      onClose()
    } catch (e: any) {
      console.error('Error creating AI task:', e)
      setError(e.message || 'Failed to create task')
    } finally {
      setIsLoading(false)
      setIsCreating(false)
    }
  }

  const handleAIModeToggle = (enabled: boolean) => {
    setMode(enabled ? 'ai' : 'manual')
    if (enabled) {
      setShowAIPreview(false)
      setAiGeneratedTask(null)
      clearError()
    }
  }

  const handleEditAITask = () => {
    setEditableAITask({ ...aiGeneratedTask })
    setIsEditingAITask(true)
  }

  const handleSaveAITaskEdit = () => {
    setAiGeneratedTask(editableAITask)
    setIsEditingAITask(false)
  }

  const handleCancelAITaskEdit = () => {
    setEditableAITask(null)
    setIsEditingAITask(false)
  }

  const handleAITaskFieldChange = (field: string, value: any) => {
    setEditableAITask((prev: any) => ({ ...prev, [field]: value }))
  }

  // Validation logic for recurring tasks
  const isRecurringTaskValid = useMemo(() => {
    if (!isRecurring) return true // Non-recurring tasks are always valid
    
    // If recurring, check if indefinite is selected OR both dates are provided
    if (isIndefinite) return true // Indefinite recurring tasks are valid
    
    // For non-indefinite recurring tasks, both start and end dates are required
    return formData.recurrenceStartDate && formData.recurrenceEndDate
  }, [isRecurring, isIndefinite, formData.recurrenceStartDate, formData.recurrenceEndDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setIsCreating(true)
    setError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create tasks')
      }

      // Validate that both start and end times are provided
      if (!formData.startTime || !formData.endTime) {
        throw new Error('Please provide both start and end times.')
      }

      // Check for cross-day task
      if (isCrossDayTask) {
        // Show warning dialog for cross-day tasks
        setCrossDayTaskData({
          startTime: formData.startTime,
          endTime: formData.endTime,
          // If recurring, the specific date may be cleared; use today for display only
          date: formData.isRecurring && !formData.date ? formatDateForDB(new Date()) : formData.date,
          name: formData.name,
          details: formData.details,
          priority: formData.priority || 3,
          isRecurring: formData.isRecurring,
          isIndefinite: formData.isIndefinite,
          recurrenceDays: formData.recurrenceDays,
          recurrenceStartDate: formData.recurrenceStartDate,
          recurrenceEndDate: formData.recurrenceEndDate
        })
        setShowCrossDayWarning(true)
        setIsLoading(false)
        setIsCreating(false)
        return
      }

      // Validate that end time is after start time (for same-day tasks)
      if (!isCrossDayTask && calculatedDuration <= 0) {
        throw new Error('End time must be after start time.')
      }

      const finalEndTime = formData.endTime

      // Check for past date/time for single non-recurring tasks
      if (!formData.isRecurring && formData.date) {
        const { todayStr, currentTimeStr } = getCurrentDateTime()
        const taskDateStr = formData.date
        
        if (isTaskInPast(taskDateStr, finalEndTime, todayStr, currentTimeStr)) {
          // Task is in the past - show confirmation dialog
          setPastDateTaskData({
            formData,
            calculatedDuration,
            finalEndTime
          })
          setShowPastDateWarning(true)
          setIsLoading(false)
          setIsCreating(false)
          return
        }
      }

      // Validation for recurring tasks
      if (formData.isRecurring) {
        if (formData.recurrenceDays.length === 0) {
          throw new Error('Please select at least one day for recurring tasks')
        }
        
        if (!formData.isIndefinite) {
          if (!formData.recurrenceStartDate || !formData.recurrenceEndDate) {
            throw new Error('Please select start and end dates for recurring tasks')
          }
          
          if (new Date(formData.recurrenceStartDate) >= new Date(formData.recurrenceEndDate)) {
            throw new Error('End date must be after start date')
          }
        }
      }

      // For free mode tasks, we don't need a plan - set planId to null
      const planId: string | null = null

      // Create the task
      // Insert with retry against schema cache for default_* columns
      const baseInsert2 = {
        plan_id: planId as string | null,
          user_id: user.id,
          name: formData.name,
          details: formData.details,
          estimated_duration_minutes: calculatedDuration,
          priority: formData.priority || 3, // Use selected priority, default to 3
        category: null as any,
        idx: null as any,
        assigned_to_plan: false,
          is_recurring: formData.isRecurring,
          is_indefinite: formData.isRecurring ? formData.isIndefinite : false,
          recurrence_days: formData.isRecurring ? formData.recurrenceDays : null,
          recurrence_start_date: formData.isRecurring && !formData.isIndefinite ? formData.recurrenceStartDate : null,
          recurrence_end_date: formData.isRecurring && !formData.isIndefinite ? formData.recurrenceEndDate : null
      }
      const withDefaults2 = {
        ...baseInsert2,
        default_start_time: formData.isRecurring && formData.isIndefinite ? formData.startTime : null,
        default_end_time: formData.isRecurring && formData.isIndefinite ? finalEndTime : null
      }

      let taskRes: any | null = null
      try {
        const res = await supabase.from('tasks').insert(withDefaults2).select('id').single()
        if (res.error) throw res.error
        taskRes = res.data
      } catch (err: any) {
        const msg: string = err?.message || ''
        if (msg.includes('default_start_time') || msg.includes('default_end_time')) {
          const res2 = await supabase.from('tasks').insert(baseInsert2).select('id').single()
          if (res2.error) throw res2.error
          taskRes = res2.data
        } else {
          console.error('Error creating task:', err)
          throw err
      }
      }
      const task = taskRes

      // Create task schedule entries
      if (formData.isRecurring && formData.recurrenceDays.length > 0) {
        // For indefinite recurring, do not insert schedule rows — API will synthesize occurrences
        if (formData.isIndefinite) {
          // Optimistic: let realtime/API refresh show items; close immediately
          onTaskCreated()
          setTimeout(() => onClose(), 50)
          return
        }
        // Use the current week start from the schedule page if available
        let weekStart: Date
        if (currentWeekStart) {
          weekStart = new Date(currentWeekStart)
        } else {
          // Fallback: if no date selected (recurring), base on today; otherwise selected date
          const base = formData.date ? new Date(formData.date) : new Date()
          weekStart = new Date(base)
          weekStart.setDate(base.getDate() - base.getDay()) // Start of week (Sunday)
        }
        
        console.log('Creating recurring task:', {
          selectedDate: formData.date,
          weekStart: weekStart.toISOString().split('T')[0],
          recurrenceDays: formData.recurrenceDays,
          isIndefinite: formData.isIndefinite,
          recurrenceStartDate: formData.recurrenceStartDate,
          recurrenceEndDate: formData.recurrenceEndDate
        })
        
        const scheduleEntries = []
        
        // Determine how many weeks to generate
        let weeksToGenerate = 1 // Default to current week only
        
        if (formData.isIndefinite) {
          // Limit indefinite pre-generation to the current week only; API can extend on demand
          weeksToGenerate = 1
        } else if (formData.recurrenceStartDate && formData.recurrenceEndDate) {
          // Calculate weeks between start and end date
          const startDate = new Date(formData.recurrenceStartDate)
          const endDate = new Date(formData.recurrenceEndDate)
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
          const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
          weeksToGenerate = Math.max(1, diffWeeks)
        }
        
        // Get current date/time for filtering past tasks
        const { todayStr, currentTimeStr } = getCurrentDateTime()
        
        // Generate schedule entries for the determined number of weeks
        for (let week = 0; week < weeksToGenerate; week++) {
          const currentWeekStart = new Date(weekStart)
          currentWeekStart.setDate(weekStart.getDate() + (week * 7))
          
          for (let i = 0; i < 7; i++) {
            const currentDate = new Date(currentWeekStart)
            currentDate.setDate(currentWeekStart.getDate() + i)
            const dayOfWeek = currentDate.getDay()
            const taskDateStr = formatDateForDB(currentDate)
            
            // Check if this day should have the task
            if (formData.recurrenceDays.includes(dayOfWeek)) {
              // For indefinite tasks, always include
              // For date range tasks, check if date is within range
              let shouldInclude: boolean = formData.isIndefinite
              
              if (!formData.isIndefinite && formData.recurrenceStartDate && formData.recurrenceEndDate) {
                shouldInclude = taskDateStr >= formData.recurrenceStartDate && taskDateStr <= formData.recurrenceEndDate
              }
              
              if (shouldInclude) {
                // Skip past dates/times
                if (shouldSkipPastTaskInstance(taskDateStr, finalEndTime, todayStr, currentTimeStr)) {
                  continue
                }
                
                scheduleEntries.push({
                  plan_id: planId, // null for free mode tasks
                  user_id: user.id,
                  task_id: task.id,
                  day_index: i + (week * 7),
                  date: taskDateStr,
                  start_time: formData.startTime,
                  end_time: finalEndTime,
                  duration_minutes: calculatedDuration,
                  status: 'scheduled'
                })
              }
            }
          }
        }
        
        console.log('Generated schedule entries:', scheduleEntries)
        
        if (scheduleEntries.length > 0) {
          const { error: scheduleError } = await supabase
            .from('task_schedule')
            .insert(scheduleEntries)

          if (scheduleError) {
            console.error('Error creating recurring task schedules:', scheduleError)
            throw scheduleError
          }
        }

        // Trigger UI refresh after recurring creation
        onTaskCreated()
        setTimeout(() => onClose(), 50)
        return
      } else {
        // Create single task schedule entry for non-recurring tasks
        console.log('Creating task schedule entry:', {
          plan_id: planId,
          user_id: user.id,
          task_id: task.id,
          day_index: 0,
          date: formData.date,
          start_time: formData.startTime,
          end_time: finalEndTime,
          duration_minutes: calculatedDuration
        })
        
        const { error: scheduleError } = await supabase
          .from('task_schedule')
          .insert({
            plan_id: planId, // null for free mode tasks
            user_id: user.id,
            task_id: task.id,
            day_index: 0, // Free mode tasks get day index 0
            date: formData.date,
            start_time: formData.startTime,
            end_time: finalEndTime,
            duration_minutes: calculatedDuration,
            status: 'scheduled'
          })

        if (scheduleError) {
          console.error('Error creating task schedule:', scheduleError)
          throw scheduleError
        }
        
        console.log('Task schedule entry created successfully')
      }

      // Reset form and close modal
      setFormData({
        name: '',
        details: '',
        startTime: selectedTime || '', // Use selectedTime if provided, otherwise empty
        endTime: '',
        date: selectedDate || '',
        priority: 3, // Reset to default Medium
        isRecurring: false,
        recurrenceDays: [],
        recurrenceInterval: 1,
        recurrenceStartDate: '',
        recurrenceEndDate: '',
        isIndefinite: false
      })
      setIsRecurring(false)
      setIsIndefinite(false)
      
      // Prepare task data for optimistic update (matching API response structure)
      const taskData = {
        schedule_id: `temp-${Date.now()}`, // Temporary ID for optimistic update
        task_id: task.id,
        name: formData.name,
        details: formData.details,
        priority: formData.priority || 3, // Use selected priority
        estimated_duration_minutes: calculatedDuration,
        complexity_score: null,
        start_time: formData.startTime,
        end_time: finalEndTime,
        duration_minutes: calculatedDuration,
        day_index: 0,
        date: formData.date,
        completed: false,
        is_recurring: formData.isRecurring,
        is_indefinite: formData.isIndefinite,
        recurrence_days: formData.recurrenceDays,
        recurrence_start_date: formData.recurrenceStartDate,
        recurrence_end_date: formData.recurrenceEndDate
      }
      
      // Call the callback to refresh the schedule view with task data
      onTaskCreated(taskData)
      
      // Close modal after a brief delay to ensure the callback completes
      setTimeout(() => {
        onClose()
      }, 100)
      
    } catch (error: any) {
      console.error('Error creating task:', error)
      setError(error.message || 'Failed to create task')
    } finally {
      setIsLoading(false)
      setIsCreating(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="create-task-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleCloseAttempt}
        >
          <motion.div
            key="create-task-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`${
              currentTheme === 'dark' 
                ? 'bg-[#0a0a0a]/95 border-white/10' 
                : 'bg-white/95 border-gray-200'
            } border rounded-xl shadow-2xl backdrop-blur-md w-full max-w-md overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${
              currentTheme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <Plus className={`w-5 h-5 ${
                  currentTheme === 'dark' ? 'text-[#ff7f00]' : 'text-orange-600'
                }`} />
                <h2 className={`text-lg font-semibold ${
                  currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
                }`}>
                  Create New Task
                </h2>
              </div>
              
              {/* Mode Selection Dropdown */}
              <div className="flex items-center gap-2">
                {isAIMode && (
                  <ModeSelectDropdown 
                    currentMode={mode}
                    onModeChange={(newMode) => {
                      setMode(newMode)
                      if (newMode === 'todo-list') {
                        // Clear selectedTime context when switching to To-Do List mode
                        setAiStartTime('')
                      }
                    }}
                  />
                )}
                
                <button
                  onClick={handleCloseAttempt}
                  className={`p-2 rounded-lg transition-colors ${
                    currentTheme === 'dark'
                      ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form 
              id="create-task-form" 
              onSubmit={(e) => {
                e.preventDefault()
                if (mode === 'manual') {
                  handleManualTasksSubmit(e)
                } else if (isAIMode) {
                  handleAIGenerate()
                }
              }} 
              className="p-6 space-y-4"
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/50"
                >
                  <p className="text-sm text-red-500">{error}</p>
                </motion.div>
              )}


              {/* AI Mode Content */}
              {isAIMode && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {aiCreditsBanner && (
                    <div>{aiCreditsBanner}</div>
                  )}

                  {/* Start Time Field - Only show when time slot is selected */}
                  {selectedTime && (
                    <div>
                      <label htmlFor="ai-start-time" className={`text-sm font-medium block mb-2 ${
                        currentTheme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                      }`}>
                        Start Time
                      </label>
                      <input
                        id="ai-start-time"
                        type="time"
                        value={aiStartTime}
                        onChange={(e) => setAiStartTime(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#ff7f00] ${
                          currentTheme === 'dark'
                            ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>
                  )}

                  {/* AI Description Input */}
                  <div>
                    <label htmlFor="ai-description" className={`text-sm font-medium block mb-2 ${
                      currentTheme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                    }`}>
                      Describe your task *
                    </label>
                    <textarea
                      id="ai-description"
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder="e.g., 'Take out the trash on Thursday at 5pm' or 'Remember to call mom tomorrow morning'"
                      rows={3}
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#ff7f00] resize-none ${
                        currentTheme === 'dark'
                          ? 'bg-white/5 border-white/10 text-[#d7d2cb] placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>


                  {/* Follow-up Question */}
                  {showFollowUp && aiFollowUp && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg border border-[#ff7f00]/30 bg-[#ff7f00]/5"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#ff7f00]">Recurring Task Detected</span>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-[#d7d2cb] mb-1">Task: {aiFollowUp.taskName}</div>
                          <div className="text-sm text-[#d7d2cb]/80">Pattern: {aiFollowUp.detectedPattern}</div>
                          {!aiFollowUp.needsDuration && aiFollowUp.inferredDuration && (
                            <div className="text-xs text-[#ff7f00]/80 mt-2">
                              Duration: {aiFollowUp.inferredDuration} minutes (automatically inferred)
                            </div>
                          )}
                        </div>
                        
                        {/* Duration Input - Only show if duration was not inferred */}
                        {aiFollowUp.needsDuration && (
                          <div>
                            <label htmlFor="follow-up-duration" className={`text-sm font-medium block mb-2 ${
                              currentTheme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                            }`}>
                              How long should each session be? {!aiFollowUp.needsDuration ? '(optional)' : '*'}
                            </label>
                            <input
                              id="follow-up-duration"
                              type="text"
                              value={followUpDuration}
                              onChange={(e) => setFollowUpDuration(e.target.value)}
                              placeholder="e.g., '5 minutes', '30 minutes', '1 hour'"
                              className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#ff7f00] ${
                                currentTheme === 'dark'
                                  ? 'bg-white/5 border-white/10 text-[#d7d2cb] placeholder-gray-400'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                            />
                          </div>
                        )}
                        
                        {/* End Date / Indefinite Selection */}
                        <div>
                          <label className={`text-sm font-medium block mb-2 ${
                            currentTheme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                          }`}>
                            Should this continue indefinitely or do you have an end date in mind? *
                          </label>
                          
                          <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className="relative">
                                <input
                                  type="radio"
                                  name="recurring-end"
                                  checked={followUpIsIndefinite}
                                  onChange={() => {
                                    setFollowUpIsIndefinite(true)
                                    setFollowUpEndDate('')
                                  }}
                                  className="sr-only"
                                />
                                <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                                  followUpIsIndefinite
                                    ? 'bg-[#ff7f00] border-[#ff7f00]'
                                    : currentTheme === 'dark'
                                      ? 'bg-transparent border-white/20 group-hover:border-white/40'
                                      : 'bg-transparent border-gray-300 group-hover:border-gray-400'
                                }`}></div>
                              </div>
                              <span className="text-sm text-[#d7d2cb]">Indefinite (no end date)</span>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className="relative">
                                <input
                                  type="radio"
                                  name="recurring-end"
                                  checked={!followUpIsIndefinite}
                                  onChange={() => setFollowUpIsIndefinite(false)}
                                  className="sr-only"
                                />
                                <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                                  !followUpIsIndefinite
                                    ? 'bg-[#ff7f00] border-[#ff7f00]'
                                    : currentTheme === 'dark'
                                      ? 'bg-transparent border-white/20 group-hover:border-white/40'
                                      : 'bg-transparent border-gray-300 group-hover:border-gray-400'
                                }`}></div>
                              </div>
                              <span className="text-sm text-[#d7d2cb]">End date:</span>
                              <input
                                type="date"
                                value={followUpEndDate}
                                onChange={(e) => setFollowUpEndDate(e.target.value)}
                                disabled={followUpIsIndefinite}
                                className={`px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7f00] ${
                                  followUpIsIndefinite 
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                                } ${
                                  currentTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </label>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={handleFollowUpSubmit}
                            disabled={isAILoading || (!followUpIsIndefinite && !followUpEndDate.trim())}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isAILoading || (!followUpIsIndefinite && !followUpEndDate.trim())
                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                : 'bg-[#ff7f00] hover:bg-[#ff8c1a] text-white'
                            } disabled:opacity-50`}
                          >
                            {isAILoading ? 'Processing...' : 'Continue'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowFollowUp(false)
                              setAiFollowUp(null)
                              setFollowUpDuration('')
                              setFollowUpEndDate('')
                              setFollowUpIsIndefinite(false)
                            }}
                            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-[#d7d2cb] rounded-lg text-sm font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* AI Error Display */}
                  {aiError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/50"
                    >
                      <p className="text-sm text-red-500">{aiError}</p>
                    </motion.div>
                  )}

                  {/* AI Preview */}
                  {showAIPreview && aiGeneratedTask && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg border border-[#ff7f00]/30 bg-[#ff7f00]/5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#ff7f00]">AI Generated Task</span>
                          </div>
                          {!isEditingAITask && (
                            <button
                              type="button"
                              onClick={handleEditAITask}
                              className="text-xs text-[#d7d2cb]/60 hover:text-[#d7d2cb] underline"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        
                        {isEditingAITask ? (
                          <div className="space-y-3">
                            {/* Editable Task Name */}
                            <div>
                              <label className="text-sm font-medium text-[#d7d2cb] mb-1 block">Task Name</label>
                              <input
                                type="text"
                                value={editableAITask.name}
                                onChange={(e) => handleAITaskFieldChange('name', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border bg-white/5 border-white/10 text-[#d7d2cb] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
                              />
                            </div>
                            
                            {/* Editable Details */}
                            <div>
                              <label className="text-sm font-medium text-[#d7d2cb] mb-1 block">Details</label>
                              <textarea
                                value={editableAITask.details || ''}
                                onChange={(e) => handleAITaskFieldChange('details', e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border bg-white/5 border-white/10 text-[#d7d2cb] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff7f00] resize-none"
                                placeholder="Enter task details..."
                              />
                            </div>
                            
                            {/* Editable Date */}
                            <div>
                              <label className="text-sm font-medium text-[#d7d2cb] mb-1 block">Date</label>
                              <input
                                type="date"
                                value={editableAITask.suggested_date}
                                onChange={(e) => handleAITaskFieldChange('suggested_date', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border bg-white/5 border-white/10 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
                              />
                            </div>
                            
                            {/* Editable Time */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb] mb-1 block">Start Time</label>
                                <input
                                  type="time"
                                  value={editableAITask.suggested_time}
                                  onChange={(e) => {
                                    const startTime = e.target.value
                                    const endTime = editableAITask.suggested_end_time
                                    
                                    // Calculate duration based on start and end times
                                    if (startTime && endTime) {
                                      const [startHour, startMinute] = startTime.split(':').map(Number)
                                      const [endHour, endMinute] = endTime.split(':').map(Number)
                                      const startMinutes = startHour * 60 + startMinute
                                      const endMinutes = endHour * 60 + endMinute
                                      let duration = endMinutes - startMinutes
                                      
                                      // Handle case where end time is next day
                                      if (duration < 0) {
                                        duration += 24 * 60 // Add 24 hours
                                      }
                                      
                                      handleAITaskFieldChange('suggested_time', startTime)
                                      handleAITaskFieldChange('duration_minutes', Math.max(5, duration))
                                    } else {
                                      handleAITaskFieldChange('suggested_time', startTime)
                                    }
                                  }}
                                  className="w-full px-3 py-2 rounded-lg border bg-white/5 border-white/10 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-[#d7d2cb] mb-1 block">End Time</label>
                                <input
                                  type="time"
                                  value={editableAITask.suggested_end_time}
                                  onChange={(e) => {
                                    const endTime = e.target.value
                                    const startTime = editableAITask.suggested_time
                                    
                                    // Calculate duration based on start and end times
                                    if (startTime && endTime) {
                                      const [startHour, startMinute] = startTime.split(':').map(Number)
                                      const [endHour, endMinute] = endTime.split(':').map(Number)
                                      const startMinutes = startHour * 60 + startMinute
                                      const endMinutes = endHour * 60 + endMinute
                                      let duration = endMinutes - startMinutes
                                      
                                      // Handle case where end time is next day
                                      if (duration < 0) {
                                        duration += 24 * 60 // Add 24 hours
                                      }
                                      
                                      handleAITaskFieldChange('suggested_end_time', endTime)
                                      handleAITaskFieldChange('duration_minutes', Math.max(5, duration))
                                    } else {
                                      handleAITaskFieldChange('suggested_end_time', endTime)
                                    }
                                  }}
                                  className="w-full px-3 py-2 rounded-lg border bg-white/5 border-white/10 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]"
                                />
                              </div>
                            </div>
                            
                            {/* Duration Display (Read-only) */}
                            <div>
                              <label className="text-sm font-medium text-[#d7d2cb] mb-1 block">Duration</label>
                              <div className="px-3 py-2 rounded-lg border bg-white/5 border-white/10 text-[#d7d2cb]">
                                {formatDuration(editableAITask.duration_minutes || 0)}
                              </div>
                            </div>
                            
                            {/* Edit Actions */}
                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={handleSaveAITaskEdit}
                                className="flex-1 px-3 py-2 bg-[#ff7f00] hover:bg-[#ff8c1a] text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                Save Changes
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelAITaskEdit}
                                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-[#d7d2cb] rounded-lg text-sm font-medium transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Read-only Task Name */}
                            <div>
                              <div className="text-sm font-medium text-[#d7d2cb] mb-1">Task Name</div>
                              <div className="text-[#d7d2cb]">{aiGeneratedTask.name}</div>
                            </div>
                            
                            {/* Read-only Details */}
                            {aiGeneratedTask.details && (
                              <div>
                                <div className="text-sm font-medium text-[#d7d2cb] mb-1">Details</div>
                                <div className="text-[#d7d2cb]/80 text-sm">{convertUrlsToLinks(aiGeneratedTask.details)}</div>
                              </div>
                            )}
                            
                            {/* Read-only Date and Time */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-sm font-medium text-[#d7d2cb] mb-1">Date</div>
                                <div className="text-[#d7d2cb]">{aiGeneratedTask.suggested_date}</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-[#d7d2cb] mb-1">Time</div>
                                <div className="text-[#d7d2cb]">
                                  {(() => {
                                    // Format time for display, ensuring proper AM/PM conversion
                                    const formatTimeDisplay = (time24: string) => {
                                      if (!time24) return ''
                                      // If already in display format (has AM/PM), return as-is
                                      if (time24.includes('AM') || time24.includes('PM')) return time24
                                      // Parse 24h format and convert to 12h
                                      const [hour, minute] = time24.split(':').map(Number)
                                      if (timeFormat === '24h') return time24
                                      let hour12 = hour
                                      let period = 'AM'
                                      if (hour === 0) {
                                        hour12 = 12
                                        period = 'AM'
                                      } else if (hour < 12) {
                                        hour12 = hour
                                        period = 'AM'
                                      } else if (hour === 12) {
                                        hour12 = 12
                                        period = 'PM'
                                      } else {
                                        hour12 = hour - 12
                                        period = 'PM'
                                      }
                                      return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`
                                    }
                                    const startDisplay = aiGeneratedTask.suggested_time_display || formatTimeDisplay(aiGeneratedTask.suggested_time || '')
                                    const endDisplay = aiGeneratedTask.suggested_end_time_display || formatTimeDisplay(aiGeneratedTask.suggested_end_time || '')
                                    return `${startDisplay} - ${endDisplay}`
                                  })()}
                                </div>
                              </div>
                            </div>
                            
                            {/* Read-only Duration */}
                            <div>
                              <div className="text-sm font-medium text-[#d7d2cb] mb-1">Duration</div>
                              <div className="text-[#d7d2cb]">{formatDuration(aiGeneratedTask.duration_minutes)}</div>
                            </div>
                            
                            {/* Read-only Reasoning */}
                            {aiGeneratedTask.reasoning && (
                              <div>
                                <div className="text-sm font-medium text-[#d7d2cb] mb-1">Why this time?</div>
                                <div className="text-[#d7d2cb]/80 text-sm">{aiGeneratedTask.reasoning}</div>
                              </div>
                            )}
                            
                            {/* Use Task Actions */}
                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={handleAIApply}
                                className="flex-1 px-3 py-2 bg-[#ff7f00] hover:bg-[#ff8c1a] text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                Use This Task
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowAIPreview(false)}
                                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-[#d7d2cb] rounded-lg text-sm font-medium transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* To-Do List Mode Content */}
              {mode === 'todo-list' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {aiCreditsBanner && (
                    <div>{aiCreditsBanner}</div>
                  )}

                  <div className="mb-4">
                    <h3 className={`text-sm font-medium mb-2 ${
                      currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
                    }`}>
                      Add Your Tasks
                    </h3>
                    <p className={`text-xs ${
                      currentTheme === 'dark' ? 'text-[#d7d2cb]/60' : 'text-gray-600'
                    }`}>
                      List your tasks below. AI will analyze each task, determine durations, and intelligently schedule them based on your availability.
                    </p>
                  </div>

                  {/* Task List */}
                  <div className="space-y-3">
                    {todoListTasks.map((task, index) => (
                      <div key={task.id} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <label className={`block text-xs font-medium mb-1 ${
                            currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                          }`}>
                            Task Name
                          </label>
                          <input
                            type="text"
                            value={task.name}
                            onChange={(e) => {
                              const newTasks = [...todoListTasks]
                              newTasks[index].name = e.target.value
                              setTodoListTasks(newTasks)
                            }}
                            placeholder={`Task ${index + 1}`}
                            className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                              currentTheme === 'dark'
                                ? 'bg-white/5 border-white/10 text-[#d7d2cb] placeholder-gray-400'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${
                            currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                          }`}>
                            Priority
                          </label>
                          <select
                            value={task.priority || 3}
                            onChange={(e) => {
                              const newTasks = [...todoListTasks]
                              newTasks[index].priority = parseInt(e.target.value)
                              setTodoListTasks(newTasks)
                            }}
                            className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                              currentTheme === 'dark'
                                ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          >
                            <option value={1}>Critical</option>
                            <option value={2}>High</option>
                            <option value={3}>Medium</option>
                            <option value={4}>Low</option>
                          </select>
                        </div>
                        {todoListTasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setTodoListTasks(todoListTasks.filter((_, i) => i !== index))
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              currentTheme === 'dark'
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Task Button */}
                  {todoListTasks.length < 20 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTodoListTasks([...todoListTasks, { id: `task-${Date.now()}`, name: '', priority: 3 }])
                      }}
                      className={`w-full px-4 py-2 rounded-lg border border-dashed transition-colors ${
                        currentTheme === 'dark'
                          ? 'border-white/20 hover:border-white/40 text-[#d7d2cb]/60 hover:text-[#d7d2cb]'
                          : 'border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add Task
                    </button>
                  )}

                  {/* Error Display */}
                  {todoListError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/50"
                    >
                      <p className="text-sm text-red-500">{todoListError}</p>
                    </motion.div>
                  )}

                  {/* Preview Section */}
                  {todoListPreview && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`text-sm font-medium ${
                          currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
                        }`}>
                          Preview Scheduled Tasks
                        </h4>
                        <button
                          type="button"
                          onClick={() => setTodoListPreview(null)}
                          className={`text-xs ${
                            currentTheme === 'dark' 
                              ? 'text-[#d7d2cb]/60 hover:text-[#d7d2cb]' 
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Edit List
                        </button>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {todoListPreview.map((task, index) => (
                          <TodoListPreviewItem
                            key={index}
                            task={task}
                            index={index}
                            isEditing={editingTaskIndex === index}
                            onEdit={() => setEditingTaskIndex(index)}
                            onSave={(edited) => {
                              const updated = [...todoListPreview]
                              updated[index] = edited
                              setTodoListPreview(updated)
                              setEditingTaskIndex(null)
                            }}
                            onCancel={() => setEditingTaskIndex(null)}
                            currentTheme={currentTheme}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Manual Mode Content */}
              {mode === 'manual' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="mb-4">
                    <h3 className={`text-sm font-medium mb-2 ${
                      currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
                    }`}>
                      Create Tasks
                    </h3>
                    <p className={`text-xs ${
                      currentTheme === 'dark' ? 'text-[#d7d2cb]/60' : 'text-gray-600'
                    }`}>
                      Add multiple tasks with custom dates, times, and settings. Each task can be configured independently.
                    </p>
                  </div>

                  {/* Task List */}
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {manualTasks.map((task, index) => {
                      const taskStartMinutes = task.startTime ? parseTimeToMinutes(task.startTime) : 0
                      const taskEndMinutes = task.endTime ? parseTimeToMinutes(task.endTime) : 0
                      const taskIsCrossDay = task.startTime && task.endTime && taskEndMinutes <= taskStartMinutes
                      const taskDuration = task.startTime && task.endTime 
                        ? (taskIsCrossDay 
                          ? (24 * 60) - taskStartMinutes + taskEndMinutes
                          : Math.max(0, taskEndMinutes - taskStartMinutes))
                        : 0
                      
                      return (
                        <div key={task.id} className={`p-4 rounded-lg border ${
                          currentTheme === 'dark'
                            ? 'bg-white/5 border-white/10'
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className={`text-sm font-medium ${
                              currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-900'
                            }`}>
                              Task {index + 1}
                            </h4>
                            {manualTasks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveManualTask(task.id)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  currentTheme === 'dark'
                                    ? 'text-red-400 hover:bg-red-500/10'
                                    : 'text-red-600 hover:bg-red-50'
                                }`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="space-y-3">
                            {/* Task Name */}
                            <div>
                              <label className={`text-xs font-medium block mb-1 ${
                                currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                              }`}>
                                Task Name *
                              </label>
                              <input
                                type="text"
                                value={task.name}
                                onChange={(e) => handleManualTaskChange(task.id, 'name', e.target.value)}
                                placeholder="Enter task name"
                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                                  currentTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-[#d7d2cb] placeholder-gray-400'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                              />
                            </div>

                            {/* Task Description */}
                            <div>
                              <label className={`text-xs font-medium block mb-1 ${
                                currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                              }`}>
                                Description
                              </label>
                              <textarea
                                value={task.details}
                                onChange={(e) => handleManualTaskChange(task.id, 'details', e.target.value)}
                                placeholder="Enter task description"
                                rows={2}
                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none ${
                                  currentTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-[#d7d2cb] placeholder-gray-400'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                              />
                            </div>

                            {/* Priority Selector */}
                            <div>
                              <label className={`text-xs font-medium block mb-1 ${
                                currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                              }`}>
                                Priority
                              </label>
                              <select
                                value={task.priority}
                                onChange={(e) => handleManualTaskChange(task.id, 'priority', parseInt(e.target.value))}
                                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                                  currentTheme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              >
                                <option value={1}>1 - Critical</option>
                                <option value={2}>2 - High</option>
                                <option value={3}>3 - Medium</option>
                                <option value={4}>4 - Low</option>
                              </select>
                            </div>

                            {/* Date - Only show when not recurring */}
                            {!task.isRecurring && (
                              <div>
                                <label className={`text-xs font-medium block mb-1 ${
                                  currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                                }`}>
                                  Date *
                                </label>
                                <input
                                  type="date"
                                  value={task.date}
                                  onChange={(e) => handleManualTaskChange(task.id, 'date', e.target.value)}
                                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                                    currentTheme === 'dark'
                                      ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                            )}

                            {/* Start Time */}
                            <div>
                              <label className={`text-xs font-medium block mb-1 ${
                                currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                              }`}>
                                Start Time *
                              </label>
                              <TimePicker
                                id={`start-time-${task.id}`}
                                value={task.startTime}
                                onChange={(value) => handleManualTaskChange(task.id, 'startTime', value)}
                                theme={currentTheme}
                                timeFormat={timeFormat}
                              />
                            </div>

                            {/* End Time */}
                            <div>
                              <label className={`text-xs font-medium block mb-1 ${
                                currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                              }`}>
                                End Time *
                              </label>
                              <TimePicker
                                id={`end-time-${task.id}`}
                                value={task.endTime}
                                onChange={(value) => handleManualTaskChange(task.id, 'endTime', value)}
                                theme={currentTheme}
                                timeFormat={timeFormat}
                              />
                            </div>

                            {/* Duration Display */}
                            {taskDuration > 0 && (
                              <div className={`p-2 rounded-lg ${
                                currentTheme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                              }`}>
                                <div className={`text-xs ${
                                  currentTheme === 'dark' ? 'text-[#d7d2cb]/70' : 'text-gray-600'
                                }`}>
                                  Duration
                                </div>
                                <div className={`text-sm font-semibold ${
                                  currentTheme === 'dark' ? 'text-[var(--primary)]' : 'text-orange-600'
                                }`}>
                                  {formatDuration(taskDuration)}
                                </div>
                              </div>
                            )}

                            {/* Recurring Task Toggle */}
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={task.isRecurring}
                                    onChange={(e) => handleManualTaskRecurringToggle(task.id, e.target.checked)}
                                    className="sr-only"
                                  />
                                  <div
                                    onClick={() => handleManualTaskRecurringToggle(task.id, !task.isRecurring)}
                                    className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                                      task.isRecurring 
                                        ? 'bg-[var(--primary)] border-[var(--primary)]' 
                                        : currentTheme === 'dark' 
                                          ? 'bg-transparent border-white/20 hover:border-white/40' 
                                          : 'bg-transparent border-gray-300 hover:border-gray-400'
                                    }`}
                                  />
                                </div>
                                <label className={`text-xs font-medium ${
                                  currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-700'
                                }`}>
                                  Recurring?
                                </label>
                              </div>
                              
                              {/* Indefinite Toggle - Only show when recurring is selected */}
                              <AnimatePresence>
                                {task.isRecurring && (
                                  <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex items-center space-x-2"
                                  >
                                    <div className="relative">
                                      <input
                                        type="checkbox"
                                        checked={task.isIndefinite}
                                        onChange={(e) => handleManualTaskIndefiniteToggle(task.id, e.target.checked)}
                                        className="sr-only"
                                      />
                                      <div
                                        onClick={() => handleManualTaskIndefiniteToggle(task.id, !task.isIndefinite)}
                                        className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 ${
                                          task.isIndefinite 
                                            ? 'bg-[var(--primary)] border-[var(--primary)]' 
                                            : currentTheme === 'dark' 
                                              ? 'bg-transparent border-white/20 hover:border-white/40' 
                                              : 'bg-transparent border-gray-300 hover:border-gray-400'
                                        }`}
                                      />
                                    </div>
                                    <label className={`text-xs font-medium ${
                                      currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-700'
                                    }`}>
                                      Indefinite?
                                    </label>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Recurring Task Options */}
                            <AnimatePresence>
                              {task.isRecurring && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className={`space-y-2 p-3 rounded-lg border ${
                                    currentTheme === 'dark' 
                                      ? 'bg-[#1a1a1a] border-white/10' 
                                      : 'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  {/* Weekly Days Selection */}
                                  <div>
                                    <label className={`block text-xs font-medium mb-2 ${
                                      currentTheme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                                    }`}>
                                      Repeat on
                                    </label>
                                    <div className="flex flex-wrap gap-1">
                                      {[
                                        { day: 1, name: 'M' },
                                        { day: 2, name: 'T' },
                                        { day: 3, name: 'W' },
                                        { day: 4, name: 'T' },
                                        { day: 5, name: 'F' },
                                        { day: 6, name: 'S' },
                                        { day: 0, name: 'S' }
                                      ].map(({ day, name }) => {
                                        const isSelected = task.recurrenceDays.includes(day)
                                        
                                        return (
                                          <button
                                            key={day}
                                            type="button"
                                            onClick={() => handleManualTaskDayToggle(task.id, day)}
                                            className={`w-7 h-7 rounded-full text-xs font-medium transition-all ${
                                              isSelected
                                                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md'
                                                : 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)] border border-[var(--border)]'
                                            }`}
                                          >
                                            {name}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>

                                  {/* Date Range - Only show if not indefinite */}
                                  {!task.isIndefinite && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className={`block text-xs font-medium mb-1 ${
                                          currentTheme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                                        }`}>
                                          Start Date *
                                        </label>
                                        <input
                                          type="date"
                                          value={task.recurrenceStartDate}
                                          onChange={(e) => handleManualTaskChange(task.id, 'recurrenceStartDate', e.target.value)}
                                          className={`w-full px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                                            currentTheme === 'dark'
                                              ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                                              : 'bg-white border-gray-300 text-gray-900'
                                          }`}
                                        />
                                      </div>
                                      <div>
                                        <label className={`block text-xs font-medium mb-1 ${
                                          currentTheme === 'dark' ? 'text-[#d7d2cb]/80' : 'text-gray-700'
                                        }`}>
                                          End Date *
                                        </label>
                                        <input
                                          type="date"
                                          value={task.recurrenceEndDate}
                                          onChange={(e) => handleManualTaskChange(task.id, 'recurrenceEndDate', e.target.value)}
                                          className={`w-full px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                                            currentTheme === 'dark'
                                              ? 'bg-white/5 border-white/10 text-[#d7d2cb]'
                                              : 'bg-white border-gray-300 text-gray-900'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Add Task Button */}
                  {manualTasks.length < 10 && (
                    <button
                      type="button"
                      onClick={handleAddManualTask}
                      className={`w-full px-4 py-2 rounded-lg border border-dashed transition-colors ${
                        currentTheme === 'dark'
                          ? 'border-white/20 hover:border-white/40 text-[#d7d2cb]/60 hover:text-[#d7d2cb]'
                          : 'border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add Another Task
                    </button>
                  )}
                </motion.div>
              )}

            </form>

            {/* Footer */}
            <div className={`flex items-center justify-end gap-3 p-6 border-t ${
              currentTheme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentTheme === 'dark'
                    ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                } disabled:opacity-50`}
              >
                Cancel
              </button>
              {!(isAIMode && showAIPreview) && mode !== 'todo-list' && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  if (isAIMode) {
                    handleAIGenerate()
                  } else {
                    handleManualTasksSubmit(e)
                  }
                }}
                disabled={
                  isLoading || 
                  isAILoading || 
                  (isAIMode && !aiDescription.trim()) || 
                  (!isAIMode && manualTasks.filter(t => 
                    t.name.trim() && 
                    t.startTime && 
                    t.endTime && 
                    (!t.isRecurring || t.date || t.recurrenceDays.length > 0)
                  ).length === 0)
                }
                className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                  isLoading || 
                  isAILoading || 
                  (isAIMode && !aiDescription.trim()) || 
                  (!isAIMode && manualTasks.filter(t => 
                    t.name.trim() && 
                    t.startTime && 
                    t.endTime && 
                    (!t.isRecurring || t.date || t.recurrenceDays.length > 0)
                  ).length === 0)
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    : 'bg-[#ff7f00] hover:bg-[#ff8c1a] text-white'
                } disabled:opacity-50`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : isAILoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isAIMode ? (
                  'Create'
                ) : (
                  manualTasks.length > 1 ? `Create ${manualTasks.filter(t => t.name.trim() && t.startTime && t.endTime).length} Tasks` : 'Create Task'
                )}
              </button>
              )}
              {mode === 'todo-list' && (
                <>
                  {!todoListPreview ? (
                    <button
                      type="button"
                      onClick={handleTodoListAnalyze}
                      disabled={isAnalyzingTodoList || todoListTasks.filter(t => t.name.trim()).length === 0}
                      className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                        isAnalyzingTodoList || todoListTasks.filter(t => t.name.trim()).length === 0
                          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                          : 'bg-[#ff7f00] hover:bg-[#ff8c1a] text-white'
                      } disabled:opacity-50`}
                    >
                      {isAnalyzingTodoList ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        'Analyze & Schedule'
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTodoListSchedule}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                        isLoading
                          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                          : 'bg-[#ff7f00] hover:bg-[#ff8c1a] text-white'
                      } disabled:opacity-50`}
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        'Create Tasks'
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Cross-Day Task Warning Dialog */}
      <AnimatePresence>
        {showCrossDayWarning && (
          <motion.div
            key="cross-day-task-warning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              key="cross-day-task-warning-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`p-6 rounded-lg shadow-xl max-w-md w-full mx-4 ${
                currentTheme === 'dark'
                  ? 'bg-[#1a1a1a] border border-white/10'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${
                  currentTheme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Cross-Day Task Detected
                </h3>
                {crossDayTaskData && (() => {
                  const safeDate = crossDayTaskData.date || formatDateForDB(new Date())
                  return (
                  <div className={`text-sm mb-4 ${
                    currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-600'
                  }`}>
                    <div className="mb-2">This task crosses midnight.</div>
                    <div>
                      {formatDateForLabel(safeDate)} {formatTimeForDisplay(crossDayTaskData.startTime)} 
                      → {formatDateForLabel(getNextDateString(safeDate))} {formatTimeForDisplay(crossDayTaskData.endTime)}
                    </div>
                  </div>
                )})()}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleCrossDayCancel}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentTheme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCrossDayConfirm}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-lg bg-[#ff7f00] hover:bg-[#ff8c1a] text-white transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Creating...' : 'Create Cross-Day Task'}
                  </button>
                </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Past Date Warning Dialog */}
      <AnimatePresence>
        {showPastDateWarning && pastDateTaskData && (
          <motion.div
            key="past-date-warning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              key="past-date-warning-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`p-6 rounded-lg shadow-xl max-w-md w-full mx-4 ${
                currentTheme === 'dark'
                  ? 'bg-[#1a1a1a] border border-white/10'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${
                  currentTheme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Past Date/Time Detected
                </h3>
                <div className={`text-sm mb-4 ${
                  currentTheme === 'dark' ? 'text-[#d7d2cb]' : 'text-gray-600'
                }`}>
                  <div className="mb-2">The selected date and time is in the past.</div>
                  <div>
                    {pastDateTaskData.taskData?.date ? formatDateForLabel(pastDateTaskData.taskData.date) : formatDateForLabel(formatDateForDB(new Date()))} {formatTimeForDisplay(pastDateTaskData.taskData?.startTime || pastDateTaskData.formData?.startTime || '00:00')} - {formatTimeForDisplay(pastDateTaskData.taskData?.endTime || pastDateTaskData.formData?.endTime || '00:00')}
                  </div>
                  <div className="mt-2 text-xs">
                    This will create an overdue task. You can still proceed if this is intentional.
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handlePastDateCancel}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentTheme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePastDateConfirm}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-lg bg-[#ff7f00] hover:bg-[#ff8c1a] text-white transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Creating...' : 'Create Anyway'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved Changes Warning Modal */}
      <ConfirmDeleteModal
        isOpen={showUnsavedChangesWarning}
        onClose={() => setShowUnsavedChangesWarning(false)}
        onConfirm={handleConfirmDiscard}
        title="Discard Unsaved Changes?"
        description="You have unsaved changes that will be lost if you close this window. Are you sure you want to discard these changes?"
        confirmText="Discard Changes"
        isDeleting={false}
      />
    </AnimatePresence>
  )
}