import { format, parseISO, startOfWeek, endOfWeek, getDay } from 'date-fns'

export type TimeFormat = '12h' | '24h'
export type StartOfWeek = 'sunday' | 'monday'

interface UserPreferences {
  timeFormat: TimeFormat
  startOfWeek: StartOfWeek
}

// Default preferences
const defaultPreferences: UserPreferences = {
  timeFormat: '12h',
  startOfWeek: 'monday'
}

// Get user preferences from localStorage or return defaults
export function getUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') return defaultPreferences
  
  try {
    const saved = localStorage.getItem('user-preferences')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        timeFormat: parsed.timeFormat || defaultPreferences.timeFormat,
        startOfWeek: parsed.startOfWeek || defaultPreferences.startOfWeek
      }
    }
  } catch (error) {
    console.error('Error loading user preferences:', error)
  }
  
  return defaultPreferences
}

// Save user preferences to localStorage
export function saveUserPreferences(preferences: Partial<UserPreferences>) {
  if (typeof window === 'undefined') return
  
  try {
    const current = getUserPreferences()
    const updated = { ...current, ...preferences }
    localStorage.setItem('user-preferences', JSON.stringify(updated))
  } catch (error) {
    console.error('Error saving user preferences:', error)
  }
}

// Format time based on user preference
export function formatTime(date: Date | string, preferences?: UserPreferences): string {
  const prefs = preferences || getUserPreferences()
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  
  if (prefs.timeFormat === '24h') {
    return format(dateObj, 'HH:mm')
  } else {
    return format(dateObj, 'h:mm a')
  }
}

// Format date and time based on user preference
export function formatDateTime(date: Date | string, preferences?: UserPreferences): string {
  const prefs = preferences || getUserPreferences()
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  
  const dateStr = format(dateObj, 'MMM d, yyyy')
  const timeStr = formatTime(dateObj, prefs)
  
  return `${dateStr} at ${timeStr}`
}

// Get start of week based on user preference
export function getStartOfWeek(date: Date, preferences?: UserPreferences): Date {
  const prefs = preferences || getUserPreferences()
  const weekStartsOn = prefs.startOfWeek === 'sunday' ? 0 : 1
  return startOfWeek(date, { weekStartsOn })
}

// Get end of week based on user preference
export function getEndOfWeek(date: Date, preferences?: UserPreferences): Date {
  const prefs = preferences || getUserPreferences()
  const weekStartsOn = prefs.startOfWeek === 'sunday' ? 0 : 1
  return endOfWeek(date, { weekStartsOn })
}

// Check if a date is the start of the week
export function isStartOfWeek(date: Date, preferences?: UserPreferences): boolean {
  const prefs = preferences || getUserPreferences()
  const weekStartsOn = prefs.startOfWeek === 'sunday' ? 0 : 1
  return getDay(date) === weekStartsOn
}

// Get week day name with proper capitalization
export function getWeekDayName(date: Date, format: 'short' | 'long' = 'short'): string {
  if (format === 'long') {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }
}

// Format relative time (e.g., "2 hours ago", "in 3 days")
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  const now = new Date()
  const diffMs = dateObj.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  
  if (Math.abs(diffDays) >= 1) {
    return diffDays > 0 ? `in ${diffDays} day${diffDays > 1 ? 's' : ''}` : `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`
  } else if (Math.abs(diffHours) >= 1) {
    return diffHours > 0 ? `in ${diffHours} hour${diffHours > 1 ? 's' : ''}` : `${Math.abs(diffHours)} hour${Math.abs(diffHours) > 1 ? 's' : ''} ago`
  } else if (Math.abs(diffMinutes) >= 1) {
    return diffMinutes > 0 ? `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}` : `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) > 1 ? 's' : ''} ago`
  } else {
    return 'just now'
  }
}









