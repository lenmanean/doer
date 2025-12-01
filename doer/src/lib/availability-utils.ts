/**
 * Utility functions for calculating and extracting availability-related information
 */

/**
 * Calculates evening workday hours based on workday end time and hours per day
 * @param workdayEndHour - The hour when the workday ends (0-23)
 * @param hoursPerDay - Number of hours available per day
 * @param bufferMinutes - Buffer time in minutes after workday ends before evening work starts (default: 30)
 * @returns Object with eveningStartHour and eveningEndHour, or undefined if calculation is invalid
 */
export function calculateEveningWorkdayHours(
  workdayEndHour: number,
  hoursPerDay: number,
  bufferMinutes: number = 30
): { eveningStartHour: number; eveningEndHour: number } | undefined {
  // Validate inputs
  if (workdayEndHour < 0 || workdayEndHour > 23) {
    return undefined
  }
  if (hoursPerDay <= 0 || hoursPerDay > 24) {
    return undefined
  }
  if (bufferMinutes < 0) {
    return undefined
  }

  // Calculate evening start time (workday end + buffer, rounded up to next hour)
  const eveningStartTotalMinutes = workdayEndHour * 60 + bufferMinutes
  const eveningStartHour = Math.ceil(eveningStartTotalMinutes / 60)

  // Calculate evening end time (evening start + hours per day)
  const eveningEndTotalMinutes = eveningStartHour * 60 + (hoursPerDay * 60)
  const eveningEndHour = Math.floor(eveningEndTotalMinutes / 60)

  // Cap at midnight (24:00 = 0:00 next day)
  if (eveningEndHour >= 24) {
    return {
      eveningStartHour: eveningStartHour >= 24 ? 0 : eveningStartHour,
      eveningEndHour: 0, // Midnight
    }
  }

  // Ensure evening doesn't start before workday ends
  if (eveningStartHour <= workdayEndHour) {
    return undefined
  }

  return {
    eveningStartHour,
    eveningEndHour,
  }
}

/**
 * Extracts workday end hour from natural language text
 * @param text - The text to parse
 * @param defaultWorkdayEndHour - Default hour to return if no time is found (default: 17)
 * @returns The workday end hour (0-23), or default if not found
 */
export function extractWorkdayEndHourFromText(
  text: string,
  defaultWorkdayEndHour: number = 17
): number {
  const lowerText = text.toLowerCase()
  
  // Patterns to match workday end times
  const timePatterns = [
    // "workday ends at 5 PM" or "work day ends at 5pm"
    /\b(?:workday|work day|work)\s+(?:ends?|finishes?|is over)\s+(?:at|by)?\s*(\d{1,2})(?::\d{2})?\s*(pm)?/i,
    // "ends at 5 PM" or "finishes at 5pm"
    /\b(?:ends?|finishes?)\s+(?:at|by)?\s*(\d{1,2})(?::\d{2})?\s*(pm)?/i,
    // "5 PM" or "5pm" (standalone time)
    /\b(\d{1,2})(?::\d{2})?\s*(pm)\b/i,
  ]

  for (const pattern of timePatterns) {
    const match = lowerText.match(pattern)
    if (match) {
      let hour = parseInt(match[1], 10)
      if (isNaN(hour) || hour < 1 || hour > 12) {
        continue
      }

      const isPM = match[2] || match[3]
      
      // Convert to 24-hour format
      if (isPM && hour < 12) {
        hour += 12 // 1 PM = 13, 2 PM = 14, etc.
      } else if (isPM && hour === 12) {
        hour = 12 // 12 PM = 12 (noon)
      } else if (!isPM && hour === 12) {
        hour = 0 // 12 AM = 0 (midnight)
      }

      // Only return if it's a valid PM hour (12-23) for workday end
      if (hour >= 12 && hour <= 23) {
        return hour
      }
    }
  }

  // Return default if no time found (ensure it's a valid PM hour)
  const validDefault = Math.max(12, Math.min(23, defaultWorkdayEndHour))
  return validDefault
}

