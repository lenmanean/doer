'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clock, Calendar, Plus, Settings, Move, RotateCcw, ArrowUpDown, ArrowLeftRight, Maximize2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowLeft as LeftArrow, ArrowRight as RightArrow, Expand, X, GripVertical, UtensilsCrossed } from 'lucide-react'
import { Sidebar } from '@/components/ui/Sidebar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { TaskBlock } from '@/components/ui/TaskBlock'
import { MultipleTasksPanel } from '@/components/ui/MultipleTasksPanel'
import { TaskTimeEditModal } from '@/components/ui/TaskTimeEditModal'
import { CreateTaskModal } from '@/components/ui/CreateTaskModal'
import { SchedulerDebugDashboard } from '@/components/ui/SchedulerDebugDashboard'
import { SwitchPlanModal } from '@/components/ui/SwitchPlanModal'
import { RescheduleApprovalModal } from '@/components/ui/RescheduleApprovalModal'
import { usePendingReschedules } from '@/hooks/usePendingReschedules'
import { useGlobalPendingReschedules } from '@/hooks/useGlobalPendingReschedules'
import { supabase } from '@/lib/supabase/client'
import { useTaskTimeSchedule } from '@/hooks/useTaskTimeSchedule'
import { calculateGridPosition, calculateTaskHeight, calculateTimeFromPosition, snapToGrid } from '@/lib/hour-view-utils'
import { formatDateForDB } from '@/lib/date-utils'
import { calculateDuration } from '@/lib/task-time-utils'
import { calculateTaskPosition, validateTaskPosition, groupTasksByTimeSlot, detectOverlappingTasks, OverlapGroup } from '@/lib/task-positioning'
import { useTheme } from '@/components/providers/theme-provider'
import { signOutClient } from '@/lib/auth/sign-out-client'
import { useSupabase } from '@/components/providers/supabase-provider'
import { isEmailConfirmed } from '@/lib/email-confirmation'

interface WeekDay {
  date: Date
  dateString: string
  dayName: string
  isSelected: boolean
}

type IntervalType = '1hr' | '30min' | '15min'

function ScheduleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planIdFromUrl = searchParams.get('plan')
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme
  const { user } = useSupabase()
  
  // Global pending reschedules check for sidebar badge (all plans + free-mode)
  const { hasPending: hasGlobalPendingReschedules } = useGlobalPendingReschedules(user?.id || null)
  
  // Email confirmation status for settings badge
  const [emailConfirmed, setEmailConfirmed] = useState(true)
  
  useEffect(() => {
    if (!user) {
      setEmailConfirmed(true)
      return
    }
    setEmailConfirmed(isEmailConfirmed(user))
  }, [user?.id])
  
  const handleSignOut = async () => {
    try {
      console.log('[SchedulePage] Starting sign out...')
      await signOutClient(supabase)
      console.log('[SchedulePage] Sign out successful, redirecting...')
      // Force a hard reload to clear any cached auth state
      // Using window.location.href ensures a full page reload and clears all state
      window.location.href = '/'
    } catch (error) {
      console.error('[SchedulePage] Error signing out:', error)
      // Even if sign out fails, force a hard reload to ensure clean state
      window.location.href = '/'
    }
  }
  
  // State management
  const [intervalType, setIntervalType] = useState<IntervalType>('1hr')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>()
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [weekStartDay, setWeekStartDay] = useState<number>(0) // Default to Sunday until user preference loads
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('09:00')
  const [userId, setUserId] = useState<string | null>(null)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [hasPlan, setHasPlan] = useState<boolean>(false)
  const [isLoadingPlan, setIsLoadingPlan] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
  })
  const [isGranularView, setIsGranularView] = useState<boolean>(false)
  const [showDebugDashboard, setShowDebugDashboard] = useState(false)
  const [expandedMultiPanels, setExpandedMultiPanels] = useState<Set<string>>(new Set())
  const [hoveredLunchSlot, setHoveredLunchSlot] = useState<string | null>(null)
  const [lunchStartHour, setLunchStartHour] = useState<number>(12)
  const [lunchEndHour, setLunchEndHour] = useState<number>(13)
  const gridRef = useRef<HTMLDivElement>(null)
  const activePlansDropdownRef = useRef<HTMLDivElement>(null)
  const weekPickerRef = useRef<HTMLDivElement>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  
  
  // Active plans for current week
  const [activePlansForWeek, setActivePlansForWeek] = useState<Map<string, {id: string, name: string}>>(new Map())
  const [showActivePlansDropdown, setShowActivePlansDropdown] = useState(false)
  const [showSwitchPlanModal, setShowSwitchPlanModal] = useState(false)
  
  // Pending reschedules - fetch BOTH free-mode AND plan-based proposals
  const { pendingReschedules: freeModeReschedules, hasPending: hasFreeModePending, loading: loadingFreeMode, refetch: refetchFreeMode } = usePendingReschedules(
    userId,
    'free-mode'
  )
  const { pendingReschedules: planReschedules, hasPending: hasPlanPending, loading: loadingPlan, refetch: refetchPlan } = usePendingReschedules(
    userId,
    currentPlanId
  )
  
  // Combine both sets of proposals and deduplicate by proposal ID
  const allPendingReschedules = useMemo(() => {
    const combined = [...freeModeReschedules, ...planReschedules]
    // Deduplicate by proposal ID to prevent showing the same proposal twice
    const uniqueMap = new Map<string, typeof freeModeReschedules[0]>()
    combined.forEach(proposal => {
      if (!uniqueMap.has(proposal.id)) {
        uniqueMap.set(proposal.id, proposal)
      }
    })
    return Array.from(uniqueMap.values())
  }, [freeModeReschedules, planReschedules])
  
  const hasPending = hasFreeModePending || hasPlanPending
  const loadingPending = loadingFreeMode || loadingPlan
  
  // Memoize refetchPending to prevent infinite loops
  const refetchPending = useCallback(async () => {
    await Promise.all([refetchFreeMode(), refetchPlan()])
  }, [refetchFreeMode, refetchPlan])
  
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [dismissedProposalIds, setDismissedProposalIds] = useState<Set<string>>(new Set())
  
  // Current time indicator state
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  
  // Draggable panel position - merged panel at bottom left
  const [panelPosition, setPanelPosition] = useState({ x: 96, y: typeof window !== 'undefined' ? window.innerHeight - 100 : 600 })
  const [draggingPanel, setDraggingPanel] = useState<boolean>(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [hoveredPanel, setHoveredPanel] = useState<boolean>(false)

  // Initialize panel position on mount - position at bottom left
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Position at bottom left of schedule view (80px sidebar + 16px padding)
      const leftOffset = 96 // 80px (sidebar) + 16px (padding)
      const bottomOffset = 100 // 16px from bottom (4 * 4 = 16px, but we use 100 for consistency)
      
      setPanelPosition({ x: leftOffset, y: window.innerHeight - bottomOffset })
    }
  }, [])
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Don't close if clicking on select elements or their options
      if (target.tagName === 'SELECT' || target.closest('select') || target.tagName === 'OPTION') {
        return
      }
      
      if (activePlansDropdownRef.current && !activePlansDropdownRef.current.contains(target)) {
        setShowActivePlansDropdown(false)
      }
      if (weekPickerRef.current && !weekPickerRef.current.contains(target)) {
        setShowDatePicker(false)
      }
    }
    
    if (showActivePlansDropdown || showDatePicker) {
      // Use a slight delay to allow select dropdowns to open properly
      document.addEventListener('mousedown', handleClickOutside, true)
      return () => document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [showActivePlansDropdown, showDatePicker])

  // Handle window resize to keep panel in bounds
  useEffect(() => {
    const handleResize = () => {
      // Ensure panel stays within viewport bounds
      setPanelPosition(prev => ({
        x: Math.max(0, Math.min(prev.x, window.innerWidth - 450)),
        y: Math.max(0, Math.min(prev.y, window.innerHeight - 100))
      }))
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle dragging
  useEffect(() => {
    if (!draggingPanel) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      // Keep panel within viewport bounds
      const maxX = window.innerWidth - 450
      const maxY = window.innerHeight - 100
      const minX = 0
      const minY = 0
      
      const constrainedX = Math.max(minX, Math.min(maxX, newX))
      const constrainedY = Math.max(minY, Math.min(maxY, newY))
      
      setPanelPosition({ x: constrainedX, y: constrainedY })
    }

    const handleMouseUp = () => {
      setDraggingPanel(false)
      setDragOffset({ x: 0, y: 0 })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingPanel, dragOffset])

  const handlePanelMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on buttons or interactive elements
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('select') || target.closest('input') || target.closest('[role="button"]')) {
      return
    }
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setDraggingPanel(true)
  }

  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget.closest('div[class*="fixed"]') as HTMLElement)?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
      setDraggingPanel(true)
    }
  }
  
  // Multi-panel toggle functionality
  const handleToggleMultiPanel = useCallback((panelId: string) => {
    setExpandedMultiPanels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(panelId)) {
        newSet.delete(panelId)
      } else {
        newSet.add(panelId)
      }
      return newSet
    })
  }, [])
  
  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date())
    }
    
    // Update immediately
    updateTime()
    
    // Set up interval to update every minute
    const interval = setInterval(updateTime, 60000) // 60 seconds
    
    return () => clearInterval(interval)
  }, [])

  // Check for overdue tasks and auto-reschedule
  useEffect(() => {
    if (!userId) return
    
    const checkAndRescheduleOverdue = async () => {
      try {
        // Always check free-mode tasks (planId = null)
        console.log('[Schedule] Checking for overdue free-mode tasks...', { userId })
        const freeModeResponse = await fetch('/api/tasks/reschedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: null })
        })

        if (freeModeResponse.ok) {
          const freeModeData = await freeModeResponse.json()
          console.log('[Schedule] Free-mode reschedule check:', {
            success: freeModeData.success,
            resultsCount: freeModeData.results?.length || 0
          })
          if (freeModeData.success && freeModeData.results && freeModeData.results.length > 0) {
            console.log(`✅ Created ${freeModeData.results.length} free-mode reschedule proposal(s)`)
          }
        }

        // Also check plan tasks if there's a current plan
        if (currentPlanId) {
          console.log('[Schedule] Checking for overdue plan tasks...', { planId: currentPlanId, userId })
          const planResponse = await fetch('/api/tasks/reschedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: currentPlanId })
          })

          if (planResponse.ok) {
            const planData = await planResponse.json()
            console.log('[Schedule] Plan reschedule check:', {
              success: planData.success,
              resultsCount: planData.results?.length || 0
            })
            if (planData.success && planData.results && planData.results.length > 0) {
              console.log(`✅ Created ${planData.results.length} plan reschedule proposal(s)`)
            }
          }
        }

        // Real-time subscription will automatically fetch pending reschedules when proposals change
        // No need to manually refetch here to avoid infinite loops
      } catch (error) {
        console.error('[Schedule] Error checking overdue tasks:', error)
      }
    }

    // Check immediately on mount
    checkAndRescheduleOverdue()
    
    // Also check every 30 seconds
    const interval = setInterval(checkAndRescheduleOverdue, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [userId, currentPlanId]) // Removed refetchPending to prevent infinite loops

  // Clear dismissed proposal IDs when navigating to the schedule page
  // This allows the modal to appear again on next visit if proposals still exist
  useEffect(() => {
    setDismissedProposalIds(new Set())
  }, []) // Only run on mount

  // Show reschedule modal when pending reschedules are detected (works for both plan-based and free-mode)
  // Only show modal when on schedule page and proposals haven't been dismissed
  useEffect(() => {
    console.log('[Schedule] Modal trigger check:', {
      hasPending,
      loadingPending,
      showRescheduleModal,
      pendingCount: allPendingReschedules.length,
      freeModeCount: freeModeReschedules.length,
      planCount: planReschedules.length,
      dismissedCount: dismissedProposalIds.size
    })
    
    // Filter out dismissed proposals
    const visibleProposals = allPendingReschedules.filter(
      proposal => !dismissedProposalIds.has(proposal.id)
    )
    
    // Close modal if no visible proposals remain
    if (showRescheduleModal && visibleProposals.length === 0 && !loadingPending) {
      console.log('[Schedule] Closing modal - no visible proposals remaining')
      setShowRescheduleModal(false)
      return
    }
    
    // Only show modal on schedule page when there are pending reschedules that haven't been dismissed
    if (hasPending && !loadingPending && !showRescheduleModal && visibleProposals.length > 0) {
      console.log('[Schedule] ✅ Showing reschedule modal with', visibleProposals.length, 'proposal(s)')
      setShowRescheduleModal(true)
    }
  }, [hasPending, loadingPending, showRescheduleModal, allPendingReschedules, dismissedProposalIds])
  
  // Calculate week days based on user's week start preference
  const getWeekDays = useCallback((weekStart: Date, weekStartDay: number): WeekDay[] => {
    const days: WeekDay[] = []
    const today = new Date()
    
    // If weekStart is already the start of the week (currentWeekStart), use it directly
    // Otherwise, calculate the start of the week based on user preference
    let startOfWeek: Date
    if (weekStart.getDay() === weekStartDay) {
      // weekStart is already the start of the week
      startOfWeek = new Date(weekStart)
    } else {
      // Calculate the start of the week based on user preference
      startOfWeek = new Date(weekStart)
      const currentDay = startOfWeek.getDay()
      const daysFromStart = (currentDay - weekStartDay + 7) % 7
      startOfWeek.setDate(startOfWeek.getDate() - daysFromStart)
    }
    
    // Generate 7 days starting from the calculated start
    for (let i = 0; i < 7; i++) {
      // Use setDate instead of adding milliseconds to avoid DST issues
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayName = dayNames[date.getDay()]
      
      // Use formatDateForDB to ensure consistent date formatting
      const localDateString = formatDateForDB(date)
      
      days.push({
        date,
        dateString: localDateString,
        dayName: dayName.substring(0, 3), // Short form (Sun, Mon, etc.)
        isSelected: date.toDateString() === today.toDateString()
      })
    }
    
    return days
  }, [])

  // Calculate week days for the current week
  const weekDays = useMemo(() => {
    if (!currentWeekStart) {
      // Default to current week if no plan week is set
      const today = new Date()
      return getWeekDays(today, weekStartDay)
    }
    return getWeekDays(currentWeekStart, weekStartDay)
  }, [currentWeekStart, weekStartDay, getWeekDays])

  // Calculate current time position for the indicator line
  const getCurrentTimePosition = useCallback(() => {
    const now = currentTime
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const totalMinutes = currentHour * 60 + currentMinute
    
    // Calculate position based on current interval type
    const intervalType = isGranularView ? '15min' : '1hr'
    return calculateGridPosition(totalMinutes, intervalType)
  }, [currentTime, isGranularView])
  
  // Check if current time is within the visible week
  const isCurrentTimeVisible = useMemo(() => {
    const today = new Date()
    const todayString = formatDateForDB(today) // Use local date formatting
    return weekDays.some(day => day.dateString === todayString)
  }, [weekDays])
  
  // Calculate week date range for task fetching
  const weekDateRange = useMemo(() => {
    const normalize = (date: Date) => {
      const start = new Date(date)
      const dayOfWeek = date.getDay()
      const daysToSubtract = (dayOfWeek - weekStartDay + 7) % 7
      start.setDate(date.getDate() - daysToSubtract)
      start.setHours(0, 0, 0, 0) // Normalize to start of day
      return start
    }
    
    // Use weekDays to determine the actual displayed week range
    // This ensures the API query matches exactly what's displayed
    if (weekDays.length === 7) {
      const firstDay = weekDays[0]
      const lastDay = weekDays[6]
      
      const startDate = formatDateForDB(firstDay.date)
      const endDate = formatDateForDB(lastDay.date)
      
      return {
        start: startDate,
        end: endDate
      }
    }
    
    // Fallback if weekDays not ready yet
    if (!currentWeekStart) {
      // Use the same week calculation as weekDays
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startOfWeek = normalize(today)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      
      return {
        start: formatDateForDB(startOfWeek),
        end: formatDateForDB(endOfWeek)
      }
    }
    
    // Normalize to user's configured start-of-week to ensure API range matches grid/header
    const startOfWeek = normalize(new Date(currentWeekStart))
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    
    console.log('Week date range calculation (fallback):', {
      currentWeekStart: currentWeekStart.toDateString(),
      startOfWeek: startOfWeek.toDateString(),
      endOfWeek: endOfWeek.toDateString(),
      startDate: formatDateForDB(startOfWeek),
      endDate: formatDateForDB(endOfWeek)
    })
    
    return {
      start: formatDateForDB(startOfWeek),
      end: formatDateForDB(endOfWeek)
    }
  }, [weekDays, currentWeekStart, weekStartDay])
  
  // If user changes start-of-week preference after we set currentWeekStart,
  // normalize it so grid/header/API stay aligned
  useEffect(() => {
    if (!currentWeekStart) return
    const normalized = (() => {
      const date = new Date(currentWeekStart)
      const start = new Date(date)
      const dayOfWeek = date.getDay()
      const daysToSubtract = (dayOfWeek - weekStartDay + 7) % 7
      start.setDate(date.getDate() - daysToSubtract)
      return start
    })()
    if (normalized.getTime() !== new Date(currentWeekStart).getTime()) {
      setCurrentWeekStart(normalized)
    }
  }, [weekStartDay])
  
  // Fetch tasks for the current week from ALL sources (all plans + free-mode + calendar events)
  // Schedule page should always show all tasks regardless of active plan
  const allPlansParam = !isLoadingPlan && !isLoadingSettings ? 'all-plans' : 'skip'

  const { tasksWithTime: allTasksWithTime, updateTaskTime, getTasksForDate: getAllTasksForDate, refetch } = useTaskTimeSchedule(
    allPlansParam,
    weekDateRange
  )
  
  // Optimistic task addition for immediate UI feedback
  const [optimisticTasks, setOptimisticTasks] = useState<any[]>([])
  
  // Add optimistic task to local state
  const addOptimisticTask = useCallback((task: any) => {
    setOptimisticTasks(prev => [...prev, task])
    
    // Remove optimistic task after a short delay (will be cleaned up by real data anyway)
    setTimeout(() => {
      setOptimisticTasks(prev => prev.filter(t => t.task_id !== task.task_id))
    }, 500)
  }, [])
  
  // Remove task optimistically (for immediate UI feedback)
  const removeOptimisticTask = useCallback((taskId: string) => {
    setOptimisticTasks(prev => prev.filter(t => t.task_id !== taskId))
  }, [])
  
  // Enhanced getTasksForDate that includes optimistic tasks (deduplicated)
  const getTasksForDateWithOptimistic = useCallback((date: string) => {
    const realTasks = getAllTasksForDate(date)
    
    // Deduplicate by schedule_id (not task_id) since same task can appear multiple times
    const scheduleIdSet = new Set<string>()
    const deduplicatedTasks: any[] = []
    
    for (const task of realTasks) {
      if (task.schedule_id && !scheduleIdSet.has(task.schedule_id)) {
        scheduleIdSet.add(task.schedule_id)
        deduplicatedTasks.push(task)
      }
    }
    
    // Calendar events are always shown (no filtering)
    const filteredTasks = deduplicatedTasks
    
    const optimisticTasksForDate = optimisticTasks.filter(task => task.date === date)
    
    // Deduplicate optimistic tasks by task_id - if a real task exists with the same task_id, don't show the optimistic one
    const realTaskIds = new Set(filteredTasks.map(task => task.task_id))
    const filteredOptimisticTasks = optimisticTasksForDate.filter(task => !realTaskIds.has(task.task_id))
    
    return [...filteredTasks, ...filteredOptimisticTasks]
  }, [getAllTasksForDate, optimisticTasks])
  
  // Clean up optimistic tasks when real data comes in
  useEffect(() => {
    if (Object.keys(allTasksWithTime || {}).length > 0) {
      // Get all real task IDs
      const allRealTasks = Object.values(allTasksWithTime || {}).flat()
      const realTaskIds = new Set(allRealTasks.map(task => task.task_id))
      
      // Remove optimistic tasks that now have real data
      setOptimisticTasks(prev => {
        const filtered = prev.filter(task => !realTaskIds.has(task.task_id))
        if (filtered.length !== prev.length) {
          console.log('🧹 Cleaned up optimistic tasks, removed:', prev.length - filtered.length)
        }
        return filtered
      })
    }
  }, [allTasksWithTime])
  
  // Debug logging for tasks
  useEffect(() => {
    if (Object.keys(allTasksWithTime || {}).length > 0) {
      console.log('All tasks loaded (all plans + free-mode + calendar events):', allTasksWithTime)
      // Check for duplicate task names
      const allTasks = (Object.values(allTasksWithTime || {}) as any[]).flat() as any[]
      const taskNames = allTasks.map((t: any) => t.name)
      const duplicates = taskNames.filter((name, index) => taskNames.indexOf(name) !== index)
      if (duplicates.length > 0) {
        console.log('Duplicate task names found:', duplicates)
      }
      
      // Specifically check for "Spotting and Safety Drills"
      const spottingTasks = allTasks.filter((t: any) => t.name.includes('Spotting and Safety Drills'))
      if (spottingTasks.length > 0) {
        console.log('Spotting and Safety Drills tasks found:', spottingTasks.map((t: any) => ({
          name: t.name,
          date: t.date,
          day_index: t.day_index,
          start_time: t.start_time
        })))
      }
    }
  }, [allTasksWithTime])
  
  // Aggregate active plans for current week from tasks AND check for active plan even if no tasks
  useEffect(() => {
    const fetchActivePlans = async () => {
      // First, get all unique plan_ids from current week's tasks
      const allTasks = (Object.values(allTasksWithTime || {}) as any[]).flat() as any[]
      
      // Filter out tasks with no plan_id (free-mode tasks and calendar events)
      const tasksWithPlans = allTasks.filter((t: any) => t.plan_id)
      const uniquePlanIds = [...new Set(tasksWithPlans.map((t: any) => t.plan_id))]
      
      // Also include the currentPlanId if we have one (even if no tasks in current week)
      const planIdsToFetch = uniquePlanIds
      if (currentPlanId && !planIdsToFetch.includes(currentPlanId)) {
        planIdsToFetch.push(currentPlanId)
      }
      
      if (planIdsToFetch.length === 0) {
        // If we have a currentPlanId but no tasks, still try to fetch the plan info
        if (currentPlanId) {
          const { data: planData, error } = await supabase
            .from('plans')
            .select('id, goal_text, summary_data')
            .eq('id', currentPlanId)
            .eq('user_id', userId!)
            .eq('status', 'active')
            .single()
          
          if (!error && planData) {
            const planName = planData.summary_data?.goal_text || planData.goal_text
            const plansMap = new Map<string, {id: string, name: string}>()
            plansMap.set(planData.id, { id: planData.id, name: planName })
            setActivePlansForWeek(plansMap)
            return
          }
        }
        setActivePlansForWeek(new Map())
        return
      }
      
      // Fetch plan details for all unique plan_ids
      const { data: plansData, error } = await supabase
        .from('plans')
        .select('id, goal_text, summary_data')
        .in('id', planIdsToFetch)
        .eq('user_id', userId!)
        .eq('status', 'active')
      
      if (error) {
        console.error('Error fetching active plans:', error)
        return
      }
      
      // Create a map of plan_id -> plan name
      const plansMap = new Map<string, {id: string, name: string}>()
      plansData?.forEach(plan => {
        const planName = plan.summary_data?.goal_text || plan.goal_text
        plansMap.set(plan.id, { id: plan.id, name: planName })
      })
      
      setActivePlansForWeek(plansMap)
    }
    
    if (userId && !isLoadingSettings && !isLoadingPlan) {
      fetchActivePlans()
    }
  }, [allTasksWithTime, userId, isLoadingSettings, isLoadingPlan, currentPlanId])
  


  // Load user's time format preference from settings and user ID
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (!user?.id) {
          setIsLoadingSettings(false)
          setIsLoadingPlan(false)
          return
        }

        setUserId(user.id)

        // Load user settings
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('preferences')
          .eq('user_id', user.id)
          .single()

        const preferences = settingsData?.preferences || {}
        if (preferences?.time_format) {
          setTimeFormat(preferences.time_format)
        }
        
        // Get the actual week start day from settings (or default to Sunday/0)
        const userWeekStartDay = preferences?.week_start_day !== undefined 
          ? preferences.week_start_day 
          : 0 // Default to Sunday if not set
        setWeekStartDay(userWeekStartDay)

        // Extract lunch hours with fallbacks
        const workdayPreferences = preferences?.workday || {}
        const lunchStart = typeof workdayPreferences.lunch_start_hour === 'number'
          ? workdayPreferences.lunch_start_hour
          : typeof preferences?.lunch_start_hour === 'number'
            ? preferences.lunch_start_hour
            : 12
        const lunchEnd = typeof workdayPreferences.lunch_end_hour === 'number'
          ? workdayPreferences.lunch_end_hour
          : typeof preferences?.lunch_end_hour === 'number'
            ? preferences.lunch_end_hour
            : 13
        setLunchStartHour(Math.min(Math.max(0, lunchStart), 23))
        setLunchEndHour(Math.min(Math.max(0, lunchEnd), 24))

        // Check if user has an active plan
        const { data: planData } = await supabase
          .from('plans')
          .select('id, status, start_date')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Helper to calculate week start with the correct weekStartDay
        const calculateWeekStart = (date: Date, weekStart: number) => {
          const normalizedStart = new Date(date)
          const currentDay = normalizedStart.getDay()
          const daysFromStart = (currentDay - weekStart + 7) % 7
          normalizedStart.setDate(normalizedStart.getDate() - daysFromStart)
          return normalizedStart
        }

        // If plan ID provided in URL, verify it belongs to user and is active
        if (planIdFromUrl) {
          const { data: urlPlanData, error: urlPlanError } = await supabase
            .from('plans')
            .select('id, status, user_id, start_date')
            .eq('id', planIdFromUrl)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single()

          if (urlPlanData && !urlPlanError) {
            setCurrentPlanId(urlPlanData.id)
            setHasPlan(true)
            // Load the user's CURRENT week, not the plan start week
            const today = new Date()
            const normalizedStart = calculateWeekStart(today, userWeekStartDay)
            setCurrentWeekStart(normalizedStart)
            // Clean up URL parameter after verification
            router.replace('/schedule')
          } else {
            console.warn('Invalid or unauthorized plan ID in URL:', planIdFromUrl)
            // Fall back to regular plan detection
            if (planData) {
              setCurrentPlanId(planData.id)
              setHasPlan(true)
              // Load the user's CURRENT week, not the plan start week
              const today = new Date()
              const normalizedStart = calculateWeekStart(today, userWeekStartDay)
              setCurrentWeekStart(normalizedStart)
            } else {
              setHasPlan(false)
            }
          }
        } else if (planData) {
          setCurrentPlanId(planData.id)
          setHasPlan(true)
          // Load the user's CURRENT week, not the plan start week
          const today = new Date()
          const normalizedStart = calculateWeekStart(today, userWeekStartDay)
          setCurrentWeekStart(normalizedStart)
        } else {
          setHasPlan(false)
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        setHasPlan(false)
      } finally {
        setIsLoadingSettings(false)
        setIsLoadingPlan(false)
      }
    }

    loadSettings()
  }, [user?.id])

  // Get the start of week based on user's preference
  const getStartOfWeek = useCallback((date: Date) => {
    const startOfWeek = new Date(date)
    const dayOfWeek = date.getDay()
    const daysToSubtract = (dayOfWeek - weekStartDay + 7) % 7
    startOfWeek.setDate(date.getDate() - daysToSubtract)
    return startOfWeek
  }, [weekStartDay])

  // Initialize week start based on current date and user preference
  // Do not override if a plan is active (plan week will set this)
  useEffect(() => {
    if (hasPlan) return
    const today = new Date()
    const startOfWeek = getStartOfWeek(today)
    setCurrentWeekStart(startOfWeek)
  }, [getStartOfWeek, hasPlan])

  // Format time based on user preference
  const formatTime = (hour: number, minute: number = 0): string => {
    if (timeFormat === '24h') {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    } else {
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      if (minute === 0 && !isGranularView) {
        return `${displayHour} ${period}`
      }
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
    }
  }

  // Week navigation with smooth transitions
  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      if (!prev) return prev
      
      // Since currentWeekStart is already the start of the week,
      // we just need to add/subtract 7 days to get the next/previous week start
      const newWeekStart = new Date(prev)
      newWeekStart.setDate(newWeekStart.getDate() + (direction === 'next' ? 7 : -7))
      
      return newWeekStart
    })
  }, [weekStartDay])

  const navigateToPreviousWeek = useCallback(() => {
    navigateWeek('prev')
  }, [navigateWeek])

  const navigateToNextWeek = useCallback(() => {
    navigateWeek('next')
  }, [navigateWeek])

  const navigateToToday = useCallback(() => {
    const today = new Date()
    // Calculate the start of the week based on user preference
    const currentDay = today.getDay()
    const daysFromStart = (currentDay - weekStartDay + 7) % 7
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - daysFromStart)
    startOfWeek.setHours(0, 0, 0, 0)
    setCurrentWeekStart(startOfWeek)
  }, [weekStartDay])

  const isLunchSlot = useCallback(
    (hour: number, minute: number = 0) => {
      if (lunchEndHour === lunchStartHour) {
        return false
      }

      const normalizedStart = Math.max(0, Math.min(24, lunchStartHour))
      const normalizedEnd = Math.max(0, Math.min(24, lunchEndHour))

      // Ensure we have ascending range
      const rangeStart = Math.min(normalizedStart, normalizedEnd)
      const rangeEnd = Math.max(normalizedStart, normalizedEnd)

      const slotTime = hour + minute / 60
      return slotTime >= rangeStart && slotTime < rangeEnd
    },
    [lunchStartHour, lunchEndHour]
  )


  // Essential task handler functions
  const handleTaskClick = useCallback((task: any) => {
    setSelectedTask(task)
    setShowEditModal(true)
  }, [])

  const handleTaskComplete = useCallback(async (task: any) => {
    if (!userId || !task.date) {
      console.warn('Cannot complete task: missing userId or task.date', { userId, taskDate: task.date })
      return
    }

    try {
      const isCurrentlyCompleted = task.completed
      const planId = task.plan_id || null
      const scheduledDate = task.date // This should be in YYYY-MM-DD format
      
      console.log('Handling task completion:', {
        taskId: task.task_id,
        scheduledDate,
        planId,
        isCurrentlyCompleted,
        taskDate: task.date
      })
      
      if (isCurrentlyCompleted) {
        // Mark as incomplete: delete the completion record
        let deleteQuery = supabase
          .from('task_completions')
          .delete()
          .eq('user_id', userId)
          .eq('task_id', task.task_id)
          .eq('scheduled_date', scheduledDate)
        
        // Handle plan_id matching (both NULL for free-mode, or both equal)
        if (planId === null) {
          deleteQuery = deleteQuery.is('plan_id', null)
        } else {
          deleteQuery = deleteQuery.eq('plan_id', planId)
        }
        
        const { error, data } = await deleteQuery
        
        if (error) {
          console.error('Error removing task completion:', error)
          return
        }
        
        console.log('Task marked as incomplete:', { taskId: task.task_id, deleted: data })
      } else {
        // Mark as complete: insert a completion record
        // Note: task_completions.plan_id is now nullable (allows free-mode tasks)
        // For free-mode tasks, plan_id can be null
        // For plan-based tasks, we'll use the plan_id from the task
        let finalPlanId = planId
        
        // If plan_id is null, try to get it from task_schedule
        if (finalPlanId === null) {
          const { data: scheduleData } = await supabase
            .from('task_schedule')
            .select('plan_id')
            .eq('id', task.schedule_id)
            .eq('user_id', userId)
            .maybeSingle()
          
          if (scheduleData?.plan_id) {
            finalPlanId = scheduleData.plan_id
          }
        }
        
        // For free-mode tasks, plan_id can be null (schema now allows it)
        // We'll proceed with null plan_id if it's still null after lookup
        
        const insertData: any = {
          user_id: userId,
          task_id: task.task_id,
          scheduled_date: scheduledDate,
          completed_at: new Date().toISOString()
        }
        
        // Only add plan_id if it's not null (schema now allows null for free-mode tasks)
        if (finalPlanId !== null) {
          insertData.plan_id = finalPlanId
        }
        
        const { error, data } = await supabase
          .from('task_completions')
          .insert(insertData)
        
        if (error) {
          console.error('Error inserting task completion:', error)
          // Check if it's a duplicate key error (task already completed)
          if (error.code === '23505') {
            console.log('Task already marked as complete (duplicate key), continuing...')
          } else {
            return
          }
        } else {
          console.log('Task marked as complete:', { taskId: task.task_id, inserted: data })
        }
      }

      // Refresh the task list after completion update
      // Use a small delay to ensure database transaction completes
      setTimeout(() => {
        refetch()
      }, 100)
    } catch (error) {
      console.error('Error updating task completion:', error)
    }
  }, [userId, refetch, supabase])

  const handleTaskDelete = useCallback(async (task: any) => {
    if (!userId) return
    try {
      console.log('🗑️ Deleting task:', task.name, 'schedule_id:', task.schedule_id, 'task_id:', task.task_id)
      
      // Immediately remove from UI for instant feedback
      removeOptimisticTask(task.task_id)
      
      // Close the edit modal immediately
      setShowEditModal(false)
      setSelectedTask(null)
      
      // Delete from task_schedule table
      const { error: scheduleError } = await supabase
        .from('task_schedule')
        .delete()
        .eq('id', task.schedule_id)
        .eq('user_id', userId)

      if (scheduleError) {
        console.error('Error deleting task schedule:', scheduleError)
        // If deletion fails, refresh to restore the task
        refetch()
        return
      }
      console.log('✅ Task schedule deleted successfully')

      // Delete from tasks table
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.task_id)
        .eq('user_id', userId)

      if (taskError) {
        console.error('Error deleting task:', taskError)
        // If deletion fails, refresh to restore the task
        refetch()
        return
      }
      console.log('✅ Task deleted successfully')

      // Refresh the task list to ensure UI is in sync
      console.log('🔄 Refreshing tasks after deletion...')
      setTimeout(() => {
        refetch()
      }, 100)
    } catch (error) {
      console.error('Error deleting task:', error)
      // If deletion fails, refresh to restore the task
      refetch()
    }
  }, [userId, refetch, removeOptimisticTask])

  const handleSaveTaskTime = useCallback(async (
    scheduleId: string,
    startTime: string,
    endTime: string,
    recurrenceData?: { isRecurring: boolean; isIndefinite: boolean; recurrenceDays: number[]; recurrenceStartDate?: string; recurrenceEndDate?: string }
  ) => {
    try {
      // Check if this is a synthetic task
      const isSynthetic = scheduleId?.startsWith('synthetic-')
      
      // If synthetic and not recurring, block the update
      if (isSynthetic && !recurrenceData?.isRecurring) {
        return { success: false, error: 'Cannot edit synthetic tasks. These are generated automatically from recurring task settings.' }
      }

      // If it's a recurring task and we have recurrence data, update the task itself
      // This handles both synthetic and non-synthetic recurring tasks
      if (recurrenceData && recurrenceData.isRecurring && selectedTask) {
        const updateData: any = {
          recurrence_days: recurrenceData.recurrenceDays
        }
        
        if (recurrenceData.isIndefinite) {
          // For indefinite recurring tasks, update default times
          updateData.default_start_time = startTime + ':00'
          updateData.default_end_time = endTime + ':00'
        } else {
          // For date-bounded recurring tasks, update date range
          if (recurrenceData.recurrenceStartDate) {
            updateData.recurrence_start_date = recurrenceData.recurrenceStartDate
          }
          if (recurrenceData.recurrenceEndDate) {
            updateData.recurrence_end_date = recurrenceData.recurrenceEndDate
          }
        }

        const { error: taskError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', selectedTask.task_id)
          .eq('user_id', userId)

        if (taskError) {
          console.error('Error updating recurring task:', taskError)
          return { success: false, error: taskError.message }
        }

        // Refresh tasks after update
        await refetch()
        setShowEditModal(false)
        setSelectedTask(null)

        return { success: true }
      }

      // Regular schedule update for non-recurring tasks (skip if synthetic)
      if (!isSynthetic) {
      const { error } = await supabase
        .from('task_schedule')
        .update({
          start_time: startTime,
          end_time: endTime,
          duration_minutes: calculateDuration(startTime, endTime)
        })
        .eq('id', scheduleId)

      if (error) {
        console.error('Error updating task time:', error)
        return { success: false, error: error.message }
        }
      } else {
        // Synthetic task that's not recurring - shouldn't happen, but handle gracefully
        return { success: false, error: 'Cannot update synthetic task schedule.' }
      }

      // Refresh tasks after update
      await refetch()
      setShowEditModal(false)
      setSelectedTask(null)

      return { success: true }
    } catch (error) {
      console.error('Error updating task time:', error)
      return { success: false, error: 'Failed to update task time' }
    }
  }, [refetch, selectedTask, userId])

  // Get week date range for display
  const getWeekDateRange = useCallback(() => {
    if (!currentWeekStart) {
      // Fallback to current week if no week start is set
      const today = new Date()
      const startOfWeek = getStartOfWeek(today)
      const weekEnd = new Date(startOfWeek)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      const startStr = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${startStr} - ${endStr}`
    }
    // Normalize header to the user's configured start-of-week so it matches grid columns
    const normalizedStart = getStartOfWeek(currentWeekStart)
    const weekEnd = new Date(normalizedStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    
    const startStr = normalizedStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startStr} - ${endStr}`
  }, [currentWeekStart, getStartOfWeek])

  // Generate weeks for week picker tooltip
  const getWeeksInMonth = useCallback((month: number, year: number) => {
    const weeks = []
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const firstWeekStart = getStartOfWeek(firstDay)
    
    let currentWeekStart = new Date(firstWeekStart)
    
    while (currentWeekStart <= lastDay || currentWeekStart.getMonth() === month - 1) {
      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      weeks.push({
        start: new Date(currentWeekStart),
        end: weekEnd
      })
      
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
      
      // Prevent infinite loop
      if (weeks.length > 6) break
    }
    
    return weeks
  }, [getStartOfWeek])

  // Update selectedDate to today when week changes (only if today is in current week)
  useEffect(() => {
    if (!currentWeekStart) return
    
    const today = new Date()
    const todayString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    
    // Check if today is in the current week
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    
    const todayDate = new Date(todayString + 'T00:00:00')
    if (todayDate >= currentWeekStart && todayDate <= weekEnd) {
      setSelectedDate(todayString)
    } else {
      // If today is not in current week, select the first day of the week
      const firstDayString = `${currentWeekStart.getFullYear()}-${(currentWeekStart.getMonth() + 1).toString().padStart(2, '0')}-${currentWeekStart.getDate().toString().padStart(2, '0')}`
      setSelectedDate(firstDayString)
    }
  }, [currentWeekStart])

  // Generate time slots based on granular view
  const timeSlots = useMemo(() => {
    const slots = []
    
    if (isGranularView) {
      // Show 15-minute intervals
      for (let hour = 0; hour < 24; hour++) {
        for (let min = 0; min < 60; min += 15) {
          slots.push({
            hour,
            minute: min,
            label: formatTime(hour, min),
            isExtraRow: false
          })
        }
      }
    } else {
      // Show 1-hour intervals
      for (let hour = 0; hour < 24; hour++) {
        slots.push({
          hour,
          minute: 0,
          label: formatTime(hour, 0),
          isExtraRow: false
        })
      }
    }
    
    return slots
  }, [isGranularView, timeFormat])

  // Calculate row height based on granular view
  const getRowHeight = () => {
    return isGranularView ? 25 : 50
  }

  const rowHeight = getRowHeight()
  const targetRowHeight = isGranularView ? 25 : 50

  const clampHour = (hour: number) => Math.max(0, Math.min(24, hour))
  const lunchStartHourClamped = clampHour(lunchStartHour)
  let lunchEndHourClamped = clampHour(lunchEndHour)
  if (lunchEndHourClamped <= lunchStartHourClamped) {
    lunchEndHourClamped = clampHour(lunchStartHourClamped + 1)
  }
  const lunchRangeTooltip = `Lunch: ${formatTime(lunchStartHourClamped % 24, 0)} - ${formatTime(lunchEndHourClamped % 24, 0)}`

  // Show loading state
  if (isLoadingSettings || isLoadingPlan) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-[#0a0a0a] overflow-hidden">
        <Sidebar 
          currentPath="/schedule" 
          onSignOut={handleSignOut} 
          hasPendingReschedules={hasGlobalPendingReschedules}
          emailConfirmed={emailConfirmed}
        />
        <div className="ml-64 h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-[#d7d2cb]">Loading schedule...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-[#0a0a0a] overflow-hidden">
      <Sidebar 
        currentPath="/schedule" 
        onSignOut={handleSignOut} 
        hasPendingReschedules={hasGlobalPendingReschedules}
        emailConfirmed={emailConfirmed}
      />
      
      {/* Merged Floating Panel - Week Selector & Add Task */}
      <div 
        className="fixed z-50 select-none group"
        style={{ 
          left: `${panelPosition.x}px`,
          top: `${panelPosition.y}px`
        }}
        onMouseEnter={() => setHoveredPanel(true)}
        onMouseLeave={() => setHoveredPanel(false)}
        onMouseDown={(e) => handlePanelMouseDown(e)}
      >
        <div 
          className={`bg-gray-200/80 dark:glass-panel backdrop-blur-md border border-gray-300 dark:border-white/20 p-4 shadow-lg dark:shadow-2xl relative rounded-lg transition-all duration-300 ease-out ${
            draggingPanel ? 'opacity-90' : ''
          } ${
            hoveredPanel ? 'cursor-move' : 'cursor-default'
          }`}
          style={{
            transform: hoveredPanel 
              ? 'translateY(-4px)' 
              : 'translateY(0)',
            boxShadow: hoveredPanel
              ? '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : undefined,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          
          <div className="flex items-center space-x-4">
            {/* Week Navigation */}
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateToPreviousWeek}
              className="text-[#d7d2cb] hover:text-[var(--primary)] hover:bg-white/10"
            >
              <LeftArrow className="w-4 h-4" />
            </Button>
            
            <div className="text-center flex items-center gap-3 relative">
              <div className="cursor-pointer relative" onClick={() => setShowDatePicker(!showDatePicker)}>
                <motion.div 
                  key={currentWeekStart?.toISOString()}
                  className="text-lg font-semibold text-white hover:text-[var(--primary)] transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {getWeekDateRange()}
                </motion.div>
                {currentWeekStart && (
                  <div className="text-xs text-[#d7d2cb]/70 mt-0.5">
                    {currentWeekStart.getFullYear()}
                  </div>
                )}
                
                {/* Week Picker Tooltip */}
                {showDatePicker && (
                  <AnimatePresence>
                    <motion.div
                      ref={weekPickerRef}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-[#0a0a0a]/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-4 z-50 min-w-[320px]"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div 
                        className="flex items-center justify-between mb-4"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-3">
                          <select
                            value={selectedMonth ?? (currentWeekStart ? currentWeekStart.getMonth() + 1 : new Date().getMonth() + 1)}
                            onChange={(e) => {
                              e.stopPropagation()
                              setSelectedMonth(Number(e.target.value))
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-sm cursor-pointer"
                          >
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                              <option key={m} value={m}>
                                {new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                              </option>
                            ))}
                          </select>
                          <select
                            value={selectedYear ?? (currentWeekStart ? currentWeekStart.getFullYear() : new Date().getFullYear())}
                            onChange={(e) => {
                              e.stopPropagation()
                              setSelectedYear(Number(e.target.value))
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-sm cursor-pointer"
                          >
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDatePicker(false)
                          }}
                          className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Weeks Grid */}
                      <div 
                        className="space-y-2 max-h-[300px] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const month = selectedMonth ?? (currentWeekStart ? currentWeekStart.getMonth() + 1 : new Date().getMonth() + 1)
                          const year = selectedYear ?? (currentWeekStart ? currentWeekStart.getFullYear() : new Date().getFullYear())
                          const weeks = getWeeksInMonth(month, year)
                          
                          return weeks.map((week, index) => {
                            const normalizedWeekStart = getStartOfWeek(week.start)
                            const normalizedCurrentWeek = currentWeekStart ? getStartOfWeek(currentWeekStart) : null
                            const isCurrentWeek = normalizedCurrentWeek && 
                              normalizedWeekStart.getTime() === normalizedCurrentWeek.getTime()
                            const startStr = week.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            const endStr = week.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            
                            return (
                              <button
                                key={`${week.start.toISOString()}-${index}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCurrentWeekStart(week.start)
                                  setShowDatePicker(false)
                                  setSelectedYear(null)
                                  setSelectedMonth(null)
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                  isCurrentWeek
                                    ? 'bg-[var(--primary)] text-white'
                                    : 'bg-white/5 hover:bg-white/10 text-[#d7d2cb]'
                                }`}
                              >
                                <div className="text-sm font-medium">
                                  {startStr} - {endStr}
                                </div>
                              </button>
                            )
                          })
                        })()}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateToNextWeek}
              className="text-[#d7d2cb] hover:text-[var(--primary)] hover:bg-white/10"
            >
              <RightArrow className="w-4 h-4" />
            </Button>

            {/* Today Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateToToday}
              className="bg-gray-200/80 dark:bg-white/10 border border-gray-300 dark:border-white/20 text-[#d7d2cb] hover:bg-white/20 dark:hover:bg-white/20 text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            >
              Today
            </Button>

            {/* Divider */}
            <div className="h-8 w-px bg-white/20"></div>

            {/* Add Task Button */}
            <Button
              onClick={() => {
                // Clear selected values when opening via Add Task button
                setSelectedDate('')
                setSelectedTimeSlot('')
                setShowCreateModal(true)
              }}
              className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white shadow-lg shadow-[var(--primary)]/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
      </div>
      
      <div className="h-full" style={{ marginLeft: '80px' }}>
        <FadeInWrapper className="h-full">
          {/* Schedule Grid */}
          <div className="h-full bg-gray-200 dark:bg-[#0a0a0a] border border-gray-400 dark:border-white/10 rounded-lg overflow-hidden shadow-sm dark:shadow-none">
            <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-[var(--primary)]/20 scrollbar-track-transparent" ref={gridRef}>
              <motion.div
                className="inline-grid bg-gray-300 dark:bg-[#0a0a0a] relative"
                style={{ 
                  gridTemplateColumns: `140px repeat(7, minmax(150px, 1fr))`,
                  minWidth: '100%',
                  minHeight: `${timeSlots.length * rowHeight + 50}px`
                }}
                animate={{
                  minHeight: `${timeSlots.length * rowHeight + 50}px`
                }}
                transition={{
                  duration: 0.4,
                  ease: "easeInOut"
                }}
                key={currentWeekStart?.toISOString()}
              >
                {/* Current Time Indicator */}
                {isCurrentTimeVisible && (() => {
                  // Find the current day column index
                  const today = new Date()
                  const todayString = formatDateForDB(today) // Use local date formatting
                  const currentDayIndex = weekDays.findIndex(day => day.dateString === todayString)
                  
                  if (currentDayIndex === -1) return null
                  
                  // Calculate the left and right positions for the current day column
                  // Use CSS calc to properly handle the grid layout
                  const timeColumnWidth = 140
                  const leftPosition = `calc(${timeColumnWidth}px + ${currentDayIndex} * (100% - ${timeColumnWidth}px) / 7)`
                  const rightPosition = `calc(${timeColumnWidth}px + ${currentDayIndex + 1} * (100% - ${timeColumnWidth}px) / 7)`
                  
                  return (
                    <motion.div
                      className="absolute z-20"
                      style={{
                        top: `${getCurrentTimePosition() + 50}px`, // +50px to account for header height
                        left: leftPosition,
                        right: `calc(100% - ${rightPosition})`,
                        height: '2px'
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="h-full bg-[var(--primary)] shadow-lg shadow-[var(--primary)]/50 relative">
                        {/* Time tab - always visible */}
                        <div className="absolute -left-1 -top-1 bg-[var(--primary)] rounded-md px-2 py-1 shadow-lg">
                          <div className="text-white text-xs font-medium whitespace-nowrap">
                            {currentTime.toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: timeFormat === '12h'
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })()}
                {/* Granular view toggle corner cell */}
                    <div className={`sticky top-0 left-0 z-20 border-r border-b ${
                      theme === 'dark'
                        ? 'bg-[#0a0a0a]/95 border-white/10'
                        : 'bg-white/95 border-gray-200'
                    }`} style={{ height: '50px' }}>
                  <div className="flex items-center justify-center h-full">
                    <motion.button
                      onClick={() => setIsGranularView(!isGranularView)}
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        isGranularView 
                          ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/60 shadow-lg shadow-[var(--primary)]/20' 
                          : theme === 'dark'
                            ? 'text-[#d7d2cb]/40 hover:text-[#d7d2cb] hover:bg-white/5'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      animate={{
                        scale: isGranularView ? 1.05 : 1,
                        rotate: isGranularView ? 5 : 0
                      }}
                      transition={{
                        duration: 0.3,
                        ease: "easeInOut"
                      }}
                    >
                      <Expand className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>

                {/* Day Headers */}
                {weekDays.map((day, dayIndex) => {
                  console.log('Rendering day header:', {
                    dayIndex,
                    dateString: day.dateString,
                    dayName: day.dayName,
                    fullDate: day.date.toDateString(),
                    key: day.dateString
                  })
                  
                  return (
                    <motion.div
                      key={`${day.dateString}-${dayIndex}`} // Add index to ensure uniqueness
                      className={`sticky top-0 z-10 border-b p-2 text-center transition-colors relative ${
                        day.isSelected 
                          ? 'bg-[var(--primary)] text-white' 
                          : theme === 'dark'
                            ? 'bg-[#0a0a0a]/95 border-white/10 text-[#d7d2cb]'
                            : 'bg-white/95 border-gray-200 text-gray-900'
                      }`}
                      style={{ height: '50px' }}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: dayIndex * 0.05,
                        ease: "easeOut"
                      }}
                    >
                      <div className="text-sm font-semibold">{day.dayName}</div>
                      <div className="text-xs opacity-75 mt-0.5">
                        {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </motion.div>
                  )
                })}

                {/* Time Grid Rows */}
                <AnimatePresence>
                  {timeSlots.map((slot, slotIndex) => {
                    const slotKey = `${slot.hour}-${slot.minute}`
                    const isLunchTimeSlot = !slot.isExtraRow && isLunchSlot(slot.hour, slot.minute)
                    const showLunchIndicator = isLunchTimeSlot && (!isGranularView || slot.minute === 0)
                    return (
                      <React.Fragment key={`time-${slot.hour}-${slot.minute}-${slot.isExtraRow ? 'extra' : 'regular'}`}>
                        {/* Time Label */}
                        <motion.div
                          layout
                          className={`sticky left-0 z-10 border-r border-b p-2 flex items-center justify-end ${
                            theme === 'dark'
                              ? 'bg-[#0a0a0a]/95 border-white/10 text-[#d7d2cb]'
                              : 'bg-white/95 border-gray-200 text-gray-900'
                          }`}
                          style={{ 
                            height: `${rowHeight}px`,
                            opacity: 1
                          }}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ 
                            height: `${rowHeight}px`, 
                            opacity: 1
                          }}
                          transition={{
                            duration: 0.4,
                            ease: [0.4, 0, 0.2, 1],
                            delay: isGranularView ? slotIndex * 0.02 : 0,
                            layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
                          }}
                          exit={{ 
                            opacity: 0,
                            height: 0,
                            transition: {
                              duration: 0.2,
                              ease: [0.4, 0, 0.2, 1]
                            }
                          }}
                        >
                        <div
                          className={`relative flex items-center justify-end w-full pr-1 ${
                            isLunchTimeSlot ? 'pl-5' : ''
                          }`}
                          title={isLunchTimeSlot ? lunchRangeTooltip : undefined}
                          aria-label={isLunchTimeSlot ? lunchRangeTooltip : undefined}
                          onMouseEnter={() => {
                            if (isLunchTimeSlot) {
                              setHoveredLunchSlot(slotKey)
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredLunchSlot(prev => (prev === slotKey ? null : prev))
                          }}
                          onFocus={() => {
                            if (isLunchTimeSlot) {
                              setHoveredLunchSlot(slotKey)
                            }
                          }}
                          onBlur={() => {
                            setHoveredLunchSlot(prev => (prev === slotKey ? null : prev))
                          }}
                        >
                          {isLunchTimeSlot && (
                            <UtensilsCrossed
                              className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 ${
                                theme === 'dark'
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              }`}
                            />
                          )}
                          <AnimatePresence>
                            {hoveredLunchSlot === slotKey && isLunchTimeSlot && (
                              <motion.div
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                className={`pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-medium shadow-lg border ${
                                  theme === 'dark'
                                    ? 'bg-[#0a0a0a]/95 text-[#d7d2cb] border-white/10'
                                    : 'bg-white text-gray-800 border-gray-200'
                                }`}
                              >
                                {lunchRangeTooltip}
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <span
                            className={`relative z-10 pl-2 text-xs font-medium ${
                              showLunchIndicator ? 'text-[var(--primary)] font-semibold' : ''
                            }`}
                          >
                            {slot.label}
                          </span>
                        </div>
                      </motion.div>

                      {/* Time Slots for each day */}
                      {weekDays.map((day, dayIndex) => {
                        // Do not render tasks in the extra rows (00:00–02:00 duplicates at bottom)
                        if (slot.isExtraRow) {
                          return (
                            <motion.div
                              layout
                              key={`${day.dateString}-${dayIndex}-${slot.hour}-${slot.minute}-extra`}
                              className={`border-b border-r transition-colors relative cursor-default ${
                                theme === 'dark'
                                  ? 'border-white/10'
                                  : 'bg-white border-gray-200'
                              }`}
                              style={{ 
                                height: `${rowHeight}px`,
                                minHeight: `${rowHeight}px`,
                                opacity: 1
                              }}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ 
                                height: `${rowHeight}px`, 
                                opacity: 1 
                              }}
                              transition={{
                                duration: 0.4,
                                ease: [0.4, 0, 0.2, 1],
                                delay: isGranularView ? slotIndex * 0.02 : 0,
                                layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
                              }}
                              exit={{ 
                                opacity: 0,
                                height: 0,
                                transition: {
                                  duration: 0.2,
                                  ease: [0.4, 0, 0.2, 1]
                                }
                              }}
                            />
                          )
                        }
                        const dayTasks = getTasksForDateWithOptimistic(day.dateString)
                        const tasksForDay = dayTasks
                        
                        // Debug logging removed to prevent console spam
                        
                        
                        
                        
                        // Calculate tasks that start in this time slot
                        const tasksInThisSlot = tasksForDay.filter(task => {
                          if (!task.start_time || !task.end_time) return false
                          
                          const taskStartHour = parseInt(task.start_time.split(':')[0])
                          const taskStartMinute = parseInt(task.start_time.split(':')[1])
                          
                          const taskStartMinutes = taskStartHour * 60 + taskStartMinute
                          const slotStartMinutes = slot.hour * 60 + slot.minute
                          const slotEndMinutes = slotStartMinutes + (isGranularView ? 15 : 60)
                          
                          // Only include tasks that START in this time slot
                          return taskStartMinutes >= slotStartMinutes && taskStartMinutes < slotEndMinutes
                        })
                        
                        // Calculate how many tasks overlap at each minute within this slot
                        const overlappingTasks = tasksInThisSlot.map(task => {
                          const taskStartHour = parseInt(task.start_time!.split(':')[0])
                          const taskStartMinute = parseInt(task.start_time!.split(':')[1])
                          const taskEndHour = parseInt(task.end_time!.split(':')[0])
                          const taskEndMinute = parseInt(task.end_time!.split(':')[1])
                          
                          const taskStartMinutes = taskStartHour * 60 + taskStartMinute
                          const taskEndMinutes = taskEndHour * 60 + taskEndMinute
                          const slotStartMinutes = slot.hour * 60 + slot.minute
                          const slotEndMinutes = slotStartMinutes + (isGranularView ? 15 : 60)
                          
                          return {
                            ...task,
                            startMinutes: Math.max(taskStartMinutes, slotStartMinutes),
                            endMinutes: Math.min(taskEndMinutes, slotEndMinutes),
                            originalStartMinutes: taskStartMinutes,
                            originalEndMinutes: taskEndMinutes
                          }
                        })
                        
                        // Detect overlapping tasks for this day
                        const overlappingGroups = detectOverlappingTasks(tasksForDay)
                        
                        // Filter to only render the group in the slot that contains the group's earliest start time
                        const relevantOverlapGroups = overlappingGroups.filter(group => {
                          const groupEarliestStart = Math.min(
                            ...group.tasks.map(t => {
                              const h = parseInt(t.start_time!.split(':')[0])
                              const m = parseInt(t.start_time!.split(':')[1])
                              return h * 60 + m
                            })
                          )
                          const slotStartMinutes = slot.hour * 60 + slot.minute
                          const slotEndMinutes = slotStartMinutes + (isGranularView ? 15 : 60)
                          return groupEarliestStart >= slotStartMinutes && groupEarliestStart < slotEndMinutes
                        })
                        
                        // Get tasks that are NOT in any overlap group (including all groups, not just relevant ones)
                        const allTasksInOverlapGroups = new Set(
                          overlappingGroups.flatMap(group => group.tasks.map(t => t.schedule_id))
                        )
                        
                        const nonOverlappingTasks = tasksInThisSlot.filter(task => 
                          !allTasksInOverlapGroups.has(task.schedule_id)
                        )
                        
                        return (
                          <motion.div
                            layout
                            key={`${day.dateString}-${dayIndex}-${slot.hour}-${slot.minute}`}
                            className={`border-b border-r transition-colors relative ${
                              slot.isExtraRow 
                                ? 'cursor-default' 
                                : 'cursor-pointer'
                            } ${
                              day.isSelected 
                                ? theme === 'dark'
                                  ? 'border-white/10'
                                  : ''
                                : theme === 'dark'
                                  ? 'border-white/10 hover:bg-white/10'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                            style={{ 
                              height: `${rowHeight}px`,
                              minHeight: `${rowHeight}px`,
                              opacity: 1,
                              ...(day.isSelected ? 
                                theme === 'dark' ? {
                                  backgroundColor: 'color-mix(in srgb, var(--primary) 10%, #0a0a0a)',
                                  borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)'
                                } : {
                                  backgroundColor: 'color-mix(in srgb, var(--primary) 15%, white)',
                                  borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)'
                                } 
                              : {})
                            }}
                            onMouseEnter={(e) => {
                              if (day.isSelected && !slot.isExtraRow) {
                                if (theme === 'dark') {
                                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 20%, #0a0a0a)'
                                } else {
                                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 25%, white)'
                                }
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (day.isSelected && !slot.isExtraRow) {
                                if (theme === 'dark') {
                                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 10%, #0a0a0a)'
                                } else {
                                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 15%, white)'
                                }
                              }
                            }}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ 
                              height: `${rowHeight}px`, 
                              opacity: 1 
                            }}
                            transition={{
                              duration: 0.4,
                              ease: [0.4, 0, 0.2, 1],
                              delay: isGranularView ? slotIndex * 0.02 : 0,
                              layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
                            }}
                            exit={{ 
                              opacity: 0,
                              height: 0,
                              transition: {
                                duration: 0.2,
                                ease: [0.4, 0, 0.2, 1]
                              }
                            }}
                            onClick={() => {
                              // Disable interaction for extra rows
                              if (slot.isExtraRow) return
                              
                              // Only open create modal if there are no tasks that start in this slot
                              if (tasksInThisSlot.length === 0) {
                                const timeString = `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
                                console.log('Clicked time slot:', { slot, timeString, day: day.dateString })
                                
                                // Update state and then open modal
                                setSelectedTimeSlot(timeString)
                                setSelectedDate(day.dateString)
                                
                                // Use setTimeout to ensure state is updated before modal opens
                                setTimeout(() => {
                                  setShowCreateModal(true)
                                }, 0)
                              }
                            }}
                          >
                            {/* Render MultipleTasksPanel for overlapping groups - only for the earliest task */}
                            {relevantOverlapGroups.map((overlapGroup) => {
                              // Find the earliest task in the group that starts in this slot
                              const earliestTaskInSlot = overlapGroup.tasks
                                .filter(task => {
                                  if (!task.start_time || !task.end_time) return false
                                  
                                  const taskStartHour = parseInt(task.start_time.split(':')[0])
                                  const taskStartMinute = parseInt(task.start_time.split(':')[1])
                                  const taskStartMinutes = taskStartHour * 60 + taskStartMinute
                                  const slotStartMinutes = slot.hour * 60 + slot.minute
                                  const slotEndMinutes = slotStartMinutes + (isGranularView ? 15 : 60)
                                  
                                  return taskStartMinutes >= slotStartMinutes && taskStartMinutes < slotEndMinutes
                                })
                                .sort((a, b) => {
                                  const aStartMinutes = parseInt(a.start_time!.split(':')[0]) * 60 + parseInt(a.start_time!.split(':')[1])
                                  const bStartMinutes = parseInt(b.start_time!.split(':')[0]) * 60 + parseInt(b.start_time!.split(':')[1])
                                  return aStartMinutes - bStartMinutes
                                })[0]
                              
                              if (!earliestTaskInSlot) return null
                              
                              // Calculate position based on the earliest task's start time
                              const taskStartHour = parseInt(earliestTaskInSlot.start_time!.split(':')[0])
                              const taskStartMinute = parseInt(earliestTaskInSlot.start_time!.split(':')[1])
                              const startMinutes = taskStartHour * 60 + taskStartMinute
                              const slotStartMinutes = slot.hour * 60 + slot.minute
                              
                              // Calculate position relative to the slot start
                              const relativeStartMinutes = Math.max(0, startMinutes - slotStartMinutes)
                              const topPosition = (relativeStartMinutes / (isGranularView ? 15 : 60)) * rowHeight
                              
                              // Calculate height based on the full overlap group duration
                              const groupStartMinutes = Math.min(...overlapGroup.tasks.map(t => {
                                const startHour = parseInt(t.start_time!.split(':')[0])
                                const startMinute = parseInt(t.start_time!.split(':')[1])
                                return startHour * 60 + startMinute
                              }))
                              const groupEndMinutes = Math.max(...overlapGroup.tasks.map(t => {
                                const endHour = parseInt(t.end_time!.split(':')[0])
                                const endMinute = parseInt(t.end_time!.split(':')[1])
                                return endHour * 60 + endMinute
                              }))
                              
                              const fullDurationMinutes = groupEndMinutes - groupStartMinutes
                              const height = Math.max(40, (fullDurationMinutes / (isGranularView ? 15 : 60)) * rowHeight)
                              
                              return (
                                <MultipleTasksPanel
                                  key={overlapGroup.id}
                                  overlapGroup={overlapGroup}
                                  topPosition={topPosition}
                                  height={height}
                                  theme={theme}
                                  onTaskClick={handleTaskClick}
                                  onTaskComplete={handleTaskComplete}
                                  isExpanded={expandedMultiPanels.has(overlapGroup.id)}
                                  onToggleExpanded={() => handleToggleMultiPanel(overlapGroup.id)}
                                  currentTime={currentTime}
                                />
                              )
                            })}
                            
                            {/* Render individual TaskBlocks for non-overlapping tasks */}
                            {nonOverlappingTasks.map((task, taskIndex) => {
                              const taskStartHour = parseInt(task.start_time!.split(':')[0])
                              const taskStartMinute = parseInt(task.start_time!.split(':')[1])
                              const startMinutes = taskStartHour * 60 + taskStartMinute
                              const slotStartMinutes = slot.hour * 60 + slot.minute
                              
                              // Calculate task end time first
                              const taskEndMinutes = parseInt(task.end_time!.split(':')[0]) * 60 + parseInt(task.end_time!.split(':')[1])
                              
                              // Only render if task starts in this slot AND is scheduled for this day
                              const slotEndMinutes = slotStartMinutes + (isGranularView ? 15 : 60)
                              const startsInSlot = startMinutes >= slotStartMinutes && startMinutes < slotEndMinutes
                              const isScheduledForThisDay = task.date === day.dateString
                              
                              if (!startsInSlot || !isScheduledForThisDay) return null
                              
                              // For non-expanded view, calculate position relative to the slot start
                              const relativeStartMinutes = Math.max(0, startMinutes - slotStartMinutes)
                              const topPosition = (relativeStartMinutes / (isGranularView ? 15 : 60)) * rowHeight
                              
                              // Calculate height based on full task duration
                              const fullDurationMinutes = taskEndMinutes - startMinutes
                              const height = Math.max(20, (fullDurationMinutes / (isGranularView ? 15 : 60)) * rowHeight)
                              
                              return (
                                <TaskBlock
                                  key={task.schedule_id}
                                  task={{
                                    ...task,
                                    priority: task.priority ?? undefined,
                                    complexity_score: task.complexity_score ?? undefined
                                  }}
                                  topPosition={topPosition}
                                  height={height}
                                  theme={theme}
                                  onDragStart={() => {}}
                                  onDragEnd={() => {}} // Disabled dragging
                                  onClick={() => handleTaskClick(task)}
                                  onComplete={() => handleTaskComplete(task)}
                                  currentTime={currentTime}
                                  style={{
                                    left: '0%',
                                    width: '100%',
                                    zIndex: 5
                                  }}
                                />
                              )
                            })}
                          </motion.div>
                        )
                      })}
                    </React.Fragment>
                  )
                  })}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </FadeInWrapper>
      </div>

            {/* Task Time Edit Modal */}
            <TaskTimeEditModal
              task={selectedTask}
              isOpen={showEditModal}
              onClose={() => {
                setShowEditModal(false)
                setSelectedTask(null)
              }}
              onSave={handleSaveTaskTime}
              onDelete={handleTaskDelete}
              theme={theme}
              onRescheduleComplete={async () => {
                // Refetch pending reschedules so the modal appears
                await refetchPending()
                // Also refetch tasks to update status
                refetch()
              }}
            />

            {/* Create Task Modal */}
            <CreateTaskModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onTaskCreated={(taskData) => {
                // Add optimistic task immediately for instant UI feedback
                if (taskData) {
                  console.log('✨ Adding optimistic task:', taskData)
                  addOptimisticTask(taskData)
                }
                
                // Refresh the task list to show the new task
                // Add a small delay to ensure database transaction completes
                setTimeout(() => {
                  console.log('🔄 Refreshing tasks after creation...')
                  refetch()
                }, 200)
              }}
              selectedDate={selectedDate}
              selectedTime={selectedTimeSlot}
              theme={theme}
              currentWeekStart={currentWeekStart}
              timeFormat={timeFormat}
            />
            
            <SchedulerDebugDashboard
              isOpen={showDebugDashboard}
              onClose={() => setShowDebugDashboard(false)}
            />

            {/* Reschedule Approval Modal */}
            <RescheduleApprovalModal
              isOpen={showRescheduleModal}
              onClose={() => setShowRescheduleModal(false)}
              onDismiss={(proposalIds) => {
                // Mark proposals as dismissed (temporary - will show again on next visit)
                setDismissedProposalIds(prev => {
                  const newSet = new Set(prev)
                  proposalIds.forEach(id => newSet.add(id))
                  return newSet
                })
                setShowRescheduleModal(false)
              }}
              proposals={allPendingReschedules.filter(
                proposal => !dismissedProposalIds.has(proposal.id)
              )}
              planId={currentPlanId || null}
              onAccept={async (proposalIds) => {
                try {
                  const response = await fetch('/api/reschedules/accept', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      proposalIds
                    })
                  })

                  if (!response.ok) {
                    throw new Error('Failed to accept reschedules')
                  }

                  // Clear dismissed IDs for accepted proposals (they're permanently resolved)
                  setDismissedProposalIds(prev => {
                    const newSet = new Set(prev)
                    proposalIds.forEach(id => newSet.delete(id))
                    return newSet
                  })

                  // Refresh tasks after acceptance
                  refetch()
                  await refetchPending()
                } catch (error) {
                  console.error('Error accepting reschedules:', error)
                  throw error
                }
              }}
              onReject={async (proposalIds) => {
                try {
                  const response = await fetch('/api/reschedules/reject', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      proposalIds
                    })
                  })

                  if (!response.ok) {
                    throw new Error('Failed to reject reschedules')
                  }

                  // Clear dismissed IDs for rejected proposals (they're permanently resolved)
                  setDismissedProposalIds(prev => {
                    const newSet = new Set(prev)
                    proposalIds.forEach(id => newSet.delete(id))
                    return newSet
                  })

                  // Refresh tasks after rejection
                  refetch()
                  await refetchPending()
                } catch (error) {
                  console.error('Error rejecting reschedules:', error)
                  throw error
                }
              }}
              onMarkComplete={async (proposalIds) => {
                if (!userId) {
                  throw new Error('User not authenticated')
                }

                try {
                  // Get the proposals to mark as complete
                  const proposalsToComplete = allPendingReschedules.filter(p => proposalIds.includes(p.id))
                  
                  // Mark each task as complete
                  for (const proposal of proposalsToComplete) {
                    let planId = proposal.plan_id || null
                    const scheduledDate = proposal.original_date // Use original_date as scheduled_date
                    
                    // If plan_id is null, try to get it from task_schedule or tasks table
                    if (planId === null) {
                      // Try to get plan_id from task_schedule
                      const { data: scheduleData } = await supabase
                        .from('task_schedule')
                        .select('plan_id')
                        .eq('task_id', proposal.task_id)
                        .eq('date', scheduledDate)
                        .eq('user_id', userId)
                        .maybeSingle()
                      
                      if (scheduleData?.plan_id) {
                        planId = scheduleData.plan_id
                      } else {
                        // Try to get plan_id from tasks table
                        const { data: taskData } = await supabase
                          .from('tasks')
                          .select('plan_id')
                          .eq('id', proposal.task_id)
                          .eq('user_id', userId)
                          .maybeSingle()
                        
                        if (taskData?.plan_id) {
                          planId = taskData.plan_id
                        }
                      }
                    }
                    
                    // For free-mode tasks, plan_id can be null (schema now allows it)
                    // We'll proceed with null plan_id if it's still null after lookup
                    
                    // Check if task is already completed to avoid duplicate inserts
                    let existingCompletionQuery = supabase
                      .from('task_completions')
                      .select('id')
                      .eq('user_id', userId)
                      .eq('task_id', proposal.task_id)
                      .eq('scheduled_date', scheduledDate)
                    
                    // Handle plan_id matching (both NULL for free-mode, or both equal)
                    if (planId === null) {
                      existingCompletionQuery = existingCompletionQuery.is('plan_id', null)
                    } else {
                      existingCompletionQuery = existingCompletionQuery.eq('plan_id', planId)
                    }
                    
                    const { data: existingCompletion } = await existingCompletionQuery.maybeSingle()
                    
                    // Skip if already completed
                    if (existingCompletion) {
                      console.log('Task already marked as complete:', proposal.task_id)
                      continue
                    }
                    
                    const insertData: any = {
                      user_id: userId,
                      task_id: proposal.task_id,
                      scheduled_date: scheduledDate,
                      completed_at: new Date().toISOString()
                    }
                    
                    // Only add plan_id if it's not null (schema now allows null for free-mode tasks)
                    if (planId !== null) {
                      insertData.plan_id = planId
                    }
                    
                    const { error: completionError } = await supabase
                      .from('task_completions')
                      .insert(insertData)
                    
                    if (completionError) {
                      console.error('Error marking task as complete:', completionError)
                      // If it's a duplicate key error, that's okay - task is already complete
                      if (completionError.code === '23505') {
                        console.log('Task completion already exists (duplicate key), continuing...')
                        continue
                      }
                      // For other errors, log and continue with other tasks
                      continue
                    }
                    
                    console.log('Task marked as complete from reschedule modal:', {
                      taskId: proposal.task_id,
                      scheduledDate,
                      planId
                    })
                  }

                  // Reject the reschedule proposals since tasks are complete
                  const rejectResponse = await fetch('/api/reschedules/reject', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      proposalIds
                    })
                  })

                  if (!rejectResponse.ok) {
                    throw new Error('Failed to reject reschedules after marking complete')
                  }

                  // Clear dismissed IDs for completed proposals (they're permanently resolved)
                  setDismissedProposalIds(prev => {
                    const newSet = new Set(prev)
                    proposalIds.forEach(id => newSet.delete(id))
                    return newSet
                  })

                  // Refresh tasks after marking complete
                  refetch()
                  await refetchPending()
                } catch (error) {
                  console.error('Error marking tasks as complete:', error)
                  throw error
                }
              }}
            />

            {/* Switch Plan Modal */}
            <SwitchPlanModal
              isOpen={showSwitchPlanModal}
              onClose={() => setShowSwitchPlanModal(false)}
              hasActivePlan={!!currentPlanId}
              currentPlanTitle={activePlansForWeek.size > 0 ? Array.from(activePlansForWeek.values())[0]?.name : undefined}
              onPlanChanged={() => {
                // Reload plan data
                const loadSettings = async () => {
                  try {
                    // Reload active plan using existing userId
                    if (!userId) return

                    const { data: planData } = await supabase
                      .from('plans')
                      .select('id, status, start_date')
                      .eq('user_id', userId)
                      .eq('status', 'active')
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single()

                    if (planData) {
                      setCurrentPlanId(planData.id)
                      setHasPlan(true)
                    } else {
                      setHasPlan(false)
                      setCurrentPlanId(null)
                    }
                    
                    // Refresh tasks
                    refetch()
                  } catch (error) {
                    console.error('Error reloading plan after switch:', error)
                  }
                }
                loadSettings()
              }}
            />
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff7f00] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ScheduleContent />
    </Suspense>
  )
}