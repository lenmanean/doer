/**
 * Date utilities to prevent timezone drift issues
 * All dates are treated as local midnight to avoid UTC conversion issues
 */

/**
 * Create a Date object at local midnight from a date string or Date
 * This prevents timezone drift when storing/retrieving dates
 */
export function toLocalMidnight(date: Date | string): Date {
  if (typeof date === 'string') {
    // For date strings like "2026-01-01", parse directly to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
  } else {
    // For Date objects, use the existing logic
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  }
}

/**
 * Format a Date object to YYYY-MM-DD string using LOCAL time (not UTC)
 * This ensures dates stay consistent regardless of timezone
 */
export function formatDateForDB(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a date string from DB and return Date at local midnight
 * Handles both ISO strings and YYYY-MM-DD format
 */
export function parseDateFromDB(dateString: string | null | undefined): Date {
  // Handle null/undefined values
  if (!dateString) {
    console.warn('parseDateFromDB received null/undefined dateString, returning current date')
    return new Date()
  }
  
  // If it's an ISO string with time, extract just the date part
  const datePart = dateString.split('T')[0]
  const [year, month, day] = datePart.split('-').map(Number)
  // Create date in local timezone at midnight
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

/**
 * Calculate the number of days between two dates (inclusive)
 */
export function daysBetween(startDate: Date, endDate: Date): number {
  const start = toLocalMidnight(startDate)
  const end = toLocalMidnight(endDate)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1 // +1 to include both start and end dates
}

/**
 * Add days to a date and return a new Date at local midnight
 */
export function addDays(date: Date, days: number): Date {
  const result = toLocalMidnight(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Calculate which day number a date is within a roadmap (1-indexed)
 */
export function getDayNumber(date: Date, startDate: Date): number {
  const start = toLocalMidnight(startDate)
  const target = toLocalMidnight(date)
  const diffTime = target.getTime() - start.getTime()
  const dayNumber = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, dayNumber)
}

/**
 * Check if two dates are the same day (ignoring time)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  const d1 = toLocalMidnight(date1)
  const d2 = toLocalMidnight(date2)
  return d1.getTime() === d2.getTime()
}

/**
 * Format date for display (e.g., "January 15, 2025")
 */
export function formatDateForDisplay(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  }
  
  // Remove undefined values to prevent toLocaleDateString from including them
  const cleanedOptions: Intl.DateTimeFormatOptions = {}
  Object.keys(defaultOptions).forEach((key) => {
    const value = defaultOptions[key as keyof Intl.DateTimeFormatOptions]
    if (value !== undefined) {
      (cleanedOptions as any)[key] = value
    }
  })
  
  return toLocalMidnight(date).toLocaleDateString('en-US', cleanedOptions)
}

/**
 * Format time for display based on user preferences
 */
export function formatTimeForDisplay(date: Date | string, timeFormat?: '12h' | '24h'): string {
  const dateObj = typeof date === 'string' ? parseDateFromDB(date) : date
  
  if (timeFormat === '24h') {
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  } else {
    return dateObj.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }
}

/**
 * Format date and time for display based on user preferences
 */
export function formatDateTimeForDisplay(date: Date | string, timeFormat?: '12h' | '24h'): string {
  const dateStr = formatDateForDisplay(typeof date === 'string' ? parseDateFromDB(date) : date)
  const timeStr = formatTimeForDisplay(date, timeFormat)
  return `${dateStr} at ${timeStr}`
}

/**
 * Get today's date at local midnight
 */
export function getToday(): Date {
  return toLocalMidnight(new Date())
}

