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
  
  // Handle cross-day tasks: if end time is before start time, add 24 hours
  if (endMinutes < startMinutes) {
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

































