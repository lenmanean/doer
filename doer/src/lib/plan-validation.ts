// Plan Validation Module
// Provides comprehensive validation for plan generation
// Validates inputs before calling AI or creating database records

import { AvailabilityPayload, AvailabilityValidationResult, NormalizedAvailability, BusySlot } from '@/lib/types'
import { validateDate } from '@/lib/validation/date-validation'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface PlanValidationInput {
  goal_text: string
  start_date: string
  timeline_days?: number
  tasks?: Array<{
    name: string
    details?: string
    estimated_duration_minutes: number
    priority: number
  }>
  workday_settings?: {
    workday_start_hour: number
    workday_end_hour: number
    lunch_start_hour: number
    lunch_end_hour: number
  }
}

/**
 * Validate plan input before generation
 */
export function validatePlanInput(input: PlanValidationInput): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate goal text
  if (!input.goal_text || input.goal_text.trim().length === 0) {
    errors.push('Goal text is required')
  } else if (input.goal_text.trim().length < 10) {
    warnings.push('Goal text is very short - consider providing more detail for better plan quality')
  } else if (input.goal_text.trim().length > 1000) {
    errors.push('Goal text is too long (max 1000 characters)')
  }

  // Validate start date using unified validation utility
  const dateValidation = validateDate(input.start_date, {
    allowPastDates: false, // AI plans should not allow past dates
    maxPastDays: 7,
    maxFutureDays: 90,
    warnOnPastDates: true,
  })
  
  errors.push(...dateValidation.errors)
  warnings.push(...dateValidation.warnings)

  // Validate timeline days
  if (input.timeline_days !== undefined) {
    if (input.timeline_days < 1) {
      errors.push('Timeline must be at least 1 day')
    } else if (input.timeline_days > 21) {
      errors.push('Timeline cannot exceed 21 days - please break into smaller phases')
    } else if (input.timeline_days > 14) {
      warnings.push('Timeline is long (>14 days) - consider breaking into phases for better focus')
    }
  }

  // Validate tasks if provided
  if (input.tasks && input.tasks.length > 0) {
    // Check task count
    if (input.tasks.length > 20) {
      warnings.push('High task count (>20) may indicate scope creep - consider simplifying')
    }

    // Validate each task
    input.tasks.forEach((task, index) => {
      // Validate task name
      if (!task.name || task.name.trim().length === 0) {
        errors.push(`Task ${index + 1}: Name is required`)
      } else if (task.name.trim().length < 3) {
        warnings.push(`Task ${index + 1}: Name is very short`)
      }

      // Validate duration
      if (!task.estimated_duration_minutes) {
        errors.push(`Task ${index + 1} (${task.name}): Duration is required`)
      } else if (task.estimated_duration_minutes < 5) {
        errors.push(`Task ${index + 1} (${task.name}): Duration must be at least 5 minutes`)
      } else if (task.estimated_duration_minutes > 360) {
        errors.push(`Task ${index + 1} (${task.name}): Duration cannot exceed 360 minutes (6 hours) - consider breaking into sub-tasks`)
      } else if (task.estimated_duration_minutes > 180) {
        warnings.push(`Task ${index + 1} (${task.name}): Long duration (>3 hours) - consider breaking down`)
      }

      // Validate priority
      if (!task.priority) {
        errors.push(`Task ${index + 1} (${task.name}): Priority is required`)
      } else if (![1, 2, 3, 4].includes(task.priority)) {
        errors.push(`Task ${index + 1} (${task.name}): Priority must be 1 (Critical), 2 (High), 3 (Medium), or 4 (Low)`)
      }
    })

    // Validate capacity if tasks and timeline are provided
    if (input.timeline_days && input.workday_settings) {
      const result = validateCapacity({
        tasks: input.tasks,
        timeline_days: input.timeline_days,
        workday_settings: input.workday_settings
      })
      errors.push(...result.errors)
      warnings.push(...result.warnings)
    }
  }

  // Validate workday settings if provided
  if (input.workday_settings) {
    const { workday_start_hour, workday_end_hour, lunch_start_hour, lunch_end_hour } = input.workday_settings

    if (workday_start_hour < 0 || workday_start_hour > 23) {
      errors.push('Workday start hour must be between 0 and 23')
    }
    if (workday_end_hour < 1 || workday_end_hour > 24) {
      errors.push('Workday end hour must be between 1 and 24')
    }
    if (workday_start_hour >= workday_end_hour) {
      errors.push('Workday start hour must be before end hour')
    }
    if (lunch_start_hour < 0 || lunch_start_hour > 23) {
      errors.push('Lunch start hour must be between 0 and 23')
    }
    if (lunch_end_hour < 1 || lunch_end_hour > 24) {
      errors.push('Lunch end hour must be between 1 and 24')
    }
    if (lunch_start_hour >= lunch_end_hour) {
      errors.push('Lunch start hour must be before end hour')
    }

    // Calculate workday duration
    const workdayHours = workday_end_hour - workday_start_hour
    const lunchHours = lunch_end_hour - lunch_start_hour
    const netWorkdayHours = workdayHours - lunchHours

    if (netWorkdayHours < 2) {
      warnings.push('Very short workday (<2 hours) may make scheduling difficult')
    } else if (netWorkdayHours > 12) {
      warnings.push('Very long workday (>12 hours) - ensure this is sustainable')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function validateAvailabilityPayload(
  availability: AvailabilityPayload | undefined | null
): AvailabilityValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const normalized: NormalizedAvailability = {
    busySlots: [],
    timeOff: [],
    deadline: availability?.deadline ?? null
  }

  const normalizeSlots = (slots: BusySlot[] | undefined, category: 'busySlots' | 'timeOff') => {
    if (!slots || slots.length === 0) return
    slots.forEach((slot, index) => {
      if (!slot.start || !slot.end) {
        errors.push(`Availability slot ${category === 'busySlots' ? 'busy' : 'time_off'}[${index}] is missing start or end time`)
        return
      }

      const startDate = new Date(slot.start)
      const endDate = new Date(slot.end)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push(`Availability slot ${category}[${index}] has invalid date format`)
        return
      }

      if (endDate <= startDate) {
        errors.push(`Availability slot ${category}[${index}] end must be after start`)
        return
      }

      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60)
      if (durationMinutes > 60 * 24 * 14) {
        warnings.push(`Availability slot ${category}[${index}] spans more than 14 days`)
      }

      const isoStart = startDate.toISOString()
      const isoEnd = endDate.toISOString()

      normalized[category].push({
        start: isoStart,
        end: isoEnd,
        source: slot.source,
        metadata: slot.metadata
      })
    })
  }

  normalizeSlots(availability?.busy_slots, 'busySlots')
  normalizeSlots(availability?.time_off, 'timeOff')

  if (availability?.deadline) {
    const deadlineDate = new Date(availability.deadline)
    if (isNaN(deadlineDate.getTime())) {
      errors.push('Availability deadline is not a valid date')
    } else {
      normalized.deadline = deadlineDate.toISOString()
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized
  }
}

/**
 * Validate timeline capacity
 */
export function validateCapacity(input: {
  tasks: Array<{ estimated_duration_minutes: number }>
  timeline_days: number
  workday_settings: {
    workday_start_hour: number
    workday_end_hour: number
    lunch_start_hour: number
    lunch_end_hour: number
  }
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const { tasks, timeline_days, workday_settings } = input
  const { workday_start_hour, workday_end_hour, lunch_start_hour, lunch_end_hour } = workday_settings

  // Calculate available capacity
  const lunchMinutes = Math.max(0, lunch_end_hour - lunch_start_hour) * 60
  const workdayMinutes = (workday_end_hour - workday_start_hour) * 60 - lunchMinutes
  const dailyCapacity = Math.round(workdayMinutes * 0.6) // 60% utilization for realism
  const totalCapacity = timeline_days * dailyCapacity

  // Calculate required capacity
  const totalTaskMinutes = tasks.reduce((sum, task) => sum + task.estimated_duration_minutes, 0)

  // Check capacity
  if (totalTaskMinutes > totalCapacity) {
    const daysNeeded = Math.ceil(totalTaskMinutes / dailyCapacity)
    errors.push(
      `Timeline too short: ${timeline_days} day(s) can accommodate ~${totalCapacity} minutes, ` +
      `but tasks require ${totalTaskMinutes} minutes. ` +
      `Extend timeline to at least ${daysNeeded} days or reduce task scope.`
    )
  } else {
    const utilizationPercent = Math.round((totalTaskMinutes / totalCapacity) * 100)
    
    if (utilizationPercent < 30) {
      warnings.push(`Timeline underutilized (${utilizationPercent}%) - consider shorter timeline or adding more tasks`)
    } else if (utilizationPercent > 85) {
      warnings.push(`Timeline highly utilized (${utilizationPercent}%) - schedule may be tight with little buffer`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate priority distribution
 * Checks that priorities are reasonably distributed
 */
export function validatePriorityDistribution(tasks: Array<{ priority: number, name: string }>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const priorityCounts = {
    1: 0, // Critical
    2: 0, // High
    3: 0, // Medium
    4: 0  // Low
  }

  tasks.forEach(task => {
    if (task.priority >= 1 && task.priority <= 4) {
      priorityCounts[task.priority as keyof typeof priorityCounts]++
    }
  })

  const total = tasks.length
  const criticalPercent = (priorityCounts[1] / total) * 100
  const highPercent = (priorityCounts[2] / total) * 100
  const lowPercent = (priorityCounts[4] / total) * 100

  // Check for priority imbalances
  if (criticalPercent > 50) {
    warnings.push(`Too many critical priority tasks (${Math.round(criticalPercent)}%) - reconsider priorities`)
  }
  if (criticalPercent + highPercent > 75) {
    warnings.push('Most tasks are high/critical priority - this may indicate poor prioritization')
  }
  if (lowPercent > 50) {
    warnings.push(`Too many low priority tasks (${Math.round(lowPercent)}%) - consider if they're necessary`)
  }
  if (criticalPercent === 0 && highPercent === 0) {
    warnings.push('No high priority tasks - ensure important work is properly prioritized')
  }

  return {
    valid: true, // Warnings only, not errors
    errors,
    warnings
  }
}


