'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Calendar, Target, Clock, Edit2, Save, X, AlertTriangle, ListTodo } from 'lucide-react'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { RoadmapCalendar, InteractiveRoadmap } from '@/components/ui'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { TaskEditModal, MilestoneEditModal, DateEditModal } from '@/components/ui/EditModals'
import { supabase } from '@/lib/supabase/client'
import { useUserRoadmap } from '@/hooks/useUserRoadmap'
import { 
  getTasksByDate,
  isTaskCompleted,
  getCompletedTasks,
  getUserProgress
} from '@/lib/roadmap-client'
import { 
  toLocalMidnight, 
  parseDateFromDB, 
  formatDateForDB, 
  daysBetween,
  formatDateForDisplay,
  getDayNumber,
  getToday
} from '@/lib/date-utils'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'

export default function RoadmapPage() {
  const router = useRouter()
  const [highlightedDates, setHighlightedDates] = useState<string[]>([])
  const [timelineDays, setTimelineDays] = useState<number>(45)
  const [endDate, setEndDate] = useState<string>('2025-12-24T12:00:00')
  const [startDate, setStartDate] = useState<string>('')
  const [generatedMilestones, setGeneratedMilestones] = useState<any[]>([])
  const [generatedTasks, setGeneratedTasks] = useState<{[key: string]: string[]}>({})
  const [generatedMilestoneTasks, setGeneratedMilestoneTasks] = useState<{[key: string]: string[]}>({})
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [completedMilestoneTasks, setCompletedMilestoneTasks] = useState<Set<string>>(new Set())
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set())
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentPlanId, setCurrentPlanId] = useState<string>('')
  const [currentDay, setCurrentDay] = useState<number>(1)
  const [timeLeft, setTimeLeft] = useState<{
    months: string
    days: string
    hours: string
    minutes: string
    seconds: string
  }>({
    months: '00',
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00'
  })
  const [animationTime, setAnimationTime] = useState(0)
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editedStartDate, setEditedStartDate] = useState<string>('')
  const [editedEndDate, setEditedEndDate] = useState<string>('')
  const [editedMilestones, setEditedMilestones] = useState<Map<string, any>>(new Map())
  const [editedTasks, setEditedTasks] = useState<Map<string, any>>(new Map())
  const [deletedItems, setDeletedItems] = useState<{milestones: string[], tasks: string[]}>({milestones: [], tasks: []})
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [showEditModal, setShowEditModal] = useState<{type: 'milestone' | 'task' | 'date' | null, id: string | null, data?: any}>({type: null, id: null})
  const [isSaving, setIsSaving] = useState(false)
  
  // Manual plan edit mode state
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showDayOptions, setShowDayOptions] = useState(false)
  const [newMilestones, setNewMilestones] = useState<any[]>([])
  const [newTasks, setNewTasks] = useState<any[]>([])
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskCategory, setNewTaskCategory] = useState<'daily_task' | 'milestone_task'>('daily_task')
  const [newTaskMilestoneId, setNewTaskMilestoneId] = useState('')
  
  // Use onboarding protection hook
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  
  // Fetch real roadmap data
  const { roadmapData, loading: roadmapLoading, refetch, updateTask } = useUserRoadmap(user?.id)


  // Load completed tasks from database
  const loadCompletedTasks = async (userId: string, planId: string) => {
    try {
      const completedTasksData = await getCompletedTasks(userId, planId)
      
      const completedTasksSet = new Set<string>()
      const completedMilestoneTasksSet = new Set<string>()
      
      completedTasksData.forEach(completion => {
        // Find the task to get its name for UI matching
        const task = roadmapData?.tasks?.find((t: any) => t.id === completion.taskId)
        if (task) {
          // Create task ID using the format expected by the UI: date-taskName
          const taskName = task.category === 'milestone_task' ? `🏆 ${task.name}` : task.name
          const taskId = `${completion.scheduledDate}-${taskName}`
          
          if (task.category === 'milestone_task') {
            completedMilestoneTasksSet.add(taskId)
          } else {
            completedTasksSet.add(taskId)
          }
        }
      })
      
      setCompletedTasks(completedTasksSet)
      setCompletedMilestoneTasks(completedMilestoneTasksSet)
    } catch (error) {
      console.error('Error loading completed tasks:', error)
    }
  }

  // Load real roadmap data when available
  useEffect(() => {
    const loadRoadmapData = async () => {
      if (!roadmapData || !roadmapData.plan || roadmapLoading) return;
      
      try {
        const plan = roadmapData.plan
        const milestones = roadmapData.milestones || []
        const tasks = roadmapData.tasks || []

        console.log('🔄 Loading roadmap data:', { 
          planId: plan.id, 
          milestonesCount: milestones.length, 
          tasksCount: tasks.length,
          tasks: tasks.map((t: any) => ({ id: t.id, name: t.name, category: t.category }))
        })

        // Set user and plan info
        setCurrentPlanId(plan.id)
        setCurrentUser({ id: plan.user_id })

        // Parse dates as local midnight to prevent timezone drift
        const startDateObj = parseDateFromDB(plan.start_date)
        const endDateObj = parseDateFromDB(plan.end_date)
        
        // Set dates (keep as strings for state, but use formatted correctly)
        setStartDate(formatDateForDB(startDateObj))
        setEndDate(formatDateForDB(endDateObj))
        
        // Calculate timeline days using proper date utils
        const days = daysBetween(startDateObj, endDateObj)
        setTimelineDays(days)

        // Calculate current day in the roadmap
        const today = getToday()
        const calculatedCurrentDay = getDayNumber(today, startDateObj)
        // Ensure current day doesn't exceed total days
        const actualCurrentDay = Math.min(calculatedCurrentDay, days)
        setCurrentDay(actualCurrentDay)

        // Load completed tasks
        await loadCompletedTasks(plan.user_id, plan.id)

        // Convert milestones to UI format with proper date handling
        const formattedMilestones = milestones.map((milestone: any) => {
          const milestoneDate = parseDateFromDB(milestone.target_date)
          const dayNumber = getDayNumber(milestoneDate, startDateObj)
          
          return {
            id: milestone.id,
            title: milestone.name,
            description: milestone.rationale || '',
            day: dayNumber,
            status: 'pending', // Default status since it's not in DB
            estimated_date: milestoneDate,
            progress: 0 // Default progress since it's not in DB
          }
        })
        
        setGeneratedMilestones(formattedMilestones)

          // Group tasks by date
          const tasksByDate = await getTasksByDate(plan.id)
          
          // Separate regular tasks and milestone tasks
          const regularTasks: {[key: string]: string[]} = {}
          const milestoneTasks: {[key: string]: string[]} = {}
          
          Object.entries(tasksByDate).forEach(([date, dateTasks]: [string, any]) => {
            const regularTaskNames: string[] = []
            const milestoneTaskNames: string[] = []
            
            dateTasks.forEach((task: any) => {
              // Handle both object and string formats
              const taskName = typeof task === 'string' ? task : task.name
              const taskCategory = typeof task === 'string' ? (task.includes('Milestone') ? 'milestone_task' : 'daily_task') : task.category
              
              if (taskCategory === 'milestone_task') {
                milestoneTaskNames.push(taskName)
              } else {
                regularTaskNames.push(taskName)
              }
            })
            
            if (regularTaskNames.length > 0) {
              regularTasks[date] = regularTaskNames
            }
            if (milestoneTaskNames.length > 0) {
              milestoneTasks[date] = milestoneTaskNames
            }
          })
          
          // Add milestone completion markers to milestone target dates
          milestones.forEach((milestone: any) => {
            const milestoneDateStr = formatDateForDB(parseDateFromDB(milestone.target_date))
            if (!regularTasks[milestoneDateStr]) {
              regularTasks[milestoneDateStr] = []
            }
            // Add milestone marker (will be shown with special styling)
            regularTasks[milestoneDateStr].push(`🎯 ${milestone.name}`)
          })
          
          setGeneratedTasks(regularTasks)
          setGeneratedMilestoneTasks(milestoneTasks)

          console.log('Loaded roadmap data:', { 
            plan, 
            startDate: startDateObj, 
            endDate: endDateObj,
            milestones: formattedMilestones, 
            tasksByDate
          })
      } catch (error) {
        console.error('Error loading roadmap data:', error)
      }
    }

    loadRoadmapData()
  }, [roadmapData?.plan?.id, roadmapLoading]) // Only depend on plan ID, not the entire roadmapData object

  // Countdown timer with proper date handling
  useEffect(() => {
    if (!endDate) return

    const updateCountdown = () => {
      const now = new Date()
      const end = parseDateFromDB(endDate) // Parse as local midnight
      
      // Set end time to end of the day (23:59:59) for accurate countdown
      end.setHours(23, 59, 59, 999)
      
      const difference = end.getTime() - now.getTime()

      if (difference > 0) {
        const totalSeconds = Math.floor(difference / 1000)
        const totalMinutes = Math.floor(totalSeconds / 60)
        const totalHours = Math.floor(totalMinutes / 60)
        const totalDays = Math.floor(totalHours / 24)
        
        let months = 0
        let remainingDays = 0
        
        // Use toLocalMidnight for consistent date handling
        let currentDate = toLocalMidnight(now)
        const endMidnight = toLocalMidnight(end)
        
        // Calculate months by finding how many complete months are between current and end date
        while (currentDate < endMidnight) {
          const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate())
          if (nextMonth <= endMidnight) {
            months++
            currentDate = nextMonth
          } else {
            // Calculate remaining days after the last complete month
            const timeDiff = endMidnight.getTime() - currentDate.getTime()
            remainingDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
            break
          }
        }

        const remainingHours = totalHours % 24
        const remainingMinutes = totalMinutes % 60
        const remainingSeconds = totalSeconds % 60

        setTimeLeft({
          months: months.toString().padStart(2, '0'),
          days: remainingDays.toString().padStart(2, '0'),
          hours: remainingHours.toString().padStart(2, '0'),
          minutes: remainingMinutes.toString().padStart(2, '0'),
          seconds: remainingSeconds.toString().padStart(2, '0')
        })
      } else {
        // Countdown finished
        setTimeLeft({
          months: '00',
          days: '00',
          hours: '00',
          minutes: '00',
          seconds: '00'
        })
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [endDate])

  // Animation for glassmorphism sweep effect
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTime(prev => prev + 0.0005)
    }, 16)
    return () => clearInterval(interval)
  }, [])

  // Realtime subscription for auto-refresh when tasks change
  useEffect(() => {
    if (!user?.id || !roadmapData?.plan?.id) return
    
    console.log('Roadmap: Setting up realtime subscription for plan updates')
    
    const channel = supabase
      .channel('roadmap_plan_update')
      .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'task_completions',
            filter: `plan_id=eq.${roadmapData.plan.id}`
          },
          (payload) => {
            console.log('Roadmap: Task completion changed, refreshing...', payload)
            // Refetch roadmap data to get updated milestone statuses
            refetch()
          })
      .subscribe()
    
    return () => { 
      console.log('Roadmap: Cleaning up realtime subscription')
      supabase.removeChannel(channel) 
    }
  }, [user?.id, roadmapData?.plan?.id, refetch])

  // Get sweep position for glassmorphism effect - smooth oscillation
  const getSweepPosition = () => {
    const sweepProgress = Math.sin(animationTime * Math.PI * 2) * 0.5 + 0.5 // 0 to 1
    return sweepProgress * 100
  }

  // Memoize all milestone tasks to prevent infinite re-renders
  const allMilestoneTasks = useMemo(() => {
    const tasksMap = new Map()
    
    if (roadmapData && roadmapData.tasks && generatedMilestones) {
      generatedMilestones.forEach((milestone: any) => {
        const tasks: {date: string, task: string}[] = []
        
        const milestoneTasks = roadmapData.tasks.filter((task: any) => 
          task.milestone_id === milestone.id && task.category === 'milestone_task'
        )
        
        milestoneTasks.forEach((task: any) => {
          // Get the scheduled date from task_schedule, or use milestone target date as fallback
          if (task.task_schedule && task.task_schedule.length > 0) {
            const scheduledDate = task.task_schedule[0].date
            tasks.push({ 
              date: scheduledDate, 
              task: `🏆 ${task.name}` 
            })
          } else {
            // If no task_schedule, use the milestone target date as fallback
            const fallbackDate = formatDateForDB(milestone.estimated_date)
            tasks.push({ 
              date: fallbackDate, 
              task: `🏆 ${task.name}` 
            })
          }
        })
        
        // Sort using parseDateFromDB for consistent date comparison
        const sortedTasks = tasks.sort((a, b) => {
          const dateA = parseDateFromDB(a.date)
          const dateB = parseDateFromDB(b.date)
          return dateA.getTime() - dateB.getTime()
        })
        
        tasksMap.set(milestone.id, sortedTasks)
      })
    }
    
    return tasksMap
  }, [roadmapData, generatedMilestones])

  // Prepare tasks data for calendar component
  const calendarTasksData = useMemo(() => {
    if (!roadmapData?.tasks) return []
    
    const tasksByDate: { [date: string]: string[] } = {}
    
    roadmapData.tasks.forEach((task: any) => {
      if (task.task_schedule && task.task_schedule.length > 0) {
        const scheduledDate = task.task_schedule[0].date
        if (!tasksByDate[scheduledDate]) {
          tasksByDate[scheduledDate] = []
        }
        
        // Add task with appropriate prefix based on category
        const taskName = task.category === 'milestone_task' ? `🏆 ${task.name}` : task.name
        tasksByDate[scheduledDate].push(taskName)
      }
    })
    
    // Convert to array format expected by calendar
    return Object.entries(tasksByDate).map(([date, tasks]) => ({
      date,
      tasks
    }))
  }, [roadmapData])

  // Get milestone tasks for a specific milestone
  const getMilestoneTasks = (milestone: any) => {
    return allMilestoneTasks.get(milestone.id) || []
  }

  // Calculate milestone progress percentage
  const calculateMilestoneProgress = (milestone: any) => {
    const milestoneTasks = getMilestoneTasks(milestone)
    if (milestoneTasks.length === 0) return 0
    
    const completedTasks = milestoneTasks.filter((taskItem: any) => {
      const taskId = `${taskItem.date}-${taskItem.task}`
      return completedMilestoneTasks.has(taskId)
    })
    
    return Math.round((completedTasks.length / milestoneTasks.length) * 100)
  }

  // Get milestone status (completed or in_progress)
  const getMilestoneStatus = (milestone: any) => {
    const progress = calculateMilestoneProgress(milestone)
    return progress === 100 ? 'completed' : 'in_progress'
  }

  // Memoize milestone progress calculations to prevent infinite re-renders
  const allMilestoneProgress = useMemo(() => {
    const progressMap = new Map()
    
    if (roadmapData && roadmapData.tasks && generatedMilestones) {
      const today = toLocalMidnight(new Date())
      
      generatedMilestones.forEach((milestone: any) => {
        const milestoneDate = toLocalMidnight(milestone.estimated_date)
        
        // Count total milestone tasks for this milestone
        let totalMilestoneTasks = 0
        let completedMilestoneTasksCount = 0
        
        const milestoneTasks = roadmapData.tasks.filter((task: any) => 
          task.milestone_id === milestone.id && task.category === 'milestone_task'
        )
        
        milestoneTasks.forEach((task: any) => {
          // Get the scheduled date from task_schedule, or use milestone target date as fallback
          let scheduledDate: string
          if (task.task_schedule && task.task_schedule.length > 0) {
            scheduledDate = task.task_schedule[0].date
          } else {
            // If no task_schedule, use the milestone target date as fallback
            scheduledDate = formatDateForDB(milestone.estimated_date)
          }
          
          const taskDate = parseDateFromDB(scheduledDate)
          if (taskDate <= milestoneDate) {
            totalMilestoneTasks++
            // Use the same prefixed format as the calendar for consistency
            const taskId = `${scheduledDate}-🏆 ${task.name}`
            if (completedMilestoneTasks.has(taskId)) {
              completedMilestoneTasksCount++
            }
          }
        })
        
        // If no milestone tasks exist, return 0
        if (totalMilestoneTasks === 0) {
          progressMap.set(milestone.id, 0)
          return
        }
        
        // Calculate progress based on completed tasks
        const progress = Math.round((completedMilestoneTasksCount / totalMilestoneTasks) * 100)
        
        // If milestone is past AND all tasks are completed, it's 100%
        const finalProgress = (today > milestoneDate && completedMilestoneTasksCount === totalMilestoneTasks) ? 100 : progress
        progressMap.set(milestone.id, finalProgress)
      })
    }
    
    return progressMap
  }, [roadmapData, generatedMilestones, completedMilestoneTasks])

  // Convert generated tasks to calendar format (combine regular and milestone tasks)
  const calendarTasks = useMemo(() => {
    const allTasks = new Map<string, string[]>()
    
    // Add regular tasks
    Object.entries(generatedTasks).forEach(([date, tasks]) => {
      allTasks.set(date, tasks)
    })
    
    // Add milestone tasks with a prefix to identify them
    if (allMilestoneTasks) {
      allMilestoneTasks.forEach((tasks: {date: string, task: string}[]) => {
        tasks.forEach(({date, task}) => {
          if (allTasks.has(date)) {
            allTasks.set(date, [...allTasks.get(date)!, task])
          } else {
            allTasks.set(date, [task])
          }
        })
      })
    }
    
    // In edit mode, add new milestones and tasks
    if (isEditMode) {
      // Add new milestones
      newMilestones.forEach(milestone => {
        const date = milestone.target_date
        if (allTasks.has(date)) {
          allTasks.set(date, [...allTasks.get(date)!, `🎯 ${milestone.name}`])
        } else {
          allTasks.set(date, [`🎯 ${milestone.name}`])
        }
      })
      
      // Add new tasks
      newTasks.forEach(task => {
        const date = task.scheduled_date
        const taskName = task.category === 'milestone_task' ? `🏆 ${task.name}` : task.name
        if (allTasks.has(date)) {
          allTasks.set(date, [...allTasks.get(date)!, taskName])
        } else {
          allTasks.set(date, [taskName])
        }
      })
    }
    
    return Array.from(allTasks.entries()).map(([date, tasks]) => ({
      date,
      tasks
    }))
  }, [generatedTasks, allMilestoneTasks, isEditMode, newMilestones, newTasks])

  // Removed generateRandomRoadmap function - all roadmap data now comes from database

  // Removed random roadmap generation - calendar now only shows real user data from database
  // Data is loaded by the loadRoadmapData useEffect when roadmapData becomes available

  // Validation function
  const validateChanges = useCallback(() => {
    const warnings: string[] = []
    
    // Validate date range
    if (editedStartDate && editedEndDate) {
      const start = parseDateFromDB(editedStartDate)
      const end = parseDateFromDB(editedEndDate)
      
      if (end <= start) {
        warnings.push('End date must be after start date')
      }
      
      // Check for tasks/milestones outside date range
      editedMilestones.forEach((milestone) => {
        const mDate = parseDateFromDB(milestone.target_date)
        if (mDate < start || mDate > end) {
          warnings.push(`Milestone "${milestone.title}" is outside the date range`)
        }
      })
      
      editedTasks.forEach((task) => {
        const tDate = parseDateFromDB(task.scheduled_date)
        if (tDate < start || tDate > end) {
          warnings.push(`Task "${task.name}" is scheduled outside the date range`)
        }
      })
    }
    
    // Check for completed task edits
    editedTasks.forEach((task) => {
      const taskId = `${task.scheduled_date}-${task.name}`
      if (completedTasks.has(taskId) || completedMilestoneTasks.has(taskId)) {
        warnings.push(`Task "${task.name}" is completed - edits preserved`)
      }
    })
    
    setValidationWarnings(warnings)
    return warnings
  }, [editedStartDate, editedEndDate, editedMilestones, editedTasks, completedTasks, completedMilestoneTasks])

  // Helper function to validate and ensure unique indices
  const validateAndGetNextIndices = async (planId: string, milestoneCount: number, taskCount: number) => {
    // Get current max indices for both milestones and tasks
    const [milestonesResult, tasksResult] = await Promise.all([
      supabase
        .from('milestones')
        .select('idx')
        .eq('plan_id', planId)
        .order('idx', { ascending: false })
        .limit(1),
      supabase
        .from('tasks')
        .select('idx')
        .eq('plan_id', planId)
        .order('idx', { ascending: false })
        .limit(1)
    ])
    
    if (milestonesResult.error) throw milestonesResult.error
    if (tasksResult.error) throw tasksResult.error
    
    const maxMilestoneIdx = milestonesResult.data && milestonesResult.data.length > 0 ? milestonesResult.data[0].idx : 0
    const maxTaskIdx = tasksResult.data && tasksResult.data.length > 0 ? tasksResult.data[0].idx : 0
    
    console.log('📊 Index validation - Max milestone idx:', maxMilestoneIdx, 'Max task idx:', maxTaskIdx)
    
    return {
      milestoneStartIdx: maxMilestoneIdx + 1,
      taskStartIdx: maxTaskIdx + 1,
      maxMilestoneIdx,
      maxTaskIdx
    }
  }

  // Save changes handler
  const handleSaveChanges = useCallback(async () => {
    const warnings = validateChanges()
    
    // Block save if critical errors exist
    const criticalErrors = warnings.filter(w => w.includes('must be'))
    if (criticalErrors.length > 0) {
      alert('Please fix validation errors before saving')
      return
    }
    
    setIsSaving(true)
    
    try {
      // Update plan dates
      if (editedStartDate !== startDate || editedEndDate !== endDate) {
        await supabase
          .from('plans')
          .update({ start_date: editedStartDate, end_date: editedEndDate })
          .eq('id', currentPlanId)
      }
      
      // Update milestones
      for (const [id, milestone] of editedMilestones) {
        await supabase
          .from('milestones')
          .update({ 
            name: milestone.title, 
            rationale: milestone.description,
            target_date: milestone.target_date 
          })
          .eq('id', id)
      }
      
      // Delete items
      if (deletedItems.milestones.length > 0) {
        console.log('🗑️ Deleting milestones:', deletedItems.milestones)
        const { error: milestoneDeleteError } = await supabase
          .from('milestones')
          .delete()
          .in('id', deletedItems.milestones)
        
        if (milestoneDeleteError) {
          console.error('Error deleting milestones:', milestoneDeleteError)
          throw milestoneDeleteError
        }
        console.log('✅ Milestones deleted successfully')
      }
      
      if (deletedItems.tasks.length > 0) {
        console.log('🗑️ Deleting tasks:', deletedItems.tasks)
        const { error: taskDeleteError } = await supabase
          .from('tasks')
          .delete()
          .in('id', deletedItems.tasks)
        
        if (taskDeleteError) {
          console.error('Error deleting tasks:', taskDeleteError)
          throw taskDeleteError
        }
        console.log('✅ Tasks deleted successfully')
      }
      
      // Update tasks
      for (const [id, task] of editedTasks) {
        console.log('📝 Updating task:', id, task)
        
        const { error: taskUpdateError } = await supabase
          .from('tasks')
          .update({ name: task.name })
          .eq('id', id)
        
        if (taskUpdateError) {
          console.error('Error updating task:', taskUpdateError)
          throw taskUpdateError
        }
        
        // Update task_schedule
        const { error: scheduleUpdateError } = await supabase
          .from('task_schedule')
          .update({ date: task.scheduled_date })
          .eq('task_id', id)
        
        if (scheduleUpdateError) {
          console.error('Error updating task schedule:', scheduleUpdateError)
          throw scheduleUpdateError
        }
        
        console.log('✅ Task updated successfully:', id)
      }
      
      // Validate indices before creating any new items
      const indexInfo = await validateAndGetNextIndices(currentPlanId, newMilestones.length, newTasks.length)
      
      // Add new milestones and create ID mapping
      const milestoneIdMap = new Map<string, string>() // temp ID -> real ID
      if (newMilestones.length > 0) {
        console.log('🎯 Creating new milestones:', newMilestones)
        
        const milestonePromises = newMilestones.map(async (milestone, index) => {
          const milestoneIdx = indexInfo.milestoneStartIdx + index
          console.log(`Creating milestone ${index + 1}: ${milestone.name} with idx: ${milestoneIdx}`)
          
          const { data: savedMilestone, error } = await supabase
            .from('milestones')
            .insert({
              plan_id: currentPlanId,
              user_id: user?.id,
              name: milestone.name,
              rationale: milestone.description,
              target_date: milestone.target_date,
              idx: milestoneIdx // Use proper sequential idx
            })
            .select()
            .single()
          
          if (error) {
            console.error('Milestone creation error:', error)
            console.error('Milestone creation error details:', JSON.stringify(error, null, 2))
            throw error
          }
          
          // Map temp ID to real ID
          milestoneIdMap.set(milestone.id, savedMilestone.id)
          console.log(`✅ Milestone created: ${milestone.name} (${milestone.id} -> ${savedMilestone.id}) with idx: ${milestoneIdx}`)
          return savedMilestone
        })
        
        await Promise.all(milestonePromises)
      }
      
      // Add new tasks
      if (newTasks.length > 0) {
        console.log('📝 Creating new tasks:', newTasks)
        
        const taskPromises = newTasks.map(async (task, index) => {
          const taskIdx = indexInfo.taskStartIdx + index
          
          // Replace temp milestone_id with real ID if it exists
          let realMilestoneId = task.milestone_id
          if (realMilestoneId && realMilestoneId.startsWith('temp-')) {
            realMilestoneId = milestoneIdMap.get(realMilestoneId) || null
            console.log(`🔄 Mapped milestone ID: ${task.milestone_id} -> ${realMilestoneId}`)
          }
          
          console.log(`Creating task ${index + 1}:`, task.name, 'for date:', task.scheduled_date, 'with idx:', taskIdx, 'milestone_id:', realMilestoneId)
          
          const { data: createdTask, error: taskError } = await supabase
            .from('tasks')
            .insert({
              plan_id: currentPlanId,
              user_id: user?.id,
              name: task.name,
              category: task.category,
              milestone_id: realMilestoneId || null,
              idx: taskIdx // Use proper sequential idx
            })
            .select()
            .single()
          
          if (taskError) {
            console.error('Task creation error:', taskError)
            console.error('Task creation error details:', JSON.stringify(taskError, null, 2))
            console.error('Task data that failed:', { plan_id: currentPlanId, user_id: user?.id, name: task.name, category: task.category, milestone_id: task.milestone_id || null, idx: taskIdx })
            throw taskError
          }
          
          console.log('✅ Task created:', createdTask)
          
          // Calculate day index for task_schedule
          const taskDate = parseDateFromDB(task.scheduled_date)
          const planStartDate = parseDateFromDB(startDate)
          const dayIndex = Math.floor((taskDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          
          console.log(`Creating task schedule for task ${createdTask.id}, day index: ${dayIndex}`)
          
          // Create task schedule
          const { error: scheduleError } = await supabase
            .from('task_schedule')
            .insert({
              plan_id: currentPlanId,
              user_id: user?.id,
              task_id: createdTask.id,
              day_index: dayIndex,
              date: task.scheduled_date,
              milestone_id: realMilestoneId || null // Use the real milestone ID, not the temp one
            })
          
          if (scheduleError) {
            console.error('Task schedule creation error:', scheduleError)
            console.error('Task schedule error details:', JSON.stringify(scheduleError, null, 2))
            console.error('Task schedule data that failed:', { 
              plan_id: currentPlanId, 
              user_id: user?.id, 
              task_id: createdTask.id, 
              day_index: dayIndex, 
              date: task.scheduled_date, 
              milestone_id: realMilestoneId 
            })
            throw scheduleError
          }
          
          console.log('✅ Task schedule created successfully')
          return createdTask
        })
        
        const createdTasks = await Promise.all(taskPromises)
        console.log('✅ All tasks created:', createdTasks)
      }
      
      // Final validation: Check for any duplicate indices
      console.log('🔍 Performing final index validation...')
      const [finalMilestonesCheck, finalTasksCheck] = await Promise.all([
        supabase
          .from('milestones')
          .select('idx')
          .eq('plan_id', currentPlanId)
          .order('idx', { ascending: true }),
        supabase
          .from('tasks')
          .select('idx')
          .eq('plan_id', currentPlanId)
          .order('idx', { ascending: true })
      ])
      
      if (finalMilestonesCheck.error) throw finalMilestonesCheck.error
      if (finalTasksCheck.error) throw finalTasksCheck.error
      
      // Check for duplicate milestone indices
      const milestoneIndices = finalMilestonesCheck.data?.map(m => m.idx) || []
      const duplicateMilestoneIndices = milestoneIndices.filter((idx, i) => milestoneIndices.indexOf(idx) !== i)
      if (duplicateMilestoneIndices.length > 0) {
        console.error('❌ Duplicate milestone indices found:', duplicateMilestoneIndices)
        throw new Error(`Duplicate milestone indices detected: ${duplicateMilestoneIndices.join(', ')}`)
      }
      
      // Check for duplicate task indices
      const taskIndices = finalTasksCheck.data?.map(t => t.idx) || []
      const duplicateTaskIndices = taskIndices.filter((idx, i) => taskIndices.indexOf(idx) !== i)
      if (duplicateTaskIndices.length > 0) {
        console.error('❌ Duplicate task indices found:', duplicateTaskIndices)
        throw new Error(`Duplicate task indices detected: ${duplicateTaskIndices.join(', ')}`)
      }
      
      console.log('✅ Index validation passed - no duplicates found')
      
      // Refetch data
      console.log('🔄 Refetching roadmap data after save...')
      await refetch()
      
      // Force a small delay to ensure real-time updates have processed
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Reset edit state
      setIsEditMode(false)
      setHasUnsavedChanges(false)
      setEditedMilestones(new Map())
      setEditedTasks(new Map())
      setDeletedItems({milestones: [], tasks: []})
      setValidationWarnings([])
      setNewMilestones([])
      setNewTasks([])
      
      console.log('✅ Save completed successfully')
      
    } catch (error) {
      console.error('Error saving changes:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available')
      alert('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [validateChanges, editedStartDate, editedEndDate, editedMilestones, editedTasks, deletedItems, currentPlanId, refetch, startDate, endDate, newMilestones, newTasks, generatedMilestones.length])

  // User and profile are now managed by the useOnboardingProtection hook

  // Show loading state while user data is being fetched
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  // Toggle milestone expansion
  const toggleMilestoneExpansion = (milestoneId: string) => {
    const newExpanded = new Set(expandedMilestones)
    if (newExpanded.has(milestoneId)) {
      newExpanded.delete(milestoneId)
    } else {
      newExpanded.add(milestoneId)
    }
    setExpandedMilestones(newExpanded)
  }

  // Manual plan edit mode functions
  const generateId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const handleDateClick = (dateStr: string) => {
    if (!isEditMode) return
    setSelectedDate(dateStr)
    setShowDayOptions(true)
  }

  const getItemsForDate = (dateStr: string) => {
    const items: Array<{
      id: string
      type: 'milestone' | 'milestone_task' | 'daily_task'
      name: string
      milestoneId?: string
      milestoneName?: string
    }> = []
    
    // Check for existing milestones on this date
    generatedMilestones.forEach(m => {
      if (m.estimated_date === dateStr) {
        items.push({
          id: m.id,
          type: 'milestone',
          name: m.title
        })
      }
    })
    
    // Check for new milestones on this date
    newMilestones.forEach(m => {
      if (m.target_date === dateStr) {
        items.push({
          id: m.id,
          type: 'milestone',
          name: m.name
        })
      }
    })
    
    // Check for existing tasks on this date
    if (roadmapData?.tasks) {
      roadmapData.tasks.forEach((task: any) => {
        if (task.task_schedule && task.task_schedule.length > 0) {
          const scheduledDate = task.task_schedule[0].date
          if (scheduledDate === dateStr) {
            items.push({
              id: task.id,
              type: task.category === 'milestone_task' ? 'milestone_task' : 'daily_task',
              name: task.name,
              milestoneId: task.milestone_id,
              milestoneName: task.milestone_id ? generatedMilestones.find(m => m.id === task.milestone_id)?.title : undefined
            })
          }
        }
      })
    }
    
    // Check for new tasks on this date
    newTasks.forEach(t => {
      if (t.scheduled_date === dateStr) {
        items.push({
          id: t.id,
          type: t.category === 'milestone_task' ? 'milestone_task' : 'daily_task',
          name: t.name,
          milestoneId: t.milestone_id,
          milestoneName: t.milestone_id ? newMilestones.find(m => m.id === t.milestone_id)?.name : undefined
        })
      }
    })
    
    return items
  }

  const handleAddMilestone = () => {
    setShowDayOptions(false)
    setShowAddMilestone(true)
  }

  const handleAddTask = () => {
    setShowDayOptions(false)
    setShowAddTask(true)
  }

  const saveMilestone = () => {
    if (!selectedDate || !newMilestoneName.trim()) return
    
    const newMilestone = {
      id: generateId(),
      name: newMilestoneName,
      description: newMilestoneDescription,
      target_date: selectedDate
    }
    
    setNewMilestones(prev => [...prev, newMilestone])
    setHasUnsavedChanges(true)
    
    setNewMilestoneName('')
    setNewMilestoneDescription('')
    setShowAddMilestone(false)
    setSelectedDate(null)
  }

  const saveTask = () => {
    if (!selectedDate || !newTaskName.trim()) return
    
    // Validate milestone task date
    if (newTaskCategory === 'milestone_task' && newTaskMilestoneId) {
      // Find the milestone (could be new or existing)
      const milestone = newMilestones.find(m => m.id === newTaskMilestoneId) || 
                       generatedMilestones.find(m => m.id === newTaskMilestoneId)
      
      if (milestone) {
        const milestoneDate = parseDateFromDB(milestone.target_date || milestone.estimated_date)
        const taskDate = parseDateFromDB(selectedDate)
        
        if (taskDate > milestoneDate) {
          alert(`Cannot schedule a milestone task after its milestone completion date.\n\nMilestone: ${milestone.name}\nCompletion Date: ${formatDateForDisplay(milestoneDate)}\nTask Date: ${formatDateForDisplay(taskDate)}\n\nPlease choose a date on or before the milestone completion date.`)
          return
        }
      }
    }
    
    const newTask = {
      id: generateId(),
      name: newTaskName,
      scheduled_date: selectedDate,
      category: newTaskCategory,
      milestone_id: newTaskMilestoneId || undefined
    }
    
    setNewTasks(prev => [...prev, newTask])
    setHasUnsavedChanges(true)
    
    setNewTaskName('')
    setNewTaskCategory('daily_task')
    setNewTaskMilestoneId('')
    setShowAddTask(false)
    setSelectedDate(null)
  }

  const removeNewMilestone = (milestoneId: string) => {
    setNewMilestones(prev => prev.filter(m => m.id !== milestoneId))
    setHasUnsavedChanges(true)
  }

  const removeNewTask = (taskId: string) => {
    setNewTasks(prev => prev.filter(t => t.id !== taskId))
    setHasUnsavedChanges(true)
  }

  // No more mock milestones - only use generated ones

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Orange border glow effect when in edit mode */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="fixed inset-0 pointer-events-none z-50"
          >
            <div className="absolute inset-0 border-[2px] border-[#ff7f00]/80 shadow-[inset_0_0_20px_rgba(255,127,0,0.5),0_0_20px_rgba(255,127,0,0.5)] animate-pulse" style={{ animationDuration: '3s' }}></div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <Sidebar 
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/roadmap"
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaggeredFadeIn>
          {/* Header Section with Dates and Countdown */}
          <FadeInWrapper delay={0.1} direction="up">
            <div className="mb-8 flex items-end justify-between gap-16">
          {/* Left side - Header text */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-5xl font-bold tracking-tight text-[#d7d2cb]">
                Your Roadmap
              </h1>
              {roadmapData?.plan && (
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ 
                      scale: isEditMode ? 1.05 : 1,
                      transition: { duration: 0.2, ease: "easeOut" }
                    }}
                  >
                <Button
                  onClick={() => {
                    if (!isEditMode) {
                      // Entering edit mode - initialize edit state
                      setEditedStartDate(startDate)
                      setEditedEndDate(endDate)
                    } else {
                      // Exiting edit mode - reset
                          setIsEditMode(false)
                          setHasUnsavedChanges(false)
                      setEditedMilestones(new Map())
                      setEditedTasks(new Map())
                      setDeletedItems({milestones: [], tasks: []})
                      setValidationWarnings([])
                          setNewMilestones([])
                          setNewTasks([])
                    }
                    setIsEditMode(!isEditMode)
                  }}
                  variant={isEditMode ? 'default' : 'outline'}
                  className="h-10"
                    >
                      <motion.div
                        key={isEditMode ? 'cancel' : 'edit'}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center"
                >
                  {isEditMode ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Cancel Edit
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Roadmap
                    </>
                  )}
                      </motion.div>
                </Button>
                  </motion.div>
                  
                  {/* Save Changes button - only show in edit mode after changes */}
                  {isEditMode && hasUnsavedChanges && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex items-center"
                    >
                      <Button
                        onClick={handleSaveChanges}
                        className="h-10 bg-gradient-to-r from-[#ff7f00] to-[#ff9f40] hover:from-[#e67300] hover:to-[#ff7f00] border-0 shadow-none backdrop-blur-sm bg-opacity-80"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
            <p className="text-base leading-relaxed text-[#d7d2cb]/70 max-w-prose">
              {roadmapData?.plan 
                ? "Track your progress and stay on course with your goals. View your upcoming tasks and milestones."
                : "Create a goal to start building your roadmap."}
            </p>
          </div>
          
          {/* Right side - Dates and Countdown */}
          <div className="flex flex-col items-end gap-3">
            {/* Start and End Dates - Always visible with skeletons while loading */}
            <div className="flex items-center gap-4 text-lg font-semibold text-[#d7d2cb]">
              {/* Start Date */}
              <div className="group flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-[#d7d2cb]/50 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200">(start date)</span>
                {roadmapLoading || !startDate ? (
                  <Skeleton className="h-10 w-32 bg-white/5" />
                ) : (
                  <button
                    onClick={() => isEditMode && setShowEditModal({type: 'date', id: 'start'})}
                    className={`bg-white/5 px-4 py-2 rounded-lg border border-white/10 ${isEditMode ? 'hover:bg-white/10 hover:border-white/20 cursor-pointer transition-all' : ''}`}
                  >
                    {formatDateForDisplay(parseDateFromDB(isEditMode && editedStartDate ? editedStartDate : startDate))}
                    {isEditMode && <Edit2 className="w-3 h-3 ml-2 inline-block text-[#d7d2cb]/60" />}
                  </button>
                )}
              </div>
              <span className="text-[#d7d2cb]/60 mt-5">→</span>
              {/* End Date */}
              <div className="group flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-[#d7d2cb]/50 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200">(end date)</span>
                {roadmapLoading || !roadmapData?.plan || !endDate ? (
                  <Skeleton className="h-10 w-32 bg-white/5" />
                ) : (
                  <button
                    onClick={() => isEditMode && setShowEditModal({type: 'date', id: 'end'})}
                    className={`bg-white/5 px-4 py-2 rounded-lg border border-white/10 ${isEditMode ? 'hover:bg-white/10 hover:border-white/20 cursor-pointer transition-all' : ''}`}
                  >
                    {formatDateForDisplay(parseDateFromDB(isEditMode && editedEndDate ? editedEndDate : endDate))}
                    {isEditMode && <Edit2 className="w-3 h-3 ml-2 inline-block text-[#d7d2cb]/60" />}
                  </button>
                )}
              </div>
            </div>
            
            {/* Countdown Timer */}
            <div className="group flex flex-col items-end">
              <span className="text-xs font-semibold text-[#d7d2cb]/50 mb-1 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200">(time left)</span>
              {roadmapLoading || !roadmapData?.plan ? (
                <Skeleton className="h-16 w-[600px] bg-white/5 rounded-xl" />
              ) : (
                <div 
                  className="relative border border-white/35 rounded-xl px-6 py-4 overflow-hidden flex items-center justify-center min-w-[600px]" 
                  style={{
                    backgroundImage: (() => {
                      const sweepPos = getSweepPosition()
                      return `
                        linear-gradient(90deg, 
                          rgba(255,255,255,0.02) 0%, 
                          rgba(255,255,255,0.02) ${Math.max(0, sweepPos - 40)}%, 
                          rgba(255,255,255,0.06) ${sweepPos}%, 
                          rgba(255,255,255,0.02) ${Math.min(100, sweepPos + 40)}%, 
                          rgba(255,255,255,0.02) 100%
                        )
                      `
                    })()
                  }}
                >
                  <div className="flex items-center gap-4 text-[#d7d2cb]/80">
                    <Clock className="w-5 h-5 text-[#ff7f00]" />
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.months}</span>
                      <span className="text-sm text-[#d7d2cb]/60">Months</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.days}</span>
                      <span className="text-sm text-[#d7d2cb]/60">Days</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.hours}</span>
                      <span className="text-sm text-[#d7d2cb]/60">Hours</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.minutes}</span>
                      <span className="text-sm text-[#d7d2cb]/60">Minutes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-[#d7d2cb]">{timeLeft.seconds}</span>
                      <span className="text-sm text-[#d7d2cb]/60">Seconds</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
            </div>
          </FadeInWrapper>


          {/* No Plan State */}
          {!roadmapData?.plan && !roadmapLoading && (
            <FadeInWrapper delay={0.2} direction="up">
              <Card className="text-center py-16">
                <CardContent>
                  <div className="text-[#d7d2cb]/60 mb-4">
                    <Calendar className="w-20 h-20 mx-auto mb-6" />
                  </div>
                  <h2 className="text-3xl font-bold text-[#d7d2cb] mb-3">
                    No Active Plan
                  </h2>
                  <p className="text-[#d7d2cb]/70 mb-6 max-w-md mx-auto">
                    You don't have an active plan. Select an existing plan from your dashboard or create a new one to view your roadmap.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => router.push('/dashboard')}
                      variant="outline"
                      className="px-6 py-3"
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeInWrapper>
          )}

          {/* Main Roadmap Content - Only show if plan exists */}
          {roadmapData?.plan && (
            <>
          {/* Interactive Roadmap */}
          <FadeInWrapper delay={0.2} direction="up">
            <div className="mb-8">
          <InteractiveRoadmap 
            milestones={generatedMilestones}
            totalDays={timelineDays}
            currentDay={currentDay}
            endDate={endDate}
            getMilestoneStatus={getMilestoneStatus}
            hideCountdown={true}
          />
            </div>
          </FadeInWrapper>

          {/* Calendar Widget - Full Width */}
          <FadeInWrapper delay={0.3} direction="up">
            <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-semibold flex items-center gap-3">
                <Calendar className="w-8 h-8 text-[#ff7f00]" />
                {isEditMode ? 'Edit Your Roadmap' : 'Task Calendar'}
              </CardTitle>
              <CardDescription>
                {isEditMode 
                  ? 'Click on any date to add milestones or tasks. Your existing roadmap will remain visible but faded.'
                  : 'Your daily tasks and upcoming milestones'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {startDate && endDate ? (
              <RoadmapCalendar 
                tasks={calendarTasks} 
                showYearDecadeView={true}
                defaultView="month"
                hideDayView={true}
                disableDayPopup={isEditMode}
                categorizedDates={{
                  startDate: parseDateFromDB(startDate),
                      milestones: isEditMode 
                        ? [...generatedMilestones.map(m => m.estimated_date), ...newMilestones.map(m => m.target_date)]
                        : generatedMilestones.map(m => m.estimated_date),
                      milestoneObjects: isEditMode 
                        ? [...generatedMilestones, ...newMilestones.map(m => ({ ...m, estimated_date: m.target_date, title: m.name }))]
                        : generatedMilestones, // Pass full milestone objects for status checking
                  completionDate: parseDateFromDB(endDate)
                }}
                completedTasks={completedTasks}
                completedMilestoneTasks={completedMilestoneTasks}
                getMilestoneStatus={getMilestoneStatus}
                    onDateClick={isEditMode ? handleDateClick : undefined}
                    onTaskClick={!isEditMode ? async (task: string, date: string) => {
                  if (!currentUser?.id || !currentPlanId) return
                  
                  const isMilestoneTask = task.startsWith('🏆')
                  
                  // Extract task name without prefix for database lookup
                  const taskName = isMilestoneTask ? task.substring(2).trim() : task // Remove 🏆 prefix and trim whitespace
                  
                  // Find the actual task ID from the database
                  const actualTask = roadmapData?.tasks?.find((t: any) => {
                    if (isMilestoneTask) {
                      return t.name === taskName && t.category === 'milestone_task'
                    } else {
                      return t.name === taskName && t.category === 'daily_task'
                    }
                  })
                  
                  if (!actualTask) {
                    console.error('Task not found in database:', taskName)
                    return
                  }
                  
                  try {
                    const taskId = `${date}-${task}`
                    const isCurrentlyCompleted = isMilestoneTask 
                      ? completedMilestoneTasks.has(taskId)
                      : completedTasks.has(taskId)
                    
                    // Use unified updateTask API
                    await updateTask(actualTask.id, !isCurrentlyCompleted, currentPlanId, date)
                    
                    if (isMilestoneTask) {
                      const newCompletedMilestoneTasks = new Set(completedMilestoneTasks)
                      if (isCurrentlyCompleted) {
                        newCompletedMilestoneTasks.delete(taskId)
                      } else {
                        newCompletedMilestoneTasks.add(taskId)
                      }
                      setCompletedMilestoneTasks(newCompletedMilestoneTasks)
                    } else {
                      const newCompletedTasks = new Set(completedTasks)
                      if (isCurrentlyCompleted) {
                        newCompletedTasks.delete(taskId)
                      } else {
                        newCompletedTasks.add(taskId)
                      }
                      setCompletedTasks(newCompletedTasks)
                    }
                  } catch (error) {
                    console.error('Error updating task completion:', error)
                  }
                    } : undefined}
              />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-[#d7d2cb]/60">Loading calendar...</div>
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </FadeInWrapper>


          {/* Detailed Milestones Section */}
          <FadeInWrapper delay={0.4} direction="up">
            <div className={`mt-8 transition-all duration-300 ${isEditMode ? 'opacity-60' : 'opacity-100'}`}>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-semibold">All Milestones</CardTitle>
              <CardDescription>
                Detailed view of your roadmap milestones and progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generatedMilestones.length > 0 ? (
                <div className="space-y-4">
                  {generatedMilestones.map((milestone) => {
                    const isExpanded = expandedMilestones.has(milestone.id)
                    const milestoneTasks = getMilestoneTasks(milestone)
                    
                    return (
                      <Card 
                        key={milestone.id} 
                        hover={true}
                        className="border-l-4 border-l-indigo-500"
                        onClick={() => toggleMilestoneExpansion(milestone.id)}
                      >
                        <CardContent className="p-6">
                          {/* Card header - no longer clickable individually */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className={`text-xl font-medium mb-2 ${
                                  getMilestoneStatus(milestone) === 'completed' ? 'line-through text-[#d7d2cb]/50' : 'text-[#d7d2cb]'
                                }`}>
                                  {milestone.title}
                                </h4>
                                {isEditMode && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowEditModal({
                                        type: 'milestone',
                                        id: milestone.id,
                                        data: milestone
                                      })
                                    }}
                                    className="p-1 hover:bg-white/10 rounded transition-colors mb-2"
                                  >
                                    <Edit2 className="w-3 h-3 text-[#d7d2cb]/60" />
                                  </button>
                                )}
                              </div>
                              {milestone.description && (
                                <p className={`text-sm leading-relaxed ${
                                  getMilestoneStatus(milestone) === 'completed' ? 'line-through text-[#d7d2cb]/30' : 'text-[#d7d2cb]/70'
                                }`}>
                                  {milestone.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge 
                                variant={
                                  getMilestoneStatus(milestone) === 'completed' ? 'default' :
                                  'orange'
                                }
                                className={`${
                                  getMilestoneStatus(milestone) === 'completed' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'
                                }`}
                              >
                                {getMilestoneStatus(milestone) === 'completed' ? 'Completed' : 'In Progress'}
                              </Badge>
                              <span className="text-sm text-[#d7d2cb]/60">
                                {formatDateForDisplay(milestone.estimated_date, {
                                  month: 'numeric',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="text-[#d7d2cb]/60"
                              >
                                ▼
                              </motion.div>
                            </div>
                          </div>
                          
                          {/* Progress bar for milestone */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[#d7d2cb]/70">Progress</span>
                              <span className="text-[#d7d2cb]">
                                {calculateMilestoneProgress(milestone)}%
                              </span>
                            </div>
                            <Progress 
                              value={calculateMilestoneProgress(milestone)} 
                              className={`h-2 ${
                                getMilestoneStatus(milestone) === 'completed' ? '[&>div]:bg-green-500' : '[&>div]:bg-orange-500'
                              }`}
                            />
                          </div>

                          {/* Expanded milestone tasks */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="mt-4 pt-4 border-t border-white/10"
                              >
                                <h5 className="text-sm font-medium text-[#d7d2cb] mb-3">
                                  Milestone Tasks ({milestoneTasks.length})
                                </h5>
                                <div className="space-y-2">
                                  {milestoneTasks.length > 0 ? (
                                    milestoneTasks.map((taskItem: any, index: number) => {
                                      const taskId = `${taskItem.date}-${taskItem.task}`
                                      const isCompleted = completedMilestoneTasks.has(taskId)
                                      
                                      return (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition-colors">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation() // Prevent event bubbling to Card's onClick
                                              if (!currentUser?.id || !currentPlanId) return
                                              
                                              // Extract task name without prefix for database lookup
                                              const taskName = (taskItem as any).task.substring(2).trim() // Remove 🏆 prefix and trim whitespace
                                              
                                              // Find the actual task ID from the database
                                              const actualTask = roadmapData?.tasks?.find((t: any) => 
                                                t.name === taskName && t.category === 'milestone_task' && t.milestone_id === milestone.id
                                              )
                                              
                                              if (!actualTask) {
                                                console.error('Task not found in database:', taskName)
                                                return
                                              }
                                              
                                              try {
                                                // Use unified updateTask API
                                                await updateTask(actualTask.id, !isCompleted, currentPlanId, taskItem.date)
                                                
                                                const newCompletedMilestoneTasks = new Set(completedMilestoneTasks)
                                                if (isCompleted) {
                                                  newCompletedMilestoneTasks.delete(taskId)
                                                } else {
                                                  newCompletedMilestoneTasks.add(taskId)
                                                }
                                                setCompletedMilestoneTasks(newCompletedMilestoneTasks)
                                                
                                                // Refetch roadmap data to ensure sync across app
                                                await refetch()
                                                
                                                // Reload completed tasks to sync with database
                                                await loadCompletedTasks(currentUser.id, currentPlanId)
                                                
                                                // Check if all milestone tasks are now completed
                                                const allMilestoneTasks = getMilestoneTasks(milestone)
                                                const allCompleted = allMilestoneTasks.every((taskItem: any) => {
                                                  const taskId = `${taskItem.date}-${taskItem.task}`
                                                  return newCompletedMilestoneTasks.has(taskId)
                                                })
                                                
                                                // Auto-collapse if all tasks are completed (user can still manually expand later)
                                                if (allCompleted && allMilestoneTasks.length > 0) {
                                                  const newExpanded = new Set(expandedMilestones)
                                                  newExpanded.delete(milestone.id)
                                                  setExpandedMilestones(newExpanded)
                                                }
                                              } catch (error) {
                                                console.error('Error updating milestone task completion:', error)
                                              }
                                            }}
                                            className="flex-shrink-0"
                                          >
                                            {isCompleted ? (
                                              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-purple-500">
                                                <span className="text-white text-xs">✓</span>
                                              </div>
                                            ) : (
                                              <div className="w-5 h-5 border-2 rounded-full border-purple-500" />
                                            )}
                                          </button>
                                          <div className="flex-1">
                                            <span className={`text-sm ${isCompleted ? 'line-through text-[#d7d2cb]/50' : 'text-[#d7d2cb]'} text-purple-300`}>
                                              {typeof taskItem.task === 'string' && taskItem.task.startsWith('🏆') ? taskItem.task.substring(2).trim() : taskItem.task}
                                            </span>
                                            <div className="text-xs text-purple-400 mt-1">
                                              {formatDateForDisplay(parseDateFromDB(taskItem.date), {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric', 
                                                year: 'numeric' 
                                              })}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                                              Milestone
                                            </span>
                                            {isEditMode && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  // Find the actual task from roadmapData
                                                  const taskName = typeof taskItem.task === 'string' && taskItem.task.startsWith('🏆') 
                                                    ? taskItem.task.substring(2).trim() 
                                                    : taskItem.task
                                                  const actualTask = roadmapData?.tasks?.find((t: any) => 
                                                    t.name === taskName && t.category === 'milestone_task' && t.milestone_id === milestone.id
                                                  )
                                                  if (actualTask) {
                                                    setShowEditModal({
                                                      type: 'task',
                                                      id: actualTask.id,
                                                      data: {
                                                        id: actualTask.id,
                                                        name: actualTask.name,
                                                        scheduled_date: taskItem.date,
                                                        isCompleted: isCompleted
                                                      }
                                                    })
                                                  }
                                                }}
                                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                              >
                                                <Edit2 className="w-3 h-3 text-[#d7d2cb]/60" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })
                                  ) : (
                                    <div className="text-center py-4 text-[#d7d2cb]/60 text-sm">
                                      No milestone tasks found
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-medium text-[#d7d2cb] mb-2">No Milestones Yet</h3>
                  <p className="text-sm text-[#d7d2cb]/70">
                    Your roadmap milestones will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
            </div>
          </FadeInWrapper>
            </>
          )}
          {/* End Main Roadmap Content */}


        </StaggeredFadeIn>
      </main>


      {/* Day Options Popup - Manual Plan Edit Mode */}
      <AnimatePresence>
        {showDayOptions && selectedDate && isEditMode && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <motion.div 
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={() => {
                setShowDayOptions(false)
                setSelectedDate(null)
              }}
            />
            
            <motion.div 
              className="relative w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#d7d2cb]">
                    {(() => {
                      const [year, month, day] = selectedDate.split('-').map(Number)
                      const date = new Date(year, month - 1, day)
                      return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric'
                      })
                    })()}
                  </h3>
                  <button
                    onClick={() => {
                      setShowDayOptions(false)
                      setSelectedDate(null)
                    }}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Existing Items */}
                {(() => {
                  const items = getItemsForDate(selectedDate)
                  return items.length > 0 ? (
                    <div className="mb-4 space-y-2">
                      <h4 className="text-xs font-semibold text-[#d7d2cb]/60 uppercase tracking-wide mb-2">
                        Items on this day
                      </h4>
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border flex items-start gap-3 ${
                            // Check if item is marked for deletion
                            (!item.id.startsWith('temp-') && (
                              deletedItems.milestones.includes(item.id) || 
                              deletedItems.tasks.includes(item.id)
                            )) 
                              ? 'opacity-50 bg-red-500/10 border-red-500/30' 
                              : item.type === 'milestone' 
                              ? 'bg-pink-500/10 border-pink-500/30' 
                              : item.type === 'milestone_task'
                              ? 'bg-purple-500/10 border-purple-500/30'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          {item.type === 'milestone' ? (
                            <Target className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ListTodo className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                              item.type === 'milestone_task' ? 'text-purple-400' : 'text-[#ff7f00]'
                            }`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${
                              item.type === 'milestone' 
                                ? 'text-pink-400' 
                                : item.type === 'milestone_task'
                                ? 'text-purple-400'
                                : 'text-[#d7d2cb]'
                            }`}>
                              {item.name}
                            </div>
                            {item.milestoneName && (
                              <div className="text-xs text-[#d7d2cb]/60 mt-1">
                                Part of: {item.milestoneName}
                              </div>
                            )}
                            <div className="text-xs text-[#d7d2cb]/50 mt-1">
                              {item.type === 'milestone' ? 'Milestone Completion' : item.type === 'milestone_task' ? 'Milestone Task' : 'Daily Task'}
                              {(!item.id.startsWith('temp-') && (
                                deletedItems.milestones.includes(item.id) || 
                                deletedItems.tasks.includes(item.id)
                              )) && (
                                <span className="text-red-400 ml-2">(Will be deleted)</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Undo delete button for items marked for deletion */}
                            {(!item.id.startsWith('temp-') && (
                              deletedItems.milestones.includes(item.id) || 
                              deletedItems.tasks.includes(item.id)
                            )) ? (
                              <button
                                onClick={() => {
                                  if (item.type === 'milestone') {
                                    setDeletedItems(prev => ({
                                      ...prev,
                                      milestones: prev.milestones.filter(id => id !== item.id)
                                    }))
                                  } else {
                                    setDeletedItems(prev => ({
                                      ...prev,
                                      tasks: prev.tasks.filter(id => id !== item.id)
                                    }))
                                  }
                                  setHasUnsavedChanges(true)
                                  // Refresh popup
                                  const currentDate = selectedDate
                                  setShowDayOptions(false)
                                  setTimeout(() => {
                                    setSelectedDate(currentDate)
                                    setShowDayOptions(true)
                                  }, 100)
                                }}
                                className="text-green-400 hover:text-green-300 transition-colors p-1 rounded hover:bg-white/5"
                                title="Undo Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                              </button>
                            ) : (
                              /* Edit button for existing items */
                              !item.id.startsWith('temp-') && (
                                <button
                                  onClick={() => {
                                    if (item.type === 'milestone') {
                                      // Find the milestone in generatedMilestones
                                      const milestone = generatedMilestones.find(m => m.id === item.id)
                                      if (milestone) {
                                        setShowEditModal({
                                          type: 'milestone',
                                          id: milestone.id,
                                          data: milestone
                                        })
                                      }
                                    } else {
                                      // Find the task in roadmapData.tasks
                                      const task = roadmapData?.tasks?.find((t: any) => t.id === item.id)
                                      if (task) {
                                        setShowEditModal({
                                          type: 'task',
                                          id: task.id,
                                          data: {
                                            id: task.id,
                                            name: task.name,
                                            scheduled_date: item.type === 'milestone_task' 
                                              ? task.task_schedule?.[0]?.date || ''
                                              : task.task_schedule?.[0]?.date || '',
                                            isCompleted: false // We'll determine this if needed
                                          }
                                        })
                                      }
                                    }
                                    setShowDayOptions(false)
                                  }}
                                  className="text-[#d7d2cb]/40 hover:text-blue-400 transition-colors p-1 rounded hover:bg-white/5"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )
                            )}
                            
                            {/* Delete button */}
                            <button
                              onClick={() => {
                                if (item.id.startsWith('temp-')) {
                                  // Delete new item
                                  if (item.type === 'milestone') {
                                    removeNewMilestone(item.id)
                                  } else {
                                    removeNewTask(item.id)
                                  }
                                } else {
                                  // Delete existing item
                                  if (item.type === 'milestone') {
                                    setDeletedItems(prev => ({
                                      ...prev,
                                      milestones: [...prev.milestones, item.id]
                                    }))
                                    setHasUnsavedChanges(true)
                                  } else {
                                    setDeletedItems(prev => ({
                                      ...prev,
                                      tasks: [...prev.tasks, item.id]
                                    }))
                                    setHasUnsavedChanges(true)
                                  }
                                }
                                // Refresh popup by closing and reopening
                                const currentDate = selectedDate
                                setShowDayOptions(false)
                                setTimeout(() => {
                                  setSelectedDate(currentDate)
                                  setShowDayOptions(true)
                                }, 100)
                              }}
                              className="text-[#d7d2cb]/40 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5"
                              title="Delete"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-white/10 my-4"></div>
                    </div>
                  ) : null
                })()}
                
                {/* Add New Items */}
                <div className="space-y-2">
                  <Button
                    onClick={handleAddMilestone}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                    size="sm"
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Add Milestone
                  </Button>
                  <Button
                    onClick={handleAddTask}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                    size="sm"
                  >
                    <ListTodo className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Milestone Modal */}
      <AnimatePresence>
        {showAddMilestone && selectedDate && isEditMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => {
              setShowAddMilestone(false)
              setNewMilestoneName('')
              setNewMilestoneDescription('')
              setSelectedDate(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-pink-400" />
                Add Milestone
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                    Milestone Name
                  </label>
                  <input
                    type="text"
                    value={newMilestoneName}
                    onChange={(e) => setNewMilestoneName(e.target.value)}
                    placeholder="Enter milestone name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newMilestoneDescription}
                    onChange={(e) => setNewMilestoneDescription(e.target.value)}
                    placeholder="Enter description"
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowAddMilestone(false)
                      setNewMilestoneName('')
                      setNewMilestoneDescription('')
                      setSelectedDate(null)
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveMilestone}
                    disabled={!newMilestoneName.trim()}
                    className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddTask && selectedDate && isEditMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => {
              setShowAddTask(false)
              setNewTaskName('')
              setNewTaskCategory('daily_task')
              setNewTaskMilestoneId('')
              setSelectedDate(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4 flex items-center gap-2">
                <ListTodo className={`w-5 h-5 ${newTaskCategory === 'milestone_task' ? 'text-purple-400' : 'text-[#ff7f00]'}`} />
                Add Task
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                    Task Name
                  </label>
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="Enter task name"
                    className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 transition-all ${
                      newTaskCategory === 'milestone_task' ? 'focus:ring-purple-500/50' : 'focus:ring-[#ff7f00]/50'
                    }`}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                    Task Type
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as 'daily_task' | 'milestone_task')}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50 transition-all [&>option]:bg-[#0a0a0a] [&>option]:text-[#d7d2cb]"
                  >
                    <option value="daily_task">Daily Task</option>
                    <option value="milestone_task">Milestone Task</option>
                  </select>
                </div>
                {newTaskCategory === 'milestone_task' && (
                  <div>
                    <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">
                      Associated Milestone
                    </label>
                    <select
                      value={newTaskMilestoneId}
                      onChange={(e) => setNewTaskMilestoneId(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00]/50 transition-all [&>option]:bg-[#0a0a0a] [&>option]:text-[#d7d2cb]"
                    >
                      <option value="">Select milestone...</option>
                      {newMilestones.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowAddTask(false)
                      setNewTaskName('')
                      setNewTaskCategory('daily_task')
                      setNewTaskMilestoneId('')
                      setSelectedDate(null)
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveTask}
                    disabled={!newTaskName.trim()}
                    className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modals */}
      <AnimatePresence>
        {showEditModal.type === 'date' && (
          <DateEditModal
            dateType={showEditModal.id === 'start' ? 'start' : 'end'}
            currentDate={showEditModal.id === 'start' ? (editedStartDate || startDate) : (editedEndDate || endDate)}
            onSave={(newDate) => {
              if (showEditModal.id === 'start') {
                setEditedStartDate(newDate)
              } else {
                setEditedEndDate(newDate)
              }
              setHasUnsavedChanges(true)
              setShowEditModal({type: null, id: null})
              // Trigger validation
              setTimeout(() => validateChanges(), 100)
            }}
            onCancel={() => setShowEditModal({type: null, id: null})}
          />
        )}
        
        {showEditModal.type === 'milestone' && showEditModal.data && (
          <MilestoneEditModal
            milestone={showEditModal.data}
            onSave={(updates) => {
              const newMap = new Map(editedMilestones)
              newMap.set(showEditModal.data.id, {
                ...showEditModal.data,
                ...updates,
                target_date: updates.target_date
              })
              setEditedMilestones(newMap)
              setHasUnsavedChanges(true)
              setShowEditModal({type: null, id: null})
              // Trigger validation
              setTimeout(() => validateChanges(), 100)
            }}
            onDelete={() => {
              setDeletedItems({
                ...deletedItems,
                milestones: [...deletedItems.milestones, showEditModal.data.id]
              })
              setHasUnsavedChanges(true)
              setShowEditModal({type: null, id: null})
            }}
            onCancel={() => setShowEditModal({type: null, id: null})}
          />
        )}
        
        {showEditModal.type === 'task' && showEditModal.data && (
          <TaskEditModal
            task={showEditModal.data}
            isCompleted={showEditModal.data.isCompleted || false}
            onSave={(updates) => {
              const newMap = new Map(editedTasks)
              newMap.set(showEditModal.data.id, {
                ...showEditModal.data,
                ...updates
              })
              setEditedTasks(newMap)
              setHasUnsavedChanges(true)
              setShowEditModal({type: null, id: null})
              // Trigger validation
              setTimeout(() => validateChanges(), 100)
            }}
            onDelete={() => {
              setDeletedItems({
                ...deletedItems,
                tasks: [...deletedItems.tasks, showEditModal.data.id]
              })
              setHasUnsavedChanges(true)
              setShowEditModal({type: null, id: null})
            }}
            onCancel={() => setShowEditModal({type: null, id: null})}
          />
        )}
      </AnimatePresence>
        </div>
      )
    }
