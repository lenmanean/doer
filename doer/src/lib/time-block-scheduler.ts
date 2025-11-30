import { TimeBlockPlacement, TimeBlockSchedulerOptions } from '@/lib/types'

interface DayScheduleConfig {
  startHour: number
  startMinute: number
  endHour: number
  lunchStartHour: number
  lunchEndHour: number
  workdayDuration: number
  lunchOverlapDuration: number
  dailyCapacity: number
  isWeekend: boolean
}

/**
 * Time-block scheduler that places tasks into specific time slots
 * with hour-level precision and considers workday constraints
 */
export function timeBlockScheduler(options: TimeBlockSchedulerOptions): {
  placements: TimeBlockPlacement[]
  totalScheduledHours: number
  unscheduledTasks: string[]
} {
  const {
    tasks,
    startDate,
    endDate,
    workdayStartHour = 9,
    workdayStartMinute = 0,
    workdayEndHour = 17,
    lunchStartHour = 12,
    lunchEndHour = 13,
    allowWeekends = false,
    weekendStartHour = workdayStartHour,
    weekendStartMinute = workdayStartMinute,
    weekendEndHour = workdayEndHour,
    weekendLunchStartHour = lunchStartHour,
    weekendLunchEndHour = lunchEndHour,
    weekdayMaxMinutes,
    weekendMaxMinutes,
    currentTime,
    existingSchedules = [],
    forceStartDate = false,
    taskDependencies = new Map<number, number[]>(),
    requireStartDate = false
  } = options

  // COMPREHENSIVE VALIDATION
  console.log('🔧 Scheduler Input Validation:', {
    tasksCount: tasks.length,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    workdayStartHour,
    workdayStartMinute,
    workdayEndHour,
    lunchStartHour,
    lunchEndHour,
    currentTime: currentTime?.toISOString()
  })

  // VALIDATION: Ensure valid workday hours
  if (workdayStartHour < 0 || workdayStartHour > 23 || workdayEndHour < 0 || workdayEndHour > 23) {
    throw new Error(`Invalid workday hours: start=${workdayStartHour}, end=${workdayEndHour}`)
  }
  if (workdayStartHour >= workdayEndHour) {
    throw new Error(`Workday start hour (${workdayStartHour}) must be before end hour (${workdayEndHour})`)
  }
  if (workdayStartMinute < 0 || workdayStartMinute > 59) {
    throw new Error(`Invalid workday start minute: ${workdayStartMinute}`)
  }

  // VALIDATION: Ensure valid lunch hours
  if (lunchStartHour < 0 || lunchStartHour > 23 || lunchEndHour < 0 || lunchEndHour > 23) {
    throw new Error(`Invalid lunch hours: start=${lunchStartHour}, end=${lunchEndHour}`)
  }
  if (lunchStartHour >= lunchEndHour) {
    throw new Error(`Lunch start hour (${lunchStartHour}) must be before end hour (${lunchEndHour})`)
  }

  if (allowWeekends) {
    if (weekendStartHour < 0 || weekendStartHour > 23 || weekendEndHour < 0 || weekendEndHour > 23) {
      throw new Error(`Invalid weekend hours: start=${weekendStartHour}, end=${weekendEndHour}`)
    }
    if (weekendStartHour >= weekendEndHour) {
      throw new Error(`Weekend start hour (${weekendStartHour}) must be before end hour (${weekendEndHour})`)
    }
    if (weekendLunchStartHour < 0 || weekendLunchStartHour > 23 || weekendLunchEndHour < 0 || weekendLunchEndHour > 23) {
      throw new Error(`Invalid weekend lunch hours: start=${weekendLunchStartHour}, end=${weekendLunchEndHour}`)
    }
    if (weekendLunchStartHour >= weekendLunchEndHour) {
      throw new Error(`Weekend lunch start hour (${weekendLunchStartHour}) must be before end hour (${weekendLunchEndHour})`)
    }
  }

  // VALIDATION: Ensure tasks have valid durations
  const invalidTasks = tasks.filter(task => 
    !task.estimated_duration_minutes || 
    task.estimated_duration_minutes < 5 || 
    task.estimated_duration_minutes > 360
  )
  if (invalidTasks.length > 0) {
    throw new Error(`Invalid task durations found: ${invalidTasks.map(t => `${t.name} (${t.estimated_duration_minutes}min)`).join(', ')} - must be 5-360 minutes`)
  }

  const placements: TimeBlockPlacement[] = []
  const unscheduledTasks: string[] = []
  let totalScheduledHours = 0

  // Calculate total days
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // Check if this is a single-day plan
  const isSingleDayPlan = startDate.toDateString() === endDate.toDateString()
  
  if (isSingleDayPlan) {
    console.log('🔧 SINGLE-DAY PLAN DETECTED - enforcing all tasks on start date only')
    
    // Validate that all tasks can fit in a single day
    const totalTaskMinutes = tasks.reduce((sum, t) => sum + t.estimated_duration_minutes, 0)
    const workdayDurationMinutes = (workdayEndHour - workdayStartHour) * 60 - (lunchEndHour - lunchStartHour) * 60
    const maxDailyCapacity = weekdayMaxMinutes || workdayDurationMinutes
    
    if (totalTaskMinutes > maxDailyCapacity) {
      console.error(`❌ SINGLE-DAY PLAN CAPACITY ERROR:`, {
        totalTaskMinutes,
        maxDailyCapacity: maxDailyCapacity,
        workdayDurationMinutes,
        deficit: totalTaskMinutes - maxDailyCapacity
      })
      
      // Calculate how many days are actually needed
      const daysNeeded = Math.ceil(totalTaskMinutes / maxDailyCapacity)
      
      throw new Error(
        `Cannot fit all tasks in single day. Total duration: ${totalTaskMinutes} min, ` +
        `available capacity: ${maxDailyCapacity} min. ` +
        `Timeline needs to be extended to at least ${daysNeeded} days.`
      )
    }
  }

  const dayConfigs: DayScheduleConfig[] = []
  const activeDayIndices: number[] = []

  const computeDayConfig = (
    isWeekend: boolean
  ): Omit<DayScheduleConfig, 'isWeekend'> => {
    const startHour = isWeekend ? weekendStartHour : workdayStartHour
    const startMinute = isWeekend ? weekendStartMinute : workdayStartMinute
    const endHour = isWeekend ? weekendEndHour : workdayEndHour
    const lunchStart = isWeekend ? weekendLunchStartHour : lunchStartHour
    const lunchEnd = isWeekend ? weekendLunchEndHour : lunchEndHour

    const dayStartMinutes = startHour * 60 + startMinute
    const dayEndMinutes = endHour * 60
    const workdayDuration = dayEndMinutes - dayStartMinutes

    if (workdayDuration <= 0) {
      throw new Error(`Invalid daily span: ${startHour}:${startMinute} -> ${endHour}:00`)
    }

    const lunchStartMinutes = lunchStart * 60
    const lunchEndMinutes = lunchEnd * 60
    const lunchOverlapStart = Math.max(dayStartMinutes, lunchStartMinutes)
    const lunchOverlapEnd = Math.min(dayEndMinutes, lunchEndMinutes)
    const lunchOverlapDuration = Math.max(0, lunchOverlapEnd - lunchOverlapStart)

    let dailyCapacity = workdayDuration - lunchOverlapDuration
    if (dailyCapacity <= 0) {
      throw new Error(`Invalid daily capacity (${dailyCapacity}) for ${isWeekend ? 'weekend' : 'weekday'} configuration`)
    }

    const maxOverride = isWeekend ? weekendMaxMinutes : weekdayMaxMinutes
    if (typeof maxOverride === 'number' && maxOverride > 0) {
      dailyCapacity = Math.min(dailyCapacity, maxOverride)
    }

    return {
      startHour,
      startMinute,
      endHour,
      lunchStartHour: lunchStart,
      lunchEndHour: lunchEnd,
      workdayDuration,
      lunchOverlapDuration,
      dailyCapacity
    }
  }

  const cursor = new Date(startDate)
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const dayOfWeek = cursor.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    if (!isWeekend || allowWeekends) {
      activeDayIndices.push(dayIndex)
    }

    const baseConfig = computeDayConfig(isWeekend)
    dayConfigs.push({
      ...baseConfig,
      isWeekend
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  const totalActiveDays = activeDayIndices.length > 0 ? activeDayIndices.length : totalDays
  const today = new Date()
  const isStartDateToday = startDate.toDateString() === today.toDateString()

  // Sort tasks by priority first, then by duration (longest first within same priority)
  // This implements priority-weighted distribution across the timeline
  console.log('🔧 Scheduler received tasks:', tasks.map(t => ({ name: t.name, idx: t.idx, priority: t.priority })))
  
  const sortedTasks = [...tasks].sort((a, b) => {
    const aIdx = typeof a.idx === 'number' ? a.idx : null
    const bIdx = typeof b.idx === 'number' ? b.idx : null

    if (aIdx !== null && bIdx !== null && aIdx !== bIdx) {
      return aIdx - bIdx
    }

    if (aIdx !== null && bIdx === null) {
      return -1
    }
    if (aIdx === null && bIdx !== null) {
      return 1
    }

    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }

    const aDuration = a.estimated_duration_minutes || 0
    const bDuration = b.estimated_duration_minutes || 0
    if (aDuration !== bDuration) {
      return bDuration - aDuration
    }

    return a.name.localeCompare(b.name)
  })
  
  console.log('🔧 Sorted tasks for scheduling (priority-weighted):', sortedTasks.map(t => ({ name: t.name, idx: t.idx, priority: t.priority, duration: t.estimated_duration_minutes })))
  
  const activeDayPercentage = totalActiveDays === 0 ? 0 : (totalActiveDays / totalDays) * 100
  console.log('🔧 Timeline analysis:', {
    totalDays,
    activeDays: totalActiveDays,
    activeDayPercentage: `${activeDayPercentage.toFixed(1)}%`,
    allowWeekends
  })
  
  // Calculate target day ranges for each priority level with flexibility for backfilling
  // Priority 1: first 40% of timeline, very flexible for backfill
  // Priority 2: first 70% of timeline, flexible for backfill  
  // Priority 3: any day, very flexible
  // Priority 4: any day, completely flexible
  const getTargetDayRange = (priority: number): { start: number; end: number; flexible: boolean } => {
    const total = Math.max(totalActiveDays, 1)
    switch (priority) {
      case 1:
        // P1: First 40% of timeline, very flexible for backfill
        return { 
          start: 0, 
          end: Math.max(1, Math.ceil(total * 0.40)),
          flexible: true // Can move within entire first half for capacity balancing
        }
      case 2:
        // P2: First 70% of timeline, flexible for backfill
        return { 
          start: 0, 
          end: Math.max(1, Math.ceil(total * 0.70)),
          flexible: true // Can backfill to earlier days if capacity exists
        }
      case 3:
        // P3: Any day, very flexible
        return { 
          start: 0, 
          end: total,
          flexible: true
        }
      case 4:
        // P4: Any day, completely flexible
        return { 
          start: 0, 
          end: total,
          flexible: true
        }
      default:
        return { start: 0, end: total, flexible: true }
    }
  }
  
  // Map workday index to actual day_index (accounting for weekends)
  const activeIndexToDayIndex = (activeIndex: number): number => {
    if (activeDayIndices.length === 0) {
      return Math.min(Math.max(activeIndex, 0), totalDays - 1)
    }
    const clampedIndex = Math.min(Math.max(activeIndex, 0), activeDayIndices.length - 1)
    return activeDayIndices[clampedIndex]
  }
  
  // Calculate target day for a task based on its priority and position within priority group
  const calculateTargetDay = (task: any, taskIndex: number, tasksInPriority: number): number => {
    const range = getTargetDayRange(task.priority)
    const rangeSize = range.end - range.start
    if (rangeSize <= 0) {
      // If range is too small, map the active index to actual day_index
      return activeIndexToDayIndex(Math.min(range.start, totalActiveDays - 1))
    }
    
    // Distribute tasks evenly within the priority range (in workday space)
    const positionInRange = tasksInPriority > 1 ? (taskIndex / (tasksInPriority - 1)) : 0
    const targetWorkdayIndex = Math.floor(range.start + positionInRange * rangeSize)
    const clampedWorkdayIndex = Math.min(Math.max(targetWorkdayIndex, range.start), range.end - 1, totalActiveDays - 1)
    
    // Convert workday index to actual day_index (accounting for weekends)
    return activeIndexToDayIndex(clampedWorkdayIndex)
  }
  
  // Group tasks by priority to calculate target days
  const tasksByPriority = new Map<number, typeof sortedTasks>()
  sortedTasks.forEach(task => {
    const priority = task.priority || 4
    if (!tasksByPriority.has(priority)) {
      tasksByPriority.set(priority, [])
    }
    tasksByPriority.get(priority)!.push(task)
  })
  
  // Calculate target day for each task (first pass)
  let tasksWithTargetDays = sortedTasks.map(task => {
    const priority = task.priority || 4
    const tasksInPriority = tasksByPriority.get(priority) || []
    const taskIndexInPriority = tasksInPriority.findIndex(t => t.id === task.id)
    const targetDay = calculateTargetDay(task, taskIndexInPriority, tasksInPriority.length)
    return { ...task, targetDay }
  })
  
  // Second pass: Ensure sequential order within same priority AND enforce dependencies
  // Tasks with lower idx should have earlier or equal target days
  // Tasks that depend on others must be scheduled on same or later day
  tasksWithTargetDays = tasksWithTargetDays.map(task => {
    const priority = task.priority || 4
    const tasksInPriority = tasksByPriority.get(priority) || []
    
    let adjustedTargetDay = task.targetDay
    
    // Enforce idx-based ordering within same priority
    if (task.idx) {
      const earlierTasksInPriority = tasksInPriority.filter(t => t.idx && t.idx < task.idx)
      if (earlierTasksInPriority.length > 0) {
        // Find the latest target day of earlier tasks (already calculated in first pass)
        const earlierTaskIds = earlierTasksInPriority.map(t => t.id)
        const earlierTargetDays = tasksWithTargetDays
          .filter(t => earlierTaskIds.includes(t.id))
          .map(t => t.targetDay)
        if (earlierTargetDays.length > 0) {
          const latestEarlierTargetDay = Math.max(...earlierTargetDays)
          // Ensure this task's target day is not earlier than the latest earlier task
          adjustedTargetDay = Math.max(adjustedTargetDay, latestEarlierTargetDay)
        }
      }
    }
    
    // Enforce dependency constraints: if this task depends on others, it must be scheduled on same or later day
    if (task.idx && taskDependencies.has(task.idx)) {
      const dependentTaskIdxs = taskDependencies.get(task.idx) || []
      for (const depIdx of dependentTaskIdxs) {
        const depTask = tasksWithTargetDays.find(t => t.idx === depIdx)
        if (depTask) {
          // This task depends on depTask, so it must be scheduled on same or later day
          adjustedTargetDay = Math.max(adjustedTargetDay, depTask.targetDay)
        }
      }
    }
    
    // Enforce reverse dependencies: if other tasks depend on this task, they must be scheduled on same or later day
    // (This is handled when we process those tasks, but we log here for clarity)
    for (const [depTaskIdx, deps] of taskDependencies.entries()) {
      if (deps.includes(task.idx)) {
        const depTask = tasksWithTargetDays.find(t => t.idx === depTaskIdx)
        if (depTask && depTask.targetDay < task.targetDay) {
          // The dependent task will be adjusted in its own iteration
          // We just ensure this task's target day is valid
        }
      }
    }
    
          if (adjustedTargetDay !== task.targetDay) {
      const reason = taskDependencies.has(task.idx || -1) ? 'dependency constraint' : 'sequence'
      console.log(`  🔗 Adjusting target day for task ${task.idx} (${task.name}): ${task.targetDay} -> ${adjustedTargetDay} (${reason})`)
            return { ...task, targetDay: adjustedTargetDay }
    }
    
    return task
  })
  
  const adjustTargetDaySemantics = (
    task: typeof tasksWithTargetDays[number]
  ): { targetDay: number; enforce: boolean } => {
    const lowerName = (task.name || '').toLowerCase()
    const lastActiveIndex = Math.max(totalActiveDays - 1, 0)
    const lastDayIndex = activeIndexToDayIndex(lastActiveIndex)

    if (totalActiveDays <= 1) {
      return { targetDay: task.targetDay, enforce: false }
    }

    const contains = (phrase: string) => lowerName.includes(phrase)

    if (
      contains('final review') ||
      (contains('final') && contains('review')) ||
      contains('wrap up') ||
      contains('wrap-up')
    ) {
      return { targetDay: lastDayIndex, enforce: true }
    }

    if (
      contains('practice') ||
      contains('mock interview') ||
      contains('rehears')
    ) {
      return { targetDay: lastDayIndex, enforce: true }
    }

    if (
      contains('set up interview space') ||
      contains('setup interview space') ||
      contains('set up space') ||
      contains('setup space') ||
      contains('interview space') ||
      contains('tech check') ||
      contains('equipment check') ||
      contains('camera') ||
      contains('microphone') ||
      contains('lighting')
    ) {
      return { targetDay: lastDayIndex, enforce: true }
    }

    if (
      contains('relax') ||
      contains('prepare mentally') ||
      contains('mental prep') ||
      (contains('prepare') && contains('mentally'))
    ) {
      return { targetDay: lastDayIndex, enforce: true }
    }

    return { targetDay: task.targetDay, enforce: false }
  }

  tasksWithTargetDays = tasksWithTargetDays.map(task => {
    const { targetDay, enforce } = adjustTargetDaySemantics(task)
    if (targetDay !== task.targetDay) {
      console.log(
        `  🔁 Adjusting target day for "${task.name}": ${task.targetDay} -> ${targetDay} (semantic rule)`
      )
    }
    return {
      ...task,
      targetDay,
      enforceTargetDay: enforce
    }
  })
  
  console.log('🔧 Tasks with target days:', tasksWithTargetDays.map(t => ({ 
    name: t.name, 
    priority: t.priority, 
    targetDay: t.targetDay 
  })))

  const totalTaskDuration = tasks.reduce((sum, task) => sum + task.estimated_duration_minutes, 0)
  const totalAvailableCapacity = dayConfigs.reduce((sum, config) => {
    if (config.isWeekend && !allowWeekends) {
      return sum
    }
    return sum + config.dailyCapacity
  }, 0)

  const weekdayCapacity = dayConfigs.reduce((sum, config) => config.isWeekend ? sum : sum + config.dailyCapacity, 0)
  const weekendCapacity = allowWeekends
    ? dayConfigs.reduce((sum, config) => config.isWeekend ? sum + config.dailyCapacity : sum, 0)
    : 0

  // VALIDATION: Check if tasks can fit in available time
  if (totalTaskDuration > totalAvailableCapacity) {
    console.warn(`⚠️  Total task duration (${totalTaskDuration}min) exceeds available capacity (${totalAvailableCapacity}min)`)
  }

  console.log('🔧 Capacity Analysis:', {
    weekdayCapacity,
    weekendCapacity,
    appliedWeekdayCap: weekdayMaxMinutes,
    appliedWeekendCap: weekendMaxMinutes,
    totalDays,
    activeDays: totalActiveDays,
    totalTaskDuration,
    totalAvailableCapacity,
    canFit: totalTaskDuration <= totalAvailableCapacity
  })

  const dailyScheduled: { [dayIndex: number]: number } = {}

  console.log('Scheduler debug:', {
    weekdayStartHour: workdayStartHour,
    weekdayEndHour: workdayEndHour,
    weekendStartHour,
    weekendEndHour,
    weekdayCapacity,
    weekendCapacity,
    totalDays,
    tasksCount: tasks.length,
    totalDuration: tasks.reduce((sum, task) => sum + task.estimated_duration_minutes, 0)
  })

  const derivedWeekdayCapacity = dayConfigs
    .filter(config => !config.isWeekend)
    .reduce((max, config) => Math.max(max, config.dailyCapacity), 0)
  const derivedWeekendCapacity = dayConfigs
    .filter(config => config.isWeekend)
    .reduce((max, config) => Math.max(max, config.dailyCapacity), 0)

  const effectiveWeekdayCap = Math.max(
    weekdayMaxMinutes ?? derivedWeekdayCapacity ?? derivedWeekendCapacity ?? 60,
    1
  )
  const effectiveWeekendCap = allowWeekends
    ? Math.max(weekendMaxMinutes ?? derivedWeekendCapacity ?? effectiveWeekdayCap, effectiveWeekdayCap)
    : effectiveWeekdayCap

  // Track actual scheduled time slots to prevent overlaps
  const scheduledSlots = new Map<string, Array<{start: number, end: number, taskId: string}>>()
  
  // Pre-populate scheduledSlots with existing schedules
  for (const existing of existingSchedules) {
    const dateStr = existing.date
    if (!scheduledSlots.has(dateStr)) {
      scheduledSlots.set(dateStr, [])
    }
    const [startHour, startMinute] = existing.start_time.split(':').map(Number)
    const [endHour, endMinute] = existing.end_time.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    scheduledSlots.get(dateStr)!.push({
      start: startMinutes,
      end: endMinutes,
      taskId: 'existing' // Placeholder ID for existing tasks
    })
  }

  let latestSequentialDay = 0

  for (const taskWithTarget of tasksWithTargetDays) {
    const task = taskWithTarget
    let remainingDuration = task.estimated_duration_minutes
    let scheduled = false
    const targetDay = task.targetDay || 0
    console.log(`Trying to schedule: ${task.name} (${task.estimated_duration_minutes} min) - idx: ${task.idx}, priority: ${task.priority}, targetDay: ${targetDay}`)

    // Start from target day, but prioritize staying close to target
    // Search strategy: start at target day, then expand outward (target-1, target+1, target-2, target+2, etc.)
    // But limit how far we can deviate to ensure distribution across timeline
    const prefersWeekend = allowWeekends &&
      effectiveWeekendCap > effectiveWeekdayCap &&
      task.estimated_duration_minutes >= effectiveWeekdayCap * 0.6

    const prefersWeekday = allowWeekends &&
      !prefersWeekend &&
      task.estimated_duration_minutes <= effectiveWeekdayCap * 0.5

    const allowEarlierThanTarget = task.priority === 1

    const searchDaysSet = new Set<number>()
    
    // If forceStartDate is true and this is a priority task, prioritize start date (day 0)
    if (forceStartDate && task.priority <= 2 && targetDay === 0) {
      searchDaysSet.add(0) // Start date gets highest priority
    } else {
    searchDaysSet.add(targetDay) // Start with target day
    }
    
    // Calculate max deviation based on priority - lower priority can deviate more
    // P1: max 2 days deviation, P2: max 3 days, P3: max 4 days, P4: max 5 days
    const baseDeviation = task.priority === 1 ? 2 : task.priority === 2 ? 3 : task.priority === 3 ? 4 : 5
    const timelineDeviationLimit = Math.floor(Math.max(totalActiveDays - 1, 0) * 0.3)
    const maxDeviation = Math.min(baseDeviation, timelineDeviationLimit)
    
    // Add days around target day in expanding pattern, but within max deviation
    for (let offset = 1; offset <= maxDeviation; offset++) {
      if (allowEarlierThanTarget && targetDay - offset >= 0) searchDaysSet.add(targetDay - offset)
      if (targetDay + offset < totalDays) searchDaysSet.add(targetDay + offset)
    }
    
    // If we still haven't found a slot, expand further but prioritize later days for lower priorities
    // This ensures tasks don't all pack into early days
    if (task.priority >= 3) {
      // For P3 and P4, prefer later days if target day is full
      for (let dayIndex = targetDay + maxDeviation + 1; dayIndex < totalDays; dayIndex++) {
        searchDaysSet.add(dayIndex)
      }
      // Then earlier days as fallback
      if (allowEarlierThanTarget) {
        for (let dayIndex = targetDay - maxDeviation - 1; dayIndex >= 0; dayIndex--) {
          searchDaysSet.add(dayIndex)
        }
      }
    } else {
      // For P1 and P2, allow earlier days as fallback
      if (allowEarlierThanTarget) {
        for (let dayIndex = targetDay - maxDeviation - 1; dayIndex >= 0; dayIndex--) {
          searchDaysSet.add(dayIndex)
        }
      }
      // Then later days
      for (let dayIndex = targetDay + maxDeviation + 1; dayIndex < totalDays; dayIndex++) {
        searchDaysSet.add(dayIndex)
      }
    }
    
    // Convert Set to Array and sort with capacity-aware backfilling
    // This enables intelligent backfilling - prioritize days with more available capacity
    const searchDays = Array.from(searchDaysSet).sort((a, b) => {
      // Prioritize target day and days after it
      if (a < targetDay && b >= targetDay) return 1
      if (b < targetDay && a >= targetDay) return -1
      const aConfig = dayConfigs[a]
      const bConfig = dayConfigs[b]
      const aUsed = dailyScheduled[a] || 0
      const bUsed = dailyScheduled[b] || 0
      const aAvailable = (aConfig?.dailyCapacity || 0) - aUsed
      const bAvailable = (bConfig?.dailyCapacity || 0) - bUsed

      const targetCapacity = (cfg: typeof dayConfigs[number] | undefined, used: number) =>
        (cfg?.dailyCapacity || 0) - used

      const targetHasRoomA = a === targetDay && targetCapacity(aConfig, aUsed) >= remainingDuration
      const targetHasRoomB = b === targetDay && targetCapacity(bConfig, bUsed) >= remainingDuration

      if (targetHasRoomA && !targetHasRoomB) return -1
      if (targetHasRoomB && !targetHasRoomA) return 1
      // First: For P1-P2, respect target day proximity more strictly
      // For P3-P4, prioritize available capacity over proximity
      if (task.priority <= 2) {
        const aDist = Math.abs(a - targetDay)
        const bDist = Math.abs(b - targetDay)
        // Only consider capacity if distances are similar (within 1 day)
        if (Math.abs(aDist - bDist) > 1) {
          return aDist - bDist // Prefer closer days for P1-P2
        }
      }
      
      // Second: Prefer days with more available capacity (enables backfilling)
      // Prioritize days with MORE available capacity (backfilling)
      if (aAvailable !== bAvailable) {
        return bAvailable - aAvailable // Prefer day with MORE capacity
      }
      
      // Third: Consider weekend preference
      const aWeekend = aConfig?.isWeekend ?? false
      const bWeekend = bConfig?.isWeekend ?? false

      const aBias = prefersWeekend
        ? (aWeekend ? -0.25 : 0.25)
        : prefersWeekday
          ? (aWeekend ? 0.25 : -0.1)
          : 0
      const bBias = prefersWeekend
        ? (bWeekend ? -0.25 : 0.25)
        : prefersWeekday
          ? (bWeekend ? 0.25 : -0.1)
          : 0

      // Fourth: Distance from target day (lower priority now due to capacity focus)
      const aDist = Math.abs(a - targetDay)
      const bDist = Math.abs(b - targetDay)
      const aScore = aDist + aBias
      const bScore = bDist + bBias

      if (aScore !== bScore) return aScore - bScore

      if (aWeekend !== bWeekend) {
        if (prefersWeekend) return aWeekend ? -1 : 1
        if (prefersWeekday) return aWeekend ? 1 : -1
      }

      if (task.priority >= 3 && a !== b) return b - a
      if (a !== b) return a - b
      return 0
    })

    // Try to find suitable time slots (may span multiple days if task exceeds daily capacity)
    for (const dayIndex of searchDays) {
      if (remainingDuration <= 0) break
      
      // ENFORCE SINGLE-DAY PLAN: Only schedule on day 0
      if (isSingleDayPlan && dayIndex !== 0) {
        console.log(`  Skipping day ${dayIndex} - single-day plan enforces day 0 only`)
        continue
      }
      
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + dayIndex)
      const dateStr = currentDate.toISOString().split('T')[0]

      const dayConfig = dayConfigs[dayIndex]
      if (!dayConfig) continue

      // Weekend handling: respect allowWeekends and forceStartDate
      if (dayConfig.isWeekend) {
        // If weekends are disabled, skip
        if (!allowWeekends) {
        console.log(`  Skipping weekend (disabled): ${dateStr}`)
        continue
        }
        
        // If this is the start date and forceStartDate is true, prioritize it
        if (forceStartDate && dayIndex === 0) {
          // Allow scheduling on start date even if it's a weekend
          // Don't skip
        } else if (prefersWeekday) {
          // Only skip weekend if there are weekday alternatives available
          const hasWeekdayCandidate = searchDays.some(idx => idx !== dayIndex && !(dayConfigs[idx]?.isWeekend ?? false))
          if (hasWeekdayCandidate) {
            console.log(`    Prefers weekday: skipping weekend ${dateStr} (weekday alternative available)`)
            continue
          }
        }
      }

      // Check available capacity for this day
      const alreadyScheduled = dailyScheduled[dayIndex] || 0
      const dayCapacity = dayConfig.dailyCapacity
      const availableCapacity = dayCapacity - alreadyScheduled
      console.log(`  Day ${dayIndex} (${dateStr}${dayConfig.isWeekend ? ' weekend' : ''}): ${alreadyScheduled}/${dayCapacity} min used, ${availableCapacity} min available`)

      if (availableCapacity <= 0) {
        continue
      }
      
      // 🔧 FIX: Don't split tasks across days - only schedule if ENTIRE task fits
      if (remainingDuration > availableCapacity) {
        console.log(`    Skipping day ${dayIndex} - task requires ${remainingDuration} min but only ${availableCapacity} min available (will not split task)`)
        continue
      }

      if (prefersWeekend && !dayConfig.isWeekend) {
        const hasWeekendCandidate = searchDays.some(idx => idx !== dayIndex && (dayConfigs[idx]?.isWeekend ?? false))
        if (hasWeekendCandidate && task.estimated_duration_minutes > dayCapacity) {
          console.log(`    Prefers weekend: skipping weekday ${dateStr} due to limited capacity`)
          continue
        }
      }

      // Weekend handling: respect allowWeekends and forceStartDate
      if (dayConfig.isWeekend) {
        // If weekends are disabled, skip
        if (!allowWeekends) {
          console.log(`    Skipping weekend (disabled): ${dateStr}`)
          continue
        }
        
        // If this is the start date and forceStartDate is true, prioritize it
        if (forceStartDate && dayIndex === 0) {
          // Allow scheduling on start date even if it's a weekend
          // Don't skip
        } else if (prefersWeekday) {
          // Only skip weekend if there are weekday alternatives available
        const hasWeekdayCandidate = searchDays.some(idx => idx !== dayIndex && !(dayConfigs[idx]?.isWeekend ?? false))
        if (hasWeekdayCandidate) {
            console.log(`    Prefers weekday: skipping weekend ${dateStr} (weekday alternative available)`)
          continue
          }
        }
      }
      
      // Enforce distribution: for lower priority tasks, don't schedule too early
      // This prevents all tasks from packing into early days
      const daysFromTarget = Math.abs(dayIndex - targetDay)
      const isTooEarly = dayIndex < targetDay && task.priority >= 3 && daysFromTarget > 2
      if (isTooEarly) {
        console.log(`    Skipping day ${dayIndex} - too early for priority ${task.priority} task (target: ${targetDay})`)
        continue
      }
      
      // FIX: Relax sequential ordering constraint - only enforce within same day, allow backfilling
      // This allows tasks to use available capacity on earlier days without violating logical order
      if (task.idx) {
        const priority = task.priority || 4
        const tasksInPriority = tasksByPriority.get(priority) || []
        const earlierTasksInPriority = tasksInPriority.filter(t => t.idx && t.idx < task.idx)
        
        if (earlierTasksInPriority.length > 0) {
          const earlierTaskIds = earlierTasksInPriority.map(t => t.id)
          const earlierPlacements = placements.filter(p => earlierTaskIds.includes(p.task_id))
          
          if (earlierPlacements.length > 0) {
            // Check if any earlier task is scheduled on THIS SAME day
            const earlierTasksOnSameDay = earlierPlacements.filter(p => p.day_index === dayIndex)
            
            if (earlierTasksOnSameDay.length > 0) {
              // On the same day, we need to ensure proper time ordering
              // This will be handled by the time slot allocation (findNextAvailableSlot)
              // which naturally respects chronological order within a day
              console.log(`    Task ${task.idx} shares day ${dayIndex} with earlier tasks - time ordering will be enforced`)
            }
            
            // Allow scheduling on earlier days to backfill available capacity
            // The scheduler already ensures tasks are scheduled in priority order globally
          }
        }
      }
      
      // 🔧 FIX: Schedule the entire remaining duration (we already checked it fits above)
      const durationToSchedule = remainingDuration
      
      // Find the best time slot for this task (returns earliest possible start)
      const initialStartTime = findBestTimeSlot(
        dayIndex,
        durationToSchedule,
        dayConfig,
        currentTime,
        currentDate,
        requireStartDate
      )

      if (initialStartTime) {
        // Find the next available slot that doesn't overlap
        const startTime = findNextAvailableSlot(
          initialStartTime,
          durationToSchedule,
          dateStr,
          scheduledSlots,
          dayConfig,
          currentTime
        )

          if (!startTime) {
            console.log(`    No available slot found starting from ${initialStartTime}`)
            continue
          }

          const endTime = addMinutesToTime(startTime, durationToSchedule)
          
          // Check if this time slot is in the past (only for current day)
          // Skip this check if requireStartDate is true - user explicitly required start date
          if (currentTime && currentDate && dayIndex === 0 && !requireStartDate) {
            const [startHour, startMinute] = startTime.split(':').map(Number)
            // Create task start time using UTC methods for consistency
            // currentTime is timezone-adjusted, so we use UTC methods
            const taskStartTime = new Date(Date.UTC(
              currentDate.getUTCFullYear(),
              currentDate.getUTCMonth(),
              currentDate.getUTCDate(),
              startHour,
              startMinute,
              0,
              0
            ))
            
            // Compare dates using UTC components
            const currentDateStr = `${currentTime.getUTCFullYear()}-${String(currentTime.getUTCMonth() + 1).padStart(2, '0')}-${String(currentTime.getUTCDate()).padStart(2, '0')}`
            const taskDateStr = `${taskStartTime.getUTCFullYear()}-${String(taskStartTime.getUTCMonth() + 1).padStart(2, '0')}-${String(taskStartTime.getUTCDate()).padStart(2, '0')}`
            
            if (currentDateStr === taskDateStr && taskStartTime < currentTime) {
              const currentHour = currentTime.getUTCHours()
              const currentMinute = currentTime.getUTCMinutes()
              console.log(`    Skipping past time slot: ${startTime} (current time: ${formatTime(currentHour, currentMinute)})`)
              continue
            }
          }

          // Final overlap check (shouldn't happen now, but safety check)
          const [startHour, startMinute] = startTime.split(':').map(Number)
          const [endHour, endMinute] = endTime.split(':').map(Number)
          const startMinutes = startHour * 60 + startMinute
          const endMinutes = endHour * 60 + endMinute
          
          const daySlots = scheduledSlots.get(dateStr) || []
          const hasOverlap = daySlots.some(slot => 
            startMinutes < slot.end && endMinutes > slot.start
          )
          
          if (hasOverlap) {
            console.log(`    Skipping ${startTime}-${endTime} - overlaps with existing task (shouldn't happen)`)
            continue
          }
          
          // Schedule this portion of the task
          placements.push({
            task_id: task.id,
            date: dateStr,
            day_index: dayIndex,
            start_time: startTime,
            end_time: endTime,
            duration_minutes: durationToSchedule
          })

          // Track this time slot
          if (!scheduledSlots.has(dateStr)) {
            scheduledSlots.set(dateStr, [])
          }
          scheduledSlots.get(dateStr)!.push({
            start: startMinutes,
            end: endMinutes,
            taskId: task.id
          })

          dailyScheduled[dayIndex] = alreadyScheduled + durationToSchedule
          totalScheduledHours += durationToSchedule / 60
          remainingDuration -= durationToSchedule
          scheduled = true
      if (task.idx) {
        latestSequentialDay = Math.max(latestSequentialDay, dayIndex)
      }
          
          console.log(`    ✓ Scheduled complete task (${durationToSchedule} min) on ${dateStr}`)
      }
    }

    if (!scheduled) {
      console.log(`    ⚠️ Could not find suitable time slot for task "${task.name}" (${task.estimated_duration_minutes} min)`)
      unscheduledTasks.push(task.id)
    }
  }

  console.log('🔧 Final placements order:', placements.map(p => ({ 
    task_id: p.task_id, 
    start_time: p.start_time, 
    day_index: p.day_index 
  })))

  return {
    placements,
    totalScheduledHours,
    unscheduledTasks
  }
}

/**
 * Find the best time slot for a task
 * Returns the earliest possible start time (workday start or current time for today)
 * Actual gap-finding is handled by findNextAvailableSlot
 */
function findBestTimeSlot(
  dayIndex: number,
  duration: number,
  dayConfig: DayScheduleConfig,
  currentTime?: Date,
  currentDate?: Date,
  requireStartDate?: boolean
): string | null {
  // For day 0 (today), respect the earliest start time from currentTime if provided
  // UNLESS requireStartDate is true - in that case, use workday start time
  let effectiveStartHour = dayConfig.startHour
  let effectiveStartMinute = dayConfig.startMinute
  
  if (dayIndex === 0 && currentTime && currentDate && !requireStartDate) {
    // currentTime is timezone-adjusted (represents user's local time)
    // Use UTC methods to extract user's local time components
    const earliestHour = currentTime.getUTCHours()
    const earliestMinute = currentTime.getUTCMinutes()
    const earliestMinutes = earliestHour * 60 + earliestMinute
    const workdayStartMinutes = dayConfig.startHour * 60 + dayConfig.startMinute
    
    // Use the later of workday start or earliest start time
    if (earliestMinutes > workdayStartMinutes) {
      effectiveStartHour = earliestHour
      effectiveStartMinute = earliestMinute
    }
  }

  const effectiveStartMinutes = effectiveStartHour * 60 + effectiveStartMinute
  const workdayEndMinutes = dayConfig.endHour * 60
  
  // Basic validation: check if task can fit in workday at all
  if (effectiveStartMinutes + duration > workdayEndMinutes) {
    console.log(`    ❌ Task (${duration}min) would exceed workday end (${formatTime(dayConfig.endHour, 0)})`)
    return null
  }

  const startHour = Math.floor(effectiveStartMinutes / 60)
  const startMinute = effectiveStartMinutes % 60
  const timeStr = formatTime(startHour, startMinute)
  
  console.log(`    findBestTimeSlot → ${timeStr} (earliest possible start, gap-finding will be handled by findNextAvailableSlot)`)
  
  return timeStr
}

/**
 * Add minutes to a time string and return the result
 */
function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMinutes / 60)
  const newMins = totalMinutes % 60
  return formatTime(newHours, newMins)
}

/**
 * Format hours and minutes into HH:MM string
 */
function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Find the next available time slot that doesn't overlap with existing scheduled slots
 * Scans from workday start (or current time) to find the earliest available gap
 */
function findNextAvailableSlot(
  suggestedStartTime: string,
  duration: number,
  dateStr: string,
  scheduledSlots: Map<string, Array<{start: number, end: number, taskId: string}>>,
  dayConfig: DayScheduleConfig,
  currentTime?: Date
): string | null {
  const [suggestedHour, suggestedMinute] = suggestedStartTime.split(':').map(Number)
  const suggestedStartMinutes = suggestedHour * 60 + suggestedMinute
  
  // Calculate workday boundaries
  const workdayStartMinutes = dayConfig.startHour * 60 + dayConfig.startMinute
  const workdayEndMinutes = dayConfig.endHour * 60
  
  // Calculate lunch boundaries
  const lunchStartMinutes = dayConfig.lunchStartHour * 60
  const lunchEndMinutes = dayConfig.lunchEndHour * 60
  const lunchOverlapStart = Math.max(dayConfig.startHour, dayConfig.lunchStartHour)
  const lunchOverlapEnd = Math.min(dayConfig.endHour, dayConfig.lunchEndHour)
  const lunchOverlapStartMinutes = lunchOverlapStart * 60
  const lunchOverlapEndMinutes = lunchOverlapEnd * 60
  
  // Determine the earliest we can start (workday start or current time for today)
  // We cannot schedule tasks in the past, so if it's today, we must start from current time
  // UNLESS requireStartDate is true - in that case, respect user's explicit requirement and schedule from workday start
  let earliestStartMinutes = workdayStartMinutes
  if (currentTime && !requireStartDate) {
    // currentTime is timezone-adjusted - use UTC methods for date comparison
    const currentTimeDateStr = `${currentTime.getUTCFullYear()}-${String(currentTime.getUTCMonth() + 1).padStart(2, '0')}-${String(
      currentTime.getUTCDate()
    ).padStart(2, '0')}`

    if (currentTimeDateStr === dateStr) {
      // Use UTC methods to get user's local time
      const currentHour = currentTime.getUTCHours()
      const currentMinute = currentTime.getUTCMinutes()
      const currentMinutes = currentHour * 60 + currentMinute
      // Use the later of workday start or current time (cannot schedule in past)
      earliestStartMinutes = Math.max(workdayStartMinutes, currentMinutes)
      console.log(`    ⏰ Today's plan - earliest start: ${formatTime(currentHour, currentMinute)} (current time)`)
    }
  } else if (requireStartDate && currentTime) {
    // User explicitly required start date - schedule from workday start even if current time is after workday end
    const currentTimeDateStr = `${currentTime.getUTCFullYear()}-${String(currentTime.getUTCMonth() + 1).padStart(2, '0')}-${String(
      currentTime.getUTCDate()
    ).padStart(2, '0')}`
    
    if (currentTimeDateStr === dateStr) {
      // It's day 0 and user requires start date - use workday start time
      earliestStartMinutes = workdayStartMinutes
      console.log(`    ⏰ User required start date - scheduling from workday start: ${formatTime(dayConfig.startHour, dayConfig.startMinute)}`)
    }
  }
  
  // Get existing slots for this day (includes busy slots from calendar)
  const daySlots = scheduledSlots.get(dateStr) || []
  
  // Sort slots by start time
  const sortedSlots = [...daySlots].sort((a, b) => a.start - b.start)
  
  // Log busy slots for debugging
  if (sortedSlots.length > 0) {
    console.log(`    📅 Found ${sortedSlots.length} busy slot(s) on ${dateStr}:`, 
      sortedSlots.map(s => `${formatTime(Math.floor(s.start/60), s.start%60)}-${formatTime(Math.floor(s.end/60), s.end%60)}`).join(', '))
  }
  
  // Strategy: Scan from earliest start to find the first gap that fits
  // This ensures we backfill available slots between busy periods
  let candidateStart = earliestStartMinutes
  let candidateEnd = candidateStart + duration
  
  // Check if candidate would overlap with lunch
  const wouldOverlapLunch = lunchOverlapStart < lunchOverlapEnd && 
    candidateStart < lunchOverlapEndMinutes && candidateEnd > lunchOverlapStartMinutes
  
  if (wouldOverlapLunch) {
    // Skip to after lunch
    candidateStart = lunchOverlapEndMinutes
    candidateEnd = candidateStart + duration
  }
  
  // Ensure within workday bounds
  if (candidateEnd > workdayEndMinutes) {
    console.log(`    ❌ Task (${duration}min) cannot fit in remaining workday`)
    return null
  }
  
  // Scan forward to find the first available gap
  let maxAttempts = 200 // Increased to handle more complex schedules
  let attempts = 0
  
  while (attempts < maxAttempts) {
    // Check if this candidate slot overlaps with any existing slot
    const overlappingSlot = sortedSlots.find(slot => 
      candidateStart < slot.end && candidateEnd > slot.start
    )
    
    if (!overlappingSlot) {
      // Found a valid gap! Use it
      const startHour = Math.floor(candidateStart / 60)
      const startMinute = candidateStart % 60
      const timeStr = formatTime(startHour, startMinute)
      const gapInfo = candidateStart <= suggestedStartMinutes 
        ? `earlier than suggested ${formatTime(suggestedHour, suggestedMinute)}`
        : `using for backfilling`
      console.log(`    ✅ Found available gap: ${timeStr} (${duration}min) - ${gapInfo}`)
      return timeStr
    }
    
    // There's an overlap, move to after the overlapping slot
      candidateStart = overlappingSlot.end
      candidateEnd = candidateStart + duration
      
      // Check if we need to skip lunch
      if (lunchOverlapStart < lunchOverlapEnd && 
          candidateStart < lunchOverlapEndMinutes && candidateEnd > lunchOverlapStartMinutes) {
        candidateStart = lunchOverlapEndMinutes
        candidateEnd = candidateStart + duration
      }
      
      // Check if still within workday
      if (candidateEnd > workdayEndMinutes) {
      // No more room in workday
      console.log(`    ❌ No available gap found - workday full or task too long`)
      return null
    }
    
    attempts++
  }
  
  console.log(`    ⚠️ Could not find available slot after ${maxAttempts} attempts`)
  return null
}

