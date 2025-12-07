/**
 * Utility functions for time-based task operations
 */

/**
 * Convert minutes to human-readable duration format
 * @param minutes - Duration in minutes
 * @returns Formatted string like "4hr", "30min", "1hr 30min"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return '0min'
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) {
    return `${mins}min`
  } else if (mins === 0) {
    return `${hours}hr`
  } else {
    return `${hours}hr ${mins}min`
  }
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 * @param time - Time string in format "HH:MM"
 * @returns Minutes since midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 * @param minutes - Minutes since midnight
 * @returns Time string in format "HH:MM"
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Check if two time ranges overlap
 * @param start1 - Start time of first range (HH:MM)
 * @param end1 - End time of first range (HH:MM)
 * @param start2 - Start time of second range (HH:MM)
 * @param end2 - End time of second range (HH:MM)
 * @returns True if ranges overlap
 */
export function checkTimeRangeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Min = parseTimeToMinutes(start1)
  const end1Min = parseTimeToMinutes(end1)
  const start2Min = parseTimeToMinutes(start2)
  const end2Min = parseTimeToMinutes(end2)
  
  return start1Min < end2Min && end1Min > start2Min
}

/**
 * Check if new time slot overlaps with any existing tasks
 * @param tasks - Array of existing tasks with start_time and end_time
 * @param newStart - New task start time (HH:MM)
 * @param newEnd - New task end time (HH:MM)
 * @param excludeTaskId - Optional task ID to exclude from check (for updating existing task)
 * @returns True if overlap detected
 */
export function checkTimeOverlap(
  tasks: Array<{ id?: string; start_time: string; end_time: string }>,
  newStart: string,
  newEnd: string,
  excludeTaskId?: string
): boolean {
  return tasks.some(task => {
    if (excludeTaskId && task.id === excludeTaskId) {
      return false // Skip the task being updated
    }
    return checkTimeRangeOverlap(task.start_time, task.end_time, newStart, newEnd)
  })
}

/**
 * Calculate duration in minutes between two times
 * @param startTime - Start time (HH:MM)
 * @param endTime - End time (HH:MM)
 * @returns Duration in minutes (handles cross-day tasks)
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  
  // Handle cross-day tasks: if end time is before or equal to start time, add 24 hours
  // Using <= ensures consistency with isCrossDayTask() and handles edge cases
  if (endMinutes <= startMinutes) {
    return (24 * 60) - startMinutes + endMinutes
  }
  
  return endMinutes - startMinutes
}

/**
 * Find an available time slot for a task
 * @param existingTasks - Array of tasks with start_time and end_time
 * @param durationMinutes - Required duration in minutes
 * @param preferredStartHour - Preferred hour to start searching (default 9 AM)
 * @param workdayEndHour - End of workday (default 5 PM)
 * @returns Available time slot or null if none found
 */
export function suggestTimeSlot(
  existingTasks: Array<{ start_time: string; end_time: string }>,
  durationMinutes: number,
  preferredStartHour: number = 9,
  workdayEndHour: number = 17
): { start_time: string; end_time: string } | null {
  const workdayStartMinutes = preferredStartHour * 60
  const workdayEndMinutes = workdayEndHour * 60
  
  // Sort tasks by start time
  const sortedTasks = [...existingTasks].sort((a, b) => 
    parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)
  )
  
  // Try to fit before first task
  if (sortedTasks.length === 0) {
    const startTime = minutesToTimeString(workdayStartMinutes)
    const endTime = minutesToTimeString(workdayStartMinutes + durationMinutes)
    return { start_time: startTime, end_time: endTime }
  }
  
  const firstTaskStart = parseTimeToMinutes(sortedTasks[0].start_time)
  if (firstTaskStart - workdayStartMinutes >= durationMinutes) {
    const startTime = minutesToTimeString(workdayStartMinutes)
    const endTime = minutesToTimeString(workdayStartMinutes + durationMinutes)
    return { start_time: startTime, end_time: endTime }
  }
  
  // Try to fit between tasks
  for (let i = 0; i < sortedTasks.length - 1; i++) {
    const currentEnd = parseTimeToMinutes(sortedTasks[i].end_time)
    const nextStart = parseTimeToMinutes(sortedTasks[i + 1].start_time)
    const gap = nextStart - currentEnd
    
    if (gap >= durationMinutes) {
      const startTime = minutesToTimeString(currentEnd)
      const endTime = minutesToTimeString(currentEnd + durationMinutes)
      return { start_time: startTime, end_time: endTime }
    }
  }
  
  // Try to fit after last task
  const lastTaskEnd = parseTimeToMinutes(sortedTasks[sortedTasks.length - 1].end_time)
  if (workdayEndMinutes - lastTaskEnd >= durationMinutes) {
    const startTime = minutesToTimeString(lastTaskEnd)
    const endTime = minutesToTimeString(lastTaskEnd + durationMinutes)
    return { start_time: startTime, end_time: endTime }
  }
  
  return null // No available slot found
}

/**
 * Snap time to nearest interval
 * @param time - Time string (HH:MM)
 * @param intervalMinutes - Interval in minutes (15, 30, or 60)
 * @returns Snapped time string
 */
export function snapToInterval(time: string, intervalMinutes: number): string {
  const totalMinutes = parseTimeToMinutes(time)
  const snappedMinutes = Math.round(totalMinutes / intervalMinutes) * intervalMinutes
  return minutesToTimeString(snappedMinutes)
}

/**
 * Validate time string format
 * @param time - Time string to validate
 * @returns True if valid HH:MM format
 */
export function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(time)
}

/**
 * Task duration validation constants
 */
export const TASK_DURATION_MIN_MINUTES = 5
export const TASK_DURATION_MAX_MINUTES = 360 // 6 hours for regular tasks

/**
 * Validate task duration
 * @param durationMinutes - Duration in minutes to validate
 * @param isCalendarEvent - Whether this is a calendar event (has no maximum)
 * @param isManualTask - Whether this is a manually created task (has no maximum, only applies to AI-generated tasks)
 * @returns Object with isValid flag and error message if invalid
 */
export function validateTaskDuration(
  durationMinutes: number,
  isCalendarEvent: boolean = false,
  isManualTask: boolean = false
): { isValid: boolean; error?: string } {
  if (durationMinutes < TASK_DURATION_MIN_MINUTES) {
    return {
      isValid: false,
      error: `Task duration must be at least ${TASK_DURATION_MIN_MINUTES} minutes. Current duration: ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}.`
    }
  }
  
  // Manual tasks and calendar events have no maximum duration limit
  // Only AI-generated tasks are limited to 6 hours
  if (!isCalendarEvent && !isManualTask && durationMinutes > TASK_DURATION_MAX_MINUTES) {
    return {
      isValid: false,
      error: `Task duration must not exceed ${TASK_DURATION_MAX_MINUTES} minutes (6 hours) for regular tasks. Current duration: ${formatDuration(durationMinutes)}.`
    }
  }
  
  return { isValid: true }
}

/**
 * Clamp duration to valid range
 * @param durationMinutes - Duration in minutes to clamp
 * @param isCalendarEvent - Whether this is a calendar event (has no maximum)
 * @param isManualTask - Whether this is a manually created task (has no maximum)
 * @returns Clamped duration in minutes
 */
export function clampTaskDuration(
  durationMinutes: number,
  isCalendarEvent: boolean = false,
  isManualTask: boolean = false
): number {
  const min = TASK_DURATION_MIN_MINUTES
  // Manual tasks and calendar events have no maximum duration limit
  const max = (isCalendarEvent || isManualTask) ? Infinity : TASK_DURATION_MAX_MINUTES
  return Math.max(min, Math.min(durationMinutes, max))
}

/**
 * Calculate end time that ensures minimum duration
 * @param startTime - Start time (HH:MM)
 * @param currentEndTime - Current end time (HH:MM), optional
 * @param minDurationMinutes - Minimum duration in minutes (default: 5)
 * @returns End time that meets minimum duration requirement
 */
export function calculateMinimumEndTime(
  startTime: string,
  currentEndTime?: string,
  minDurationMinutes: number = TASK_DURATION_MIN_MINUTES
): string {
  const startMinutes = parseTimeToMinutes(startTime)
  let endMinutes = currentEndTime ? parseTimeToMinutes(currentEndTime) : startMinutes + minDurationMinutes
  
  // Handle cross-day scenarios
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60 // Add 24 hours for cross-day
  }
  
  // Ensure minimum duration
  const currentDuration = endMinutes - startMinutes
  if (currentDuration < minDurationMinutes) {
    endMinutes = startMinutes + minDurationMinutes
    
    // Handle overflow to next day
    if (endMinutes >= 24 * 60) {
      endMinutes = endMinutes % (24 * 60)
    }
  }
  
  return minutesToTimeString(endMinutes)
}

/**
 * Get suggested end time message for invalid duration
 * @param startTime - Start time (HH:MM)
 * @param currentEndTime - Current end time (HH:MM)
 * @returns Human-readable suggestion message
 */
export function getDurationSuggestion(
  startTime: string,
  currentEndTime: string
): string {
  const suggestedEndTime = calculateMinimumEndTime(startTime, currentEndTime)
  return `Consider setting end time to ${suggestedEndTime} to meet the minimum ${TASK_DURATION_MIN_MINUTES}-minute requirement.`
}

/**
 * Check if a task spans across midnight (cross-day task)
 * @param startTime - Start time (HH:MM)
 * @param endTime - End time (HH:MM)
 * @returns True if task spans across midnight
 */
export function isCrossDayTask(startTime: string, endTime: string): boolean {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  return endMinutes <= startMinutes
}

/**
 * Split a cross-day schedule entry into two entries (start day and next day)
 * @param date - Date string (YYYY-MM-DD) for the start day
 * @param startTime - Start time (HH:MM)
 * @param endTime - End time (HH:MM)
 * @param taskId - Task ID
 * @param userId - User ID
 * @param planId - Plan ID (optional)
 * @param dayIndex - Day index for start day
 * @returns Array of two schedule entry objects for start day and next day
 * @throws Error if split segments don't meet minimum duration requirements
 */
export function splitCrossDayScheduleEntry(
  date: string,
  startTime: string,
  endTime: string,
  taskId: string,
  userId: string,
  planId: string | null = null,
  dayIndex: number = 0
): Array<{
  plan_id: string | null
  user_id: string
  task_id: string
  day_index: number
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
  status: string
}> {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  
  // Calculate durations for each segment
  const startDayDuration = (24 * 60) - startMinutes
  const endDayDuration = endMinutes
  
  // Validate that each segment meets minimum duration requirement
  if (startDayDuration < TASK_DURATION_MIN_MINUTES) {
    throw new Error(`Start day segment duration (${startDayDuration} minutes) is less than the minimum required ${TASK_DURATION_MIN_MINUTES} minutes. Please adjust your start time.`)
  }
  
  if (endDayDuration < TASK_DURATION_MIN_MINUTES) {
    throw new Error(`End day segment duration (${endDayDuration} minutes) is less than the minimum required ${TASK_DURATION_MIN_MINUTES} minutes. Please adjust your end time.`)
  }
  
  // Calculate next day date
  const [year, month, day] = date.split('-').map(Number)
  const startDate = new Date(year, month - 1, day)
  const nextDate = new Date(startDate)
  nextDate.setDate(startDate.getDate() + 1)
  
  // Format next day as YYYY-MM-DD (consistent with formatDateForDB logic)
  const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`
  
  return [
    {
      plan_id: planId,
      user_id: userId,
      task_id: taskId,
      day_index: dayIndex,
      date: date,
      start_time: startTime,
      end_time: '23:59',
      duration_minutes: startDayDuration,
      status: 'scheduled'
    },
    {
      plan_id: planId,
      user_id: userId,
      task_id: taskId,
      day_index: dayIndex,
      date: nextDateStr,
      start_time: '00:00',
      end_time: endTime,
      duration_minutes: endDayDuration,
      status: 'scheduled'
    }
  ]
}

/**
 * Get current date string and time string in local timezone
 * @returns Object with todayStr (YYYY-MM-DD) and currentTimeStr (HH:MM in 24h format)
 */
export function getCurrentDateTime(): { todayStr: string; currentTimeStr: string; currentDate: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return { todayStr, currentTimeStr, currentDate: now }
}

/**
 * Check if a date is in the past
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param currentDateStr - Optional current date string (defaults to today)
 * @returns True if date is before today
 */
export function isDateInPast(dateStr: string, currentDateStr?: string): boolean {
  if (!currentDateStr) {
    const now = new Date()
    currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  return dateStr < currentDateStr
}

/**
 * Check if a time on a specific date is in the past
 * Handles cross-day tasks correctly
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param endTimeStr - End time string in HH:MM format
 * @param currentDateStr - Optional current date string (defaults to today)
 * @param currentTimeStr - Optional current time string in HH:MM format (defaults to current time)
 * @returns True if the task date/time is in the past or overdue
 */
export function isTimeInPast(
  dateStr: string,
  endTimeStr: string,
  currentDateStr?: string,
  currentTimeStr?: string
): boolean {
  const { todayStr, currentTimeStr: nowTimeStr } = getCurrentDateTime()
  const checkDateStr = currentDateStr || todayStr
  const checkTimeStr = currentTimeStr || nowTimeStr

  // If date is in the past, time is definitely in the past
  if (dateStr < checkDateStr) {
    return true
  }

  // If date is today, check if end time has passed
  if (dateStr === checkDateStr) {
    const endMinutes = parseTimeToMinutes(endTimeStr)
    const currentMinutes = parseTimeToMinutes(checkTimeStr)
    return endMinutes < currentMinutes
  }

  // Future date, not in past
  return false
}

/**
 * Check if a task (date + end time) is in the past or would be overdue
 * This is the main validation function for checking if a task should be skipped or requires confirmation
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param endTimeStr - End time string in HH:MM format
 * @param currentDateStr - Optional current date string (defaults to today)
 * @param currentTimeStr - Optional current time string in HH:MM format (defaults to current time)
 * @returns True if task is in the past or overdue
 */
export function isTaskInPast(
  dateStr: string,
  endTimeStr: string,
  currentDateStr?: string,
  currentTimeStr?: string
): boolean {
  return isTimeInPast(dateStr, endTimeStr, currentDateStr, currentTimeStr)
}

/**
 * Check if a task would be overdue (same as isTaskInPast, alias for clarity)
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param endTimeStr - End time string in HH:MM format
 * @param currentDateStr - Optional current date string (defaults to today)
 * @param currentTimeStr - Optional current time string in HH:MM format (defaults to current time)
 * @returns True if task would be overdue
 */
export function isTaskOverdue(
  dateStr: string,
  endTimeStr: string,
  currentDateStr?: string,
  currentTimeStr?: string
): boolean {
  return isTaskInPast(dateStr, endTimeStr, currentDateStr, currentTimeStr)
}

/**
 * Check if a date should be skipped when generating recurring tasks
 * Returns true if the date is in the past (should be skipped)
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param currentDateStr - Optional current date string (defaults to today)
 * @returns True if date should be skipped (is in past)
 */
export function shouldSkipPastDate(dateStr: string, currentDateStr?: string): boolean {
  return isDateInPast(dateStr, currentDateStr)
}

/**
 * Check if a task instance should be skipped when generating recurring tasks
 * Returns true if the date/time combination is in the past (should be skipped)
 * Handles both past dates and overdue times on current date
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param endTimeStr - End time string in HH:MM format
 * @param currentDateStr - Optional current date string (defaults to today)
 * @param currentTimeStr - Optional current time string in HH:MM format (defaults to current time)
 * @returns True if task instance should be skipped
 */
export function shouldSkipPastTaskInstance(
  dateStr: string,
  endTimeStr: string,
  currentDateStr?: string,
  currentTimeStr?: string
): boolean {
  return isTaskInPast(dateStr, endTimeStr, currentDateStr, currentTimeStr)
}





























