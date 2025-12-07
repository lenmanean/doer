/**
 * Unified task validation utility
 * Provides consistent validation for task dates, times, and durations
 */

import { toLocalMidnight, formatDateForDB } from '@/lib/date-utils'
import { validateDateRange, type DateValidationOptions } from './date-validation'
import { 
  calculateDuration, 
  validateTaskDuration, 
  isValidTimeFormat,
  isCrossDayTask,
  TASK_DURATION_MIN_MINUTES 
} from '@/lib/task-time-utils'

export interface TaskValidationOptions {
  /** Whether this is a manual task (different rules apply) */
  isManualTask?: boolean
  /** Whether this is a calendar event */
  isCalendarEvent?: boolean
  /** Plan start date for validating task dates are within plan range */
  planStartDate?: string | null
  /** Plan end date for validating task dates are within plan range */
  planEndDate?: string | null
  /** Allow past dates? */
  allowPastDates?: boolean
  /** Date validation options */
  dateValidationOptions?: DateValidationOptions
}

export interface TaskValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate task scheduled date is within plan range and not in past
 */
export function validateTaskDate(
  scheduledDate: string | null | undefined,
  options: TaskValidationOptions = {}
): TaskValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { planStartDate, planEndDate, allowPastDates = false, dateValidationOptions = {} } = options

  if (!scheduledDate) {
    return {
      valid: false,
      errors: ['Task scheduled date is required'],
      warnings: []
    }
  }

  // Validate date format and range
  const dateValidation = validateDateRange(
    scheduledDate,
    scheduledDate, // Same date for single date validation
    {
      allowPastDates,
      ...dateValidationOptions,
    }
  )
  
  errors.push(...dateValidation.errors)
  warnings.push(...dateValidation.warnings)

  // Validate date is within plan range if plan dates are provided
  if (planStartDate && planEndDate) {
    const taskDate = toLocalMidnight(scheduledDate)
    const startDate = toLocalMidnight(planStartDate)
    const endDate = toLocalMidnight(planEndDate)

    if (taskDate < startDate) {
      errors.push(`Task scheduled date (${scheduledDate}) is before plan start date (${planStartDate})`)
    } else if (taskDate > endDate) {
      errors.push(`Task scheduled date (${scheduledDate}) is after plan end date (${planEndDate})`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate task time format
 */
export function validateTaskTime(
  time: string | null | undefined,
  fieldName: string = 'Time'
): TaskValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!time) {
    // Times are optional, so this is not an error
    return {
      valid: true,
      errors: [],
      warnings: []
    }
  }

  if (!isValidTimeFormat(time)) {
    errors.push(`${fieldName} must be in HH:MM format (e.g., "14:30")`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate task duration
 */
export function validateTaskDurationUtil(
  durationMinutes: number | null | undefined,
  options: TaskValidationOptions = {}
): TaskValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { isManualTask = false, isCalendarEvent = false } = options

  if (durationMinutes === null || durationMinutes === undefined) {
    return {
      valid: false,
      errors: ['Task duration is required'],
      warnings: []
    }
  }

  const validation = validateTaskDuration(durationMinutes, isCalendarEvent, isManualTask)
  
  if (!validation.isValid && validation.error) {
    errors.push(validation.error)
  }

  // Add warnings for very long durations
  if (durationMinutes > 480) { // 8 hours
    warnings.push('Very long task duration (>8 hours) - consider breaking into smaller tasks')
  }

  return {
    valid: validation.isValid,
    errors,
    warnings
  }
}

/**
 * Validate task times and calculate/validate duration
 */
export function validateTaskTimes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  options: TaskValidationOptions = {}
): TaskValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { isManualTask = false, isCalendarEvent = false } = options

  // Validate time formats
  const startTimeValidation = validateTaskTime(startTime, 'Start time')
  errors.push(...startTimeValidation.errors)
  warnings.push(...startTimeValidation.warnings)

  const endTimeValidation = validateTaskTime(endTime, 'End time')
  errors.push(...endTimeValidation.errors)
  warnings.push(...endTimeValidation.warnings)

  // If both times are provided, validate duration
  if (startTime && endTime && startTimeValidation.valid && endTimeValidation.valid) {
    const durationMinutes = calculateDuration(startTime, endTime)

    if (durationMinutes <= 0) {
      errors.push('End time must be after start time')
    } else {
      const durationValidation = validateTaskDurationUtil(durationMinutes, options)
      errors.push(...durationValidation.errors)
      warnings.push(...durationValidation.warnings)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Comprehensive task validation
 * Validates date, times, and duration together
 */
export function validateTask(
  task: {
    name?: string | null
    scheduled_date?: string | null
    start_time?: string | null
    end_time?: string | null
    estimated_duration_minutes?: number | null
  },
  options: TaskValidationOptions = {}
): TaskValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate task name
  if (!task.name || !task.name.trim()) {
    errors.push('Task name is required')
  }

  // Validate scheduled date
  if (task.scheduled_date) {
    const dateValidation = validateTaskDate(task.scheduled_date, options)
    errors.push(...dateValidation.errors)
    warnings.push(...dateValidation.warnings)
  }

  // Validate times and duration
  if (task.start_time || task.end_time) {
    const timesValidation = validateTaskTimes(task.start_time, task.end_time, options)
    errors.push(...timesValidation.errors)
    warnings.push(...timesValidation.warnings)
  } else if (task.estimated_duration_minutes) {
    // If no times but duration provided, validate duration
    const durationValidation = validateTaskDurationUtil(task.estimated_duration_minutes, options)
    errors.push(...durationValidation.errors)
    warnings.push(...durationValidation.warnings)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}
