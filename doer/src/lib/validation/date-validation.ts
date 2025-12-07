/**
 * Unified date validation utility
 * Provides consistent date validation rules across all plan and task creation methods
 */

import { toLocalMidnight, getToday } from '@/lib/date-utils'

export interface DateValidationOptions {
  /** Allow dates in the past? (default: false for AI, true for manual with confirmation) */
  allowPastDates?: boolean
  /** Maximum days in the past allowed (default: 7) */
  maxPastDays?: number
  /** Maximum days in the future allowed (default: 90) */
  maxFutureDays?: number
  /** Whether to return warnings for past dates (default: true) */
  warnOnPastDates?: boolean
}

export interface DateValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate a date string
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 */
export function validateDate(
  dateStr: string | null | undefined,
  options: DateValidationOptions = {}
): DateValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  const {
    allowPastDates = false,
    maxPastDays = 7,
    maxFutureDays = 90,
    warnOnPastDates = true,
  } = options

  // Check if date is provided
  if (!dateStr) {
    return {
      valid: false,
      errors: ['Date is required'],
      warnings: []
    }
  }

  // Check date format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  if (!datePattern.test(dateStr)) {
    return {
      valid: false,
      errors: ['Date must be in YYYY-MM-DD format'],
      warnings: []
    }
  }

  // Parse and validate date
  const date = toLocalMidnight(dateStr)
  
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      errors: ['Invalid date'],
      warnings: []
    }
  }

  // Compare with today
  const today = getToday()
  const daysDifference = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // Check past dates
  if (daysDifference < 0) {
    const daysAgo = Math.abs(daysDifference)
    
    if (!allowPastDates) {
      errors.push(`Date cannot be in the past (${daysAgo} day(s) ago)`)
    } else {
      if (daysAgo > maxPastDays) {
        errors.push(`Date cannot be more than ${maxPastDays} days in the past`)
      } else if (warnOnPastDates && daysAgo > 0) {
        warnings.push(`Date is ${daysAgo} day(s) in the past`)
      }
    }
  }

  // Check future dates
  if (daysDifference > maxFutureDays) {
    warnings.push(`Date is more than ${maxFutureDays} days in the future`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate a date range (start and end dates)
 * @param startDateStr - Start date string in YYYY-MM-DD format
 * @param endDateStr - End date string in YYYY-MM-DD format
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 */
export function validateDateRange(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined,
  options: DateValidationOptions = {}
): DateValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate start date
  const startValidation = validateDate(startDateStr, options)
  errors.push(...startValidation.errors)
  warnings.push(...startValidation.warnings)

  // Validate end date
  const endValidation = validateDate(endDateStr, options)
  errors.push(...endValidation.errors)
  warnings.push(...endValidation.warnings)

  // If both dates are valid, check range
  if (startValidation.valid && endValidation.valid && startDateStr && endDateStr) {
    const startDate = toLocalMidnight(startDateStr)
    const endDate = toLocalMidnight(endDateStr)

    if (endDate < startDate) {
      errors.push('End date must be after or equal to start date')
    } else if (endDate.getTime() === startDate.getTime()) {
      // Equal dates are allowed for single-day plans
      warnings.push('Start and end dates are the same (single-day plan)')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Check if a date is within a valid range for plan creation
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param isAIPlan - Whether this is for AI plan generation (stricter rules)
 * @returns True if date is valid for plan creation
 */
export function isValidPlanDate(dateStr: string | null | undefined, isAIPlan: boolean = false): boolean {
  const options: DateValidationOptions = {
    allowPastDates: !isAIPlan, // AI plans should not allow past dates
    maxPastDays: isAIPlan ? 0 : 7,
    maxFutureDays: 90,
    warnOnPastDates: true,
  }
  
  const result = validateDate(dateStr, options)
  return result.valid
}
