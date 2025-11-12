/**
 * Preference Validation Utilities
 * 
 * Server-side validation functions for user preferences.
 * Always validate on the server, even if client-side validation exists.
 */

import type { 
  Theme, 
  AccentColor, 
  TimeFormat, 
  WeekStartDay,
  PrioritySpacing,
  UserPreferences 
} from '@/lib/types/preferences'

/**
 * Validate theme value
 */
export function validateTheme(theme: any): theme is Theme {
  return theme === 'dark' || theme === 'light'
}

/**
 * Validate accent color value
 */
export function validateAccentColor(color: any): color is AccentColor {
  const validColors: AccentColor[] = ['orange', 'blue', 'green', 'purple', 'pink', 'yellow']
  return typeof color === 'string' && validColors.includes(color as AccentColor)
}

/**
 * Validate time format value
 */
export function validateTimeFormat(format: any): format is TimeFormat {
  return format === '12h' || format === '24h'
}

/**
 * Validate week start day value
 */
export function validateWeekStartDay(day: any): day is WeekStartDay {
  return day === 0 || day === 1
}

/**
 * Validate hour value (0-23)
 */
export function validateHour(hour: any): hour is number {
  return typeof hour === 'number' && hour >= 0 && hour <= 23 && Number.isInteger(hour)
}

/**
 * Validate priority spacing value
 */
export function validatePrioritySpacing(spacing: any): spacing is PrioritySpacing {
  return spacing === 'tight' || spacing === 'moderate' || spacing === 'loose'
}

/**
 * Validate privacy preferences
 */
export function validatePrivacyPreferences(privacy: any): boolean {
  if (typeof privacy !== 'object' || privacy === null) {
    return false
  }
  
  // improve_model_enabled must be boolean if present
  if ('improve_model_enabled' in privacy) {
    if (typeof privacy.improve_model_enabled !== 'boolean') {
      return false
    }
  }
  
  // analytics_enabled must be boolean if present
  if ('analytics_enabled' in privacy) {
    if (typeof privacy.analytics_enabled !== 'boolean') {
      return false
    }
  }
  
  return true
}

/**
 * Validate smart scheduling preferences
 */
export function validateSmartSchedulingPreferences(smartScheduling: any): boolean {
  if (typeof smartScheduling !== 'object' || smartScheduling === null) {
    return false
  }
  
  if ('enabled' in smartScheduling && typeof smartScheduling.enabled !== 'boolean') {
    return false
  }
  
  if ('auto_reschedule' in smartScheduling && typeof smartScheduling.auto_reschedule !== 'boolean') {
    return false
  }
  
  if ('penalty_reduction' in smartScheduling && typeof smartScheduling.penalty_reduction !== 'boolean') {
    return false
  }
  
  if ('notification_threshold' in smartScheduling) {
    if (typeof smartScheduling.notification_threshold !== 'number' || 
        smartScheduling.notification_threshold < 0 || 
        smartScheduling.notification_threshold > 168) { // Max 1 week
      return false
    }
  }
  
  return true
}

/**
 * Validate auto-reschedule preferences
 */
export function validateAutoReschedulePreferences(autoReschedule: any): boolean {
  if (typeof autoReschedule !== 'object' || autoReschedule === null) {
    return false
  }
  
  if ('enabled' in autoReschedule && typeof autoReschedule.enabled !== 'boolean') {
    return false
  }
  
  if ('reschedule_window_days' in autoReschedule) {
    if (typeof autoReschedule.reschedule_window_days !== 'number' ||
        autoReschedule.reschedule_window_days < 0 ||
        autoReschedule.reschedule_window_days > 30) {
      return false
    }
  }
  
  if ('priority_spacing' in autoReschedule) {
    if (!validatePrioritySpacing(autoReschedule.priority_spacing)) {
      return false
    }
  }
  
  if ('buffer_minutes' in autoReschedule) {
    if (typeof autoReschedule.buffer_minutes !== 'number' ||
        autoReschedule.buffer_minutes < 0 ||
        autoReschedule.buffer_minutes > 120) {
      return false
    }
  }
  
  return true
}

/**
 * Sanitize and validate user preferences
 * Returns sanitized preferences or null if invalid
 */
export function sanitizePreferences(prefs: any): Partial<UserPreferences> | null {
  if (typeof prefs !== 'object' || prefs === null) {
    return null
  }
  
  const sanitized: Partial<UserPreferences> = {}
  
  // Validate and sanitize theme
  if (prefs.theme !== undefined) {
    if (!validateTheme(prefs.theme)) {
      return null
    }
    sanitized.theme = prefs.theme
  }
  
  // Validate and sanitize accent_color
  if (prefs.accent_color !== undefined) {
    if (!validateAccentColor(prefs.accent_color)) {
      return null
    }
    sanitized.accent_color = prefs.accent_color
  }
  
  // Validate and sanitize time_format
  if (prefs.time_format !== undefined) {
    if (!validateTimeFormat(prefs.time_format)) {
      return null
    }
    sanitized.time_format = prefs.time_format
  }
  
  // Validate and sanitize week_start_day
  if (prefs.week_start_day !== undefined) {
    if (!validateWeekStartDay(prefs.week_start_day)) {
      return null
    }
    sanitized.week_start_day = prefs.week_start_day
  }
  
  // Validate and sanitize workday hours
  if (prefs.workday_start_hour !== undefined) {
    if (!validateHour(prefs.workday_start_hour)) {
      return null
    }
    sanitized.workday_start_hour = prefs.workday_start_hour
  }
  
  if (prefs.workday_end_hour !== undefined) {
    if (!validateHour(prefs.workday_end_hour)) {
      return null
    }
    sanitized.workday_end_hour = prefs.workday_end_hour
  }
  
  if (prefs.lunch_start_hour !== undefined) {
    if (!validateHour(prefs.lunch_start_hour)) {
      return null
    }
    sanitized.lunch_start_hour = prefs.lunch_start_hour
  }
  
  if (prefs.lunch_end_hour !== undefined) {
    if (!validateHour(prefs.lunch_end_hour)) {
      return null
    }
    sanitized.lunch_end_hour = prefs.lunch_end_hour
  }
  
  // Validate and sanitize privacy preferences
  if (prefs.privacy !== undefined) {
    if (!validatePrivacyPreferences(prefs.privacy)) {
      return null
    }
    sanitized.privacy = {
      improve_model_enabled: prefs.privacy.improve_model_enabled ?? false,
      analytics_enabled: prefs.privacy.analytics_enabled ?? false
    }
  }
  
  // Legacy improve_model_enabled (migrate to privacy.improve_model_enabled)
  if (prefs.improve_model_enabled !== undefined) {
    if (typeof prefs.improve_model_enabled !== 'boolean') {
      return null
    }
    // Migrate to privacy object
    sanitized.privacy = {
      ...sanitized.privacy,
      improve_model_enabled: prefs.improve_model_enabled
    }
  }
  
  // Validate and sanitize smart_scheduling
  if (prefs.smart_scheduling !== undefined) {
    if (!validateSmartSchedulingPreferences(prefs.smart_scheduling)) {
      return null
    }
    sanitized.smart_scheduling = prefs.smart_scheduling
  }
  
  // Validate and sanitize auto_reschedule
  if (prefs.auto_reschedule !== undefined) {
    if (!validateAutoReschedulePreferences(prefs.auto_reschedule)) {
      return null
    }
    sanitized.auto_reschedule = prefs.auto_reschedule
  }
  
  return sanitized
}









