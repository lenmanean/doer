/**
 * User Preferences Type Definitions
 * 
 * Centralized type definitions for all user preferences stored in the database.
 * This ensures type safety and consistency across the application.
 */

/**
 * UI Theme preference
 */
export type Theme = 'dark' | 'light'

/**
 * Accent color preference
 */
export type AccentColor = 'orange' | 'blue' | 'green' | 'purple' | 'pink' | 'yellow'

/**
 * Time format preference
 */
export type TimeFormat = '12h' | '24h'

/**
 * Start of week preference
 */
export type WeekStartDay = 0 | 1 // 0=Sunday, 1=Monday

/**
 * Priority spacing for auto-reschedule
 */
export type PrioritySpacing = 'tight' | 'moderate' | 'loose'

/**
 * Privacy preferences
 */
export interface PrivacyPreferences {
  improve_model_enabled: boolean
  analytics_enabled?: boolean
}

/**
 * Smart scheduling preferences
 */
export interface SmartSchedulingPreferences {
  enabled: boolean
  auto_reschedule: boolean
  penalty_reduction: boolean
  notification_threshold: number // hours
}

/**
 * Auto-reschedule preferences
 */
export interface AutoReschedulePreferences {
  enabled: boolean
  reschedule_window_days: number
  priority_spacing: PrioritySpacing
  buffer_minutes: number
}

/**
 * Workday preferences
 */
export interface WorkdayPreferences {
  workday_start_hour: number // 0-23
  workday_end_hour: number // 0-23
  lunch_start_hour: number // 0-23
  lunch_end_hour: number // 0-23
}

/**
 * Complete user preferences structure
 */
export interface UserPreferences {
  // UI Preferences
  theme: Theme
  accent_color: AccentColor
  
  // Time & Date Preferences
  time_format: TimeFormat
  week_start_day: WeekStartDay
  
  // Workday Preferences (can be nested or flat)
  workday?: WorkdayPreferences
  workday_start_hour?: number
  workday_end_hour?: number
  lunch_start_hour?: number
  lunch_end_hour?: number
  
  // Smart Scheduling
  smart_scheduling?: SmartSchedulingPreferences
  
  // Privacy & Data Collection
  privacy?: PrivacyPreferences
  
  // Auto-Reschedule
  auto_reschedule?: AutoReschedulePreferences
  
  // Legacy/Flat preferences (for backward compatibility)
  improve_model_enabled?: boolean // Legacy - prefer privacy.improve_model_enabled
}

/**
 * Default preferences for new users
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  accent_color: 'orange',
  time_format: '12h',
  week_start_day: 0,
  workday_start_hour: 9,
  workday_end_hour: 17,
  lunch_start_hour: 12,
  lunch_end_hour: 13,
  smart_scheduling: {
    enabled: true,
    auto_reschedule: true,
    penalty_reduction: true,
    notification_threshold: 24
  },
  privacy: {
    improve_model_enabled: false, // Always default to false (opt-in)
    analytics_enabled: false
  },
  auto_reschedule: {
    enabled: true,
    reschedule_window_days: 3,
    priority_spacing: 'moderate',
    buffer_minutes: 15
  }
}










