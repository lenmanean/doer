import { formatDateForDB, addDays, toLocalMidnight, parseDateFromDB } from '@/lib/date-utils'

import { TaskInput, SchedulePlacement, SchedulerOptions } from './types'

// Re-export for backward compatibility
export type { TaskInput, SchedulePlacement, SchedulerOptions }

/**
 * Simple sequential scheduler with milestone awareness
 * - Daily tasks: one per day (excluding start/end days)
 * - Milestone tasks: placed on same day as daily tasks, near their milestone dates
 */
export function deterministicScheduler({
  tasks,
  startDate,
  endDate,
  weeklyHours,
  milestones
}: SchedulerOptions): SchedulePlacement[] {
  const placements: SchedulePlacement[] = []
  
  // Separate tasks by category
  const dailyTasks = tasks.filter((t: any) => t.category === 'daily_task')
  const milestoneTasks = tasks.filter((t: any) => t.category === 'milestone_task')
  
  const startDateMidnight = toLocalMidnight(startDate)
  const endDateMidnight = toLocalMidnight(endDate)
  
  console.log('Scheduler Starting:', {
    startDate: formatDateForDB(startDateMidnight),
    endDate: formatDateForDB(endDateMidnight),
    dailyTasks: dailyTasks.length,
    milestoneTasks: milestoneTasks.length,
    totalTasks: tasks.length
  })
  
  // Place daily tasks sequentially (skip start and end days)
  let currentDate = addDays(startDateMidnight, 1) // Start day after start_date
  let dayIndex = 1
  
  for (const task of dailyTasks) {
    if (!task.id) continue
    
    // Stop before end date (use strict < comparison)
    if (currentDate >= endDateMidnight) {
      console.warn('Reached end date while scheduling daily tasks at:', formatDateForDB(currentDate))
      break
    }
    
    placements.push({
      task_id: task.id,
      date: formatDateForDB(currentDate),
      day_index: dayIndex
    })
    
    currentDate = addDays(currentDate, 1)
    dayIndex++
  }
  
  const startDateStr = formatDateForDB(startDateMidnight)
  const endDateStr = formatDateForDB(endDateMidnight)
  
  console.log('Daily tasks scheduled:', {
    scheduled: dailyTasks.length,
    startDate: startDateStr,
    endDate: endDateStr,
    firstDate: placements.length > 0 ? placements[0].date : 'none',
    lastDate: placements.length > 0 ? placements[placements.length - 1].date : 'none',
    verifyNoTasksOnStartDate: placements.every(p => p.date !== startDateStr),
    verifyNoTasksOnEndDate: placements.every(p => p.date !== endDateStr)
  })
  
  // Build a set of milestone target dates to avoid placing milestone tasks on them
  const milestoneTargetDates = new Set(
    milestones?.map(m => m.target_date) || []
  )
  
  console.log('Milestone target dates to avoid for milestone tasks:', Array.from(milestoneTargetDates))
  
  // Place milestone tasks BEFORE their respective milestone target dates
  // Group milestone tasks by their associated milestone
  const milestoneTaskGroups = new Map<string, any[]>()
  
  for (const task of milestoneTasks) {
    if (!task.id || !task.milestone_id) continue
    
    if (!milestoneTaskGroups.has(task.milestone_id)) {
      milestoneTaskGroups.set(task.milestone_id, [])
    }
    milestoneTaskGroups.get(task.milestone_id)!.push(task)
  }
  
  // For each milestone, schedule its tasks before the milestone target date
  // First, sort milestones by their target date to process them in order
  const sortedMilestones = milestones ? [...milestones].sort((a, b) => {
    const dateA = parseDateFromDB(a.target_date).getTime()
    const dateB = parseDateFromDB(b.target_date).getTime()
    return dateA - dateB
  }) : []
  
  let previousMilestoneEndDay = 1 // Start after the start date
  
  for (const milestone of sortedMilestones) {
    if (!milestone.id) continue
    
    const milestoneId = milestone.id
    const tasks = milestoneTaskGroups.get(milestoneId)
    
    if (!tasks || tasks.length === 0) {
      continue
    }
    
    const milestoneTargetDate = parseDateFromDB(milestone.target_date)
    const daysUntilMilestone = Math.floor((milestoneTargetDate.getTime() - startDateMidnight.getTime()) / (1000 * 60 * 60 * 24))
    
    // Calculate the window for this milestone's tasks
    // Start after the previous milestone's tasks ended, end before this milestone's target date
    const windowStart = previousMilestoneEndDay
    const windowEnd = daysUntilMilestone - 1 // Leave at least 1 day buffer before milestone
    const availableDays = Math.max(1, windowEnd - windowStart + 1)
    const spacing = Math.max(1, Math.floor(availableDays / tasks.length))
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      
      // Calculate placement: distribute tasks evenly within the window for this milestone
      let dayOffset = Math.min(
        windowStart + (i * spacing),
        windowEnd // Don't go past the window end
      )
      
      let taskDate = addDays(startDateMidnight, dayOffset)
      let taskDateStr = formatDateForDB(taskDate)
      
      // If this date conflicts with the milestone target date, shift backward
      let shiftAttempts = 0
      while (milestoneTargetDates.has(taskDateStr) && taskDate > startDateMidnight && shiftAttempts < 10) {
        console.log(`Milestone task for date ${taskDateStr} conflicts with milestone target date, shifting backward`)
        taskDate = addDays(taskDate, -1)
        taskDateStr = formatDateForDB(taskDate)
        dayOffset--
        shiftAttempts++
      }
      
      // If we can't find a good date, place it on the first available day
      if (taskDate <= startDateMidnight) {
        taskDate = addDays(startDateMidnight, 1)
        taskDateStr = formatDateForDB(taskDate)
        dayOffset = 1
      }
      
      placements.push({
        task_id: task.id,
        date: taskDateStr,
        day_index: dayOffset
      })
      
      console.log(`Scheduled milestone task "${task.id}" for ${taskDateStr} (${dayOffset} days from start, ${daysUntilMilestone - dayOffset} days before milestone)`)
      
      // Update the end day for tracking
      if (dayOffset >= previousMilestoneEndDay) {
        previousMilestoneEndDay = dayOffset + 1
      }
    }
  }
  
  // Verify no milestone tasks were placed on milestone target dates or end date
  const milestoneTaskPlacements = placements.filter(p => {
    const task = milestoneTasks.find(t => t.id === p.task_id)
    return task !== undefined
  })
  
  const tasksOnMilestoneDates = milestoneTaskPlacements.filter(p => 
    milestoneTargetDates.has(p.date)
  )
  
  const tasksOnEndDate = milestoneTaskPlacements.filter(p => 
    p.date === formatDateForDB(endDateMidnight)
  )
  
  console.log('Milestone tasks scheduled:', {
    scheduled: milestoneTasks.length,
    placedOnMilestoneDates: tasksOnMilestoneDates.length,
    placedOnEndDate: tasksOnEndDate.length,
    conflictingDates: tasksOnMilestoneDates.map(p => p.date)
  })
  
  console.log('Scheduler Complete:', {
    totalPlacements: placements.length,
    dailyTaskPlacements: dailyTasks.length,
    milestoneTaskPlacements: milestoneTasks.length
  })
  
  return placements
}

/**
 * More advanced scheduler that respects task dependencies
 */
export function dependencyAwareScheduler({
  tasks,
  startDate,
  endDate,
  weeklyHours
}: SchedulerOptions): SchedulePlacement[] {
  const placements: SchedulePlacement[] = []
  const taskCompletionDates: Map<string, Date> = new Map()
  
  const hoursPerDay = Math.max(1, Math.floor(weeklyHours / 5))
  let currentDate = toLocalMidnight(startDate)
  const finalDate = toLocalMidnight(endDate)
  let dayIndex = 1
  
  // Sort tasks by dependencies (tasks with no dependencies first)
  const sortedTasks = [...tasks].sort((a, b) => {
    const aDeps = a.dependency_ids?.length || 0
    const bDeps = b.dependency_ids?.length || 0
    return aDeps - bDeps
  })
  
  for (const task of sortedTasks) {
    if (!task.id) continue
    
    // Check if dependencies are complete
    let earliestStart = toLocalMidnight(startDate)
    if (task.dependency_ids && task.dependency_ids.length > 0) {
      for (const depId of task.dependency_ids) {
        const depCompletionDate = taskCompletionDates.get(depId)
        if (depCompletionDate && depCompletionDate > earliestStart) {
          earliestStart = addDays(depCompletionDate, 1) // Start day after dependency completes
        }
      }
    }
    
    // Start from the later of current date or earliest start after dependencies
    currentDate = currentDate > earliestStart ? currentDate : earliestStart
    
    const taskDays = 1 // Fixed to 1 day since est_days field was removed
    const hoursPerTaskDay = hoursPerDay // Use default hours per day since estimated_duration_hours field was removed
    
    let taskEndDate = currentDate
    
    for (let i = 0; i < taskDays; i++) {
      if (currentDate > finalDate) break
      
      // Ensure we never schedule before the start date
      if (currentDate < toLocalMidnight(startDate)) {
        console.error('ERROR: Attempting to schedule task before start date!', {
          currentDate: formatDateForDB(currentDate),
          startDate: formatDateForDB(startDate),
          taskId: task.id
        })
        break
      }
      
      const dateStr = formatDateForDB(currentDate)
      
      placements.push({
        task_id: task.id,
        date: dateStr,
        day_index: dayIndex
      })
      
      taskEndDate = currentDate
      currentDate = addDays(currentDate, 1)
      dayIndex++
      
      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = addDays(currentDate, 1)
      }
    }
    
    // Record when this task completes
    taskCompletionDates.set(task.id, taskEndDate)
  }
  
  return placements
}

