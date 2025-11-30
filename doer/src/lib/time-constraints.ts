/**
 * Time constraint calculation utilities
 */

export interface RemainingTimeResult {
  remainingMinutes: number
  workdayStartMinutes: number
  workdayEndMinutes: number
  lunchStartMinutes: number
  lunchEndMinutes: number
  isBeforeWorkday: boolean
  isAfterWorkday: boolean
  isDuringLunch: boolean
}

export interface UserWorkdaySettings {
  workday_start_hour?: number
  workday_end_hour?: number
  lunch_start_hour?: number
  lunch_end_hour?: number
}

/**
 * Calculate remaining time in workday for a given start date
 * Handles edge cases: before workday, during lunch, after workday
 */
export function calculateRemainingTime(
  startDate: Date,
  userSettings: UserWorkdaySettings,
  currentTime: Date
): RemainingTimeResult {
  // Use user settings or defaults
  const workdayStartHour = userSettings.workday_start_hour ?? 9
  const workdayEndHour = userSettings.workday_end_hour ?? 17
  const lunchStartHour = userSettings.lunch_start_hour ?? 12
  const lunchEndHour = userSettings.lunch_end_hour ?? 13

  // Convert to minutes
  const workdayStartMinutes = workdayStartHour * 60
  const workdayEndMinutes = workdayEndHour * 60
  const lunchStartMinutes = lunchStartHour * 60
  const lunchEndMinutes = lunchEndHour * 60

  // Get current time in minutes
  const currentHour = currentTime.getHours()
  const currentMinute = currentTime.getMinutes()
  const currentMinutes = currentHour * 60 + currentMinute

  // Check if start date is today
  const isStartDateToday =
    startDate.toDateString() === currentTime.toDateString()

  let remainingMinutes = 0
  let isBeforeWorkday = false
  let isAfterWorkday = false
  let isDuringLunch = false

  if (!isStartDateToday) {
    // Not today - full workday available
    remainingMinutes =
      workdayEndMinutes -
      workdayStartMinutes -
      (lunchEndMinutes - lunchStartMinutes)
  } else {
    // Today - calculate remaining time
    if (currentMinutes < workdayStartMinutes) {
      // Before workday starts - full day available
      isBeforeWorkday = true
      remainingMinutes =
        workdayEndMinutes -
        workdayStartMinutes -
        (lunchEndMinutes - lunchStartMinutes)
    } else if (currentMinutes >= workdayEndMinutes) {
      // After workday ends - no time remaining
      isAfterWorkday = true
      remainingMinutes = 0
    } else {
      // During workday - calculate remaining time
      if (currentMinutes < lunchStartMinutes) {
        // Before lunch - time until lunch + time after lunch
        remainingMinutes =
          lunchStartMinutes - currentMinutes + (workdayEndMinutes - lunchEndMinutes)
      } else if (currentMinutes >= lunchEndMinutes) {
        // After lunch - time until end of workday
        remainingMinutes = workdayEndMinutes - currentMinutes
      } else {
        // During lunch - time after lunch
        isDuringLunch = true
        remainingMinutes = workdayEndMinutes - lunchEndMinutes
      }
    }
  }

  return {
    remainingMinutes,
    workdayStartMinutes,
    workdayEndMinutes,
    lunchStartMinutes,
    lunchEndMinutes,
    isBeforeWorkday,
    isAfterWorkday,
    isDuringLunch,
  }
}

/**
 * Calculate how many additional days are needed to fit tasks
 */
export function calculateDaysNeeded(
  totalDurationMinutes: number,
  remainingMinutes: number,
  dailyCapacityMinutes: number
): number {
  if (totalDurationMinutes <= remainingMinutes) {
    return 0 // Fits in remaining time
  }

  // Calculate how much work remains after using today's remaining time
  const remainingWork = totalDurationMinutes - remainingMinutes

  // Calculate additional days needed (round up)
  const additionalDays = Math.ceil(remainingWork / dailyCapacityMinutes)

  return additionalDays
}

