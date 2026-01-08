/**
 * Goal analysis utilities for detecting urgency and time constraints
 */

/**
 * Combine goal text with clarifications into a single contextual string
 * This ensures AI has full context when analyzing goals
 */
export function combineGoalWithClarifications(
  goalText: string,
  clarifications?: Record<string, any> | string[]
): string {
  if (!clarifications) {
    return goalText
  }

  const clarificationTexts: string[] = []

  if (Array.isArray(clarifications)) {
    // If clarifications is an array of strings, add them directly
    clarificationTexts.push(...clarifications.filter(v => typeof v === 'string' && v.trim()))
  } else if (typeof clarifications === 'object') {
    // If clarifications is an object, extract all string values
    for (const key in clarifications) {
      const value = clarifications[key]
      if (typeof value === 'string' && value.trim()) {
        clarificationTexts.push(value)
      } else if (Array.isArray(value)) {
        // Handle arrays of strings (like clarification_questions)
        clarificationTexts.push(...value.filter(v => typeof v === 'string' && v.trim()))
      }
    }
  }

  if (clarificationTexts.length === 0) {
    return goalText
  }

  // Combine goal with clarifications in a structured way
  const clarificationsText = clarificationTexts.join(' ')
  return `${goalText}\n\nAdditional context: ${clarificationsText}`
}

export interface TimelineRequirement {
  minimumDays?: number
  preferredDays?: number
  timelinePhrase?: string
}

export interface AvailabilityPattern {
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night'
  hoursPerDay?: number
  daysOfWeek?: ('weekday' | 'weekend')[]
  requiresClarification?: boolean
  clarificationQuestions?: string[]
}

export interface SettingsConflict {
  type: 'weekend_scheduling' | 'workday_hours' | 'time_availability' | 'evening_availability' | 'morning_availability' | 'hours_per_day'
  description: string
  goalPreference: string
  userSetting: string
  settingsTab: 'workday' | 'account' | 'subscription' | 'privacy' | 'preferences'
  alternativeText: string
}

export interface UrgencyAnalysis {
  urgencyLevel: 'high' | 'medium' | 'low' | 'none'
  indicators: string[]
  requiresToday: boolean
  requiresSpecificTime: boolean
  deadlinePhrase?: string
  deadlineDate?: Date
  deadlineType?: 'tomorrow' | 'specific_date' | 'none'
  timelineRequirement?: TimelineRequirement
}

/**
 * Detect urgency indicators in goal text and clarifications
 * Analyzes both the goal description and user clarifications for time-sensitive language and deadlines
 */
export function detectUrgencyIndicators(
  goalText: string,
  clarifications?: Record<string, any> | string[]
): UrgencyAnalysis {
  // Use the helper function to combine goal with clarifications
  const combinedText = combineGoalWithClarifications(goalText, clarifications)
  const lowerText = combinedText.toLowerCase()
  const indicators: string[] = []
  let requiresToday = false
  let requiresSpecificTime = false
  let deadlinePhrase: string | undefined

  // High urgency patterns - explicit "today" requirements
  const todayPatterns = [
    /\btoday\b/,
    /\bby end of day\b/,
    /\bby end of today\b/,
    /\bcomplete everything today\b/,
    /\bfinish today\b/,
    /\bdue today\b/,
    /\bmust be done today\b/,
    /\bneeds to be completed today\b/,
  ]

  // Medium urgency patterns - time-sensitive but not necessarily today
  const timeSensitivePatterns = [
    /\btomorrow\b/,
    /\bby tomorrow\b/,
    /\bby (?:the )?end of (?:the )?week\b/,
    /\bdeadline\b/,
    /\bdue (?:by|on)\b/,
    /\bby (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bby \d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i,
    /\bby \d{1,2}\/\d{1,2}\b/, // dates like "by 12/25"
  ]

  // Low urgency patterns - general urgency but flexible
  const urgencyWords = [
    /\burgent\b/,
    /\basap\b/,
    /\bas soon as possible\b/,
    /\bimmediately\b/,
    /\bquickly\b/,
    /\bsoon\b/,
    /\bpriority\b/,
    /\bimportant\b/,
  ]

  // Check for today requirements
  for (const pattern of todayPatterns) {
    if (pattern.test(lowerText)) {
      requiresToday = true
      const match = lowerText.match(pattern)
      if (match) {
        indicators.push(match[0])
        deadlinePhrase = match[0]
      }
    }
  }

  // Check for specific time/deadline requirements
  for (const pattern of timeSensitivePatterns) {
    if (pattern.test(lowerText)) {
      requiresSpecificTime = true
      const match = lowerText.match(pattern)
      if (match && !indicators.includes(match[0])) {
        indicators.push(match[0])
        if (!deadlinePhrase) {
          deadlinePhrase = match[0]
        }
      }
    }
  }

  // Check for general urgency words
  for (const pattern of urgencyWords) {
    if (pattern.test(lowerText)) {
      const match = lowerText.match(pattern)
      if (match && !indicators.includes(match[0])) {
        indicators.push(match[0])
      }
    }
  }

  // Determine urgency level
  let urgencyLevel: 'high' | 'medium' | 'low' | 'none' = 'none'
  if (requiresToday) {
    urgencyLevel = 'high'
  } else if (requiresSpecificTime) {
    urgencyLevel = 'medium'
  } else if (indicators.length > 0) {
    urgencyLevel = 'low'
  }

  // Detect deadline date
  const deadlineInfo = detectDeadlineDate(goalText, clarifications, new Date())
  
  // Detect timeline requirement
  const timelineRequirement = detectTimelineRequirement(goalText, clarifications)

  return {
    urgencyLevel,
    indicators: [...new Set(indicators)], // Remove duplicates
    requiresToday,
    requiresSpecificTime,
    deadlinePhrase,
    deadlineDate: deadlineInfo.deadlineDate,
    deadlineType: deadlineInfo.deadlineType,
    timelineRequirement,
  }
}

/**
 * Detect and calculate actual deadline date from goal text and clarifications
 * Parses phrases like "tomorrow morning", "by tomorrow", "by [date]", etc.
 */
export function detectDeadlineDate(
  goalText: string,
  clarifications?: Record<string, any> | string[],
  currentDate: Date = new Date()
): { deadlineDate: Date | undefined; deadlineType: 'tomorrow' | 'specific_date' | 'none' } {
  const combinedText = combineGoalWithClarifications(goalText, clarifications)
  const lowerText = combinedText.toLowerCase()

  // Normalize current date to midnight for accurate day calculations
  const today = new Date(currentDate)
  today.setHours(0, 0, 0, 0)

  // Check for "tomorrow" patterns
  const tomorrowPatterns = [
    /\btomorrow\s+(?:morning|afternoon|evening|night)\b/,
    /\bby\s+tomorrow\s+(?:morning|afternoon|evening|night)\b/,
    /\btomorrow\b/,
    /\bby\s+tomorrow\b/,
  ]

  for (const pattern of tomorrowPatterns) {
    if (pattern.test(lowerText)) {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return { deadlineDate: tomorrow, deadlineType: 'tomorrow' }
    }
  }

  // Check for specific date patterns (MM/DD, MM-DD, "by [day name]", etc.)
  // Date patterns like "by 12/25", "by 12-25", "by December 25"
  const datePatterns = [
    /\bby\s+(\d{1,2})\/(\d{1,2})\b/, // "by 12/25"
    /\bby\s+(\d{1,2})-(\d{1,2})\b/, // "by 12-25"
    /\bdue\s+(?:on|by)\s+(\d{1,2})\/(\d{1,2})\b/, // "due on 12/25"
    /\bdeadline\s+(?:is|on|by)\s+(\d{1,2})\/(\d{1,2})\b/, // "deadline is 12/25"
  ]

  for (const pattern of datePatterns) {
    const match = lowerText.match(pattern)
    if (match) {
      const month = parseInt(match[1], 10)
      const day = parseInt(match[2], 10)
      const currentYear = today.getFullYear()
      
      // Create date for this year
      const deadlineDate = new Date(currentYear, month - 1, day)
      
      // If the date has passed this year, assume next year
      if (deadlineDate < today) {
        deadlineDate.setFullYear(currentYear + 1)
      }
      
      return { deadlineDate, deadlineType: 'specific_date' }
    }
  }

  // Check for day name patterns (e.g., "by Monday", "by next Friday")
  const dayNamePattern = /\bby\s+(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  const dayNameMatch = lowerText.match(dayNamePattern)
  if (dayNameMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const targetDayName = dayNameMatch[1].toLowerCase()
    const targetDayIndex = dayNames.indexOf(targetDayName)
    const currentDayIndex = today.getDay()
    
    let daysUntilTarget = targetDayIndex - currentDayIndex
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7 // Next week
    }
    if (lowerText.includes('next')) {
      daysUntilTarget += 7 // Explicitly "next [day]"
    }
    
    const deadlineDate = new Date(today)
    deadlineDate.setDate(deadlineDate.getDate() + daysUntilTarget)
    return { deadlineDate, deadlineType: 'specific_date' }
  }

  return { deadlineDate: undefined, deadlineType: 'none' }
}

/**
 * Detect explicit timeline requirements from goal text and clarifications
 * Identifies phrases like "in X days", "over X days", "happening in X days", etc.
 */
export function detectTimelineRequirement(
  goalText: string,
  clarifications?: Record<string, any> | string[]
): TimelineRequirement {
  const combinedText = combineGoalWithClarifications(goalText, clarifications)
  const lowerText = combinedText.toLowerCase()
  
  // Map word numbers to digits
  const wordToNumber: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20
  }
  
  // Patterns for explicit timeline requirements
  // "in X days", "over X days", "happening in X days", "within X days"
  // Also handle "one week", "in one week", "over one week", etc.
  // Also handle "in the next X weeks/days", "over the next X weeks/days"
  const timelinePatterns = [
    // Week-based patterns with "next" keyword (check these first as they're more specific)
    /\b(?:in|over|within|for)\s+the\s+next\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+weeks?\b/i,
    /\b(?:in|over|within|for)\s+the\s+next\s+(\d+)\s+weeks?\b/i,
    /\b(?:in|over|within|for)\s+next\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+weeks?\b/i,
    /\b(?:in|over|within|for)\s+next\s+(\d+)\s+weeks?\b/i,
    // Week-based patterns (check these first as they're more specific)
    /\b(?:in|over|within|for)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+weeks?\b/i,
    /\b(?:in|over|within|for)\s+(\d+)\s+weeks?\b/,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+week\s+(?:plan|timeline|schedule)\b/i,
    /\b(\d+)\s+week\s+(?:plan|timeline|schedule)\b/,
    // Day-based patterns with "next" keyword
    /\b(?:in|over|within|for)\s+the\s+next\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+days?\b/i,
    /\b(?:in|over|within|for)\s+the\s+next\s+(\d+)\s+days?\b/i,
    /\b(?:in|over|within|for)\s+next\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+days?\b/i,
    /\b(?:in|over|within|for)\s+next\s+(\d+)\s+days?\b/i,
    // Day-based patterns
    /\b(?:in|over|within|for)\s+(\d+)\s+days?\b/,  // Digits
    /\b(?:in|over|within|for)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+days?\b/i,  // Word numbers
    /\bhappening\s+in\s+(\d+)\s+days?\b/,
    /\bhappening\s+in\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+days?\b/i,
    /\b(?:complete|finish|done)\s+(?:in|over|within)\s+(\d+)\s+days?\b/,
    /\b(?:complete|finish|done)\s+(?:in|over|within)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+days?\b/i,
    /\b(\d+)\s+day\s+(?:plan|timeline|schedule)\b/,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+day\s+(?:plan|timeline|schedule)\b/i,
  ]
  
  for (const pattern of timelinePatterns) {
    const match = lowerText.match(pattern)
    if (match) {
      let days: number
      const matchedValue = match[1].toLowerCase()
      const fullMatch = match[0].toLowerCase()
      
      // Check if it's a week-based pattern
      const isWeekPattern = fullMatch.includes('week')
      
      // Check if it's a word number
      if (wordToNumber[matchedValue]) {
        days = wordToNumber[matchedValue]
      } else {
        days = parseInt(matchedValue, 10)
      }
      
      // Convert weeks to days
      if (isWeekPattern) {
        days = days * 7
      }
      
      if (days > 0 && days <= 365) { // Reasonable range
        return {
          minimumDays: days,
          preferredDays: days,
          timelinePhrase: match[0]
        }
      }
    }
  }
  
  return {}
}

/**
 * Detect availability patterns from goal text and clarifications
 * Extracts information about when and how much time the user has available
 */
export function detectAvailabilityPatterns(
  goalText: string,
  clarifications?: Record<string, any> | string[],
  workdaySettings?: { workday_end_hour?: number }
): AvailabilityPattern {
  const combinedText = combineGoalWithClarifications(goalText, clarifications)
  const lowerText = combinedText.toLowerCase()
  
  const result: AvailabilityPattern = {}
  const questions: string[] = []
  
  // Detect time of day patterns
  if (lowerText.includes('evening') || lowerText.includes('evenings')) {
    result.timeOfDay = 'evening'
    // Check if "after work" is mentioned
    if (lowerText.includes('after work') || lowerText.includes('after-work')) {
      // Check if workday end time is available in user settings or clarifications
      const hasWorkdayEndInSettings = workdaySettings?.workday_end_hour !== undefined && workdaySettings.workday_end_hour !== null
      const hasWorkdayEndInClarifications = checkForWorkdayEnd(clarifications)
      
      if (!hasWorkdayEndInSettings && !hasWorkdayEndInClarifications) {
        result.requiresClarification = true
        questions.push('What time does your workday end?')
      }
    }
  } else if (lowerText.includes('morning') || lowerText.includes('mornings')) {
    result.timeOfDay = 'morning'
  } else if (lowerText.includes('afternoon') || lowerText.includes('afternoons')) {
    result.timeOfDay = 'afternoon'
  } else if (lowerText.includes('night') || lowerText.includes('nights')) {
    result.timeOfDay = 'night'
  }
  
  // Detect hours per day patterns
  // Patterns: "X hours available", "X hours per day", "about X hours", "X hours each"
  const hoursPatterns = [
    /(?:about|approximately|around|roughly)?\s*(\d+(?:\.\d+)?)\s+hours?\s+(?:available|per day|each|every day|daily)/i,
    /(?:have|got|get)\s+(?:about|approximately|around|roughly)?\s*(\d+(?:\.\d+)?)\s+hours?\s+(?:available|each|per day|every day|daily)/i,
    /(\d+(?:\.\d+)?)\s+hours?\s+(?:available|per day|each|every day|daily)/i,
  ]
  
  for (const pattern of hoursPatterns) {
    const match = lowerText.match(pattern)
    if (match) {
      const hours = parseFloat(match[1])
      if (hours > 0 && hours <= 24) {
        result.hoursPerDay = hours
        break
      }
    }
  }
  
  // Detect days of week patterns
  if (lowerText.includes('weekend') || lowerText.includes('weekends')) {
    result.daysOfWeek = ['weekend']
    // Check if weekend hours are specified
    if (!lowerText.match(/\d+\s*(?:am|pm|hours?)/i)) {
      result.requiresClarification = true
      if (!questions.some(q => q.includes('weekend'))) {
        questions.push('What hours are you available on weekends?')
      }
    }
  } else if (lowerText.includes('weekday') || lowerText.includes('weekdays')) {
    result.daysOfWeek = ['weekday']
  }
  
  // Detect "after [time]" patterns
  const afterTimePattern = /after\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  const afterTimeMatch = lowerText.match(afterTimePattern)
  if (afterTimeMatch) {
    // Time is specified, no clarification needed
    result.timeOfDay = result.timeOfDay || 'evening'
  }
  
  // Detect "before [time]" patterns
  const beforeTimePattern = /before\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  const beforeTimeMatch = lowerText.match(beforeTimePattern)
  if (beforeTimeMatch) {
    result.timeOfDay = result.timeOfDay || 'morning'
  }
  
  // Set clarification questions if needed
  if (questions.length > 0) {
    result.clarificationQuestions = questions
  }
  
  return result
}

/**
 * Extract workday hours from goal text (e.g., "8am-6pm", "9 to 5")
 */
function extractWorkdayHoursFromGoal(goalText: string): { startHour?: number; endHour?: number } | null {
  const lowerText = goalText.toLowerCase()
  
  // Patterns: "8am-6pm", "9am to 5pm", "8:00 AM - 6:00 PM", "9-5", "9 to 5"
  const patterns = [
    /(\d{1,2})(?::\d{2})?\s*(am|pm)\s*[-–—to]\s*(\d{1,2})(?::\d{2})?\s*(am|pm)/i,
    /(\d{1,2})\s*[-–—to]\s*(\d{1,2})\s*(?:pm|am)?/i, // "9-5" or "9 to 5"
    /work\s+(?:from|between)\s+(\d{1,2})(?::\d{2})?\s*(am|pm)\s*(?:[-–—to]|until)\s*(\d{1,2})(?::\d{2})?\s*(am|pm)/i,
  ]
  
  for (const pattern of patterns) {
    const match = lowerText.match(pattern)
    if (match) {
      let startHour = parseInt(match[1], 10)
      let endHour = parseInt(match[match.length === 3 ? 2 : 3], 10)
      
      // Handle AM/PM
      if (match.length >= 4) {
        const startPeriod = match[2]?.toLowerCase()
        const endPeriod = match[4]?.toLowerCase()
        
        if (startPeriod === 'pm' && startHour !== 12) startHour += 12
        if (startPeriod === 'am' && startHour === 12) startHour = 0
        if (endPeriod === 'pm' && endHour !== 12) endHour += 12
        if (endPeriod === 'am' && endHour === 12) endHour = 0
      } else {
        // Assume "9-5" means 9am-5pm
        if (endHour < startHour || endHour <= 12) {
          // Likely means 9am-5pm
        }
      }
      
      if (startHour >= 0 && startHour <= 23 && endHour >= 0 && endHour <= 24) {
        return { startHour, endHour }
      }
    }
  }
  
  return null
}

/**
 * Extract time from "after X" or "before X" patterns
 */
function extractTimeFromPattern(goalText: string, pattern: 'after' | 'before'): number | null {
  const lowerText = goalText.toLowerCase()
  const timePattern = new RegExp(`${pattern}\\s+(\\d{1,2})(?::\\d{2})?\\s*(am|pm)?`, 'i')
  const match = lowerText.match(timePattern)
  
  if (match) {
    let hour = parseInt(match[1], 10)
    const period = match[2]?.toLowerCase()
    
    if (period === 'pm' && hour !== 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0
    
    if (hour >= 0 && hour <= 23) {
      return hour
    }
  }
  
  return null
}

/**
 * Detect conflicts between goal preferences and user settings
 * Returns an array of conflicts that need to be resolved before plan generation
 */
export function detectSettingsConflicts(
  goalText: string,
  clarifications?: Record<string, any> | string[],
  userSettings?: { 
    allow_weekends?: boolean
    workday_start_hour?: number
    workday_end_hour?: number
    lunch_start_hour?: number
    lunch_end_hour?: number
  }
): SettingsConflict[] {
  const conflicts: SettingsConflict[] = []
  const combinedText = combineGoalWithClarifications(goalText, clarifications)
  const lowerText = combinedText.toLowerCase()
  
  const availabilityAnalysis = detectAvailabilityPatterns(goalText, clarifications, {
    workday_end_hour: userSettings?.workday_end_hour
  })
  
  // 1. Check for weekend scheduling conflict
  const mentionsWeekends = lowerText.includes('weekend') || lowerText.includes('weekends')
  const prefersWeekends = availabilityAnalysis.daysOfWeek?.includes('weekend') || mentionsWeekends
  
  if (prefersWeekends && userSettings?.allow_weekends === false) {
    conflicts.push({
      type: 'weekend_scheduling',
      description: 'Your goal mentions working on weekends, but weekend scheduling is disabled in your settings.',
      goalPreference: 'Work on weekends',
      userSetting: 'Weekend scheduling disabled',
      settingsTab: 'workday',
      alternativeText: 'Alternatively, adjust your goal to remove weekend references.'
    })
  }
  
  // 2. Check for workday hours mismatch
  const goalWorkdayHours = extractWorkdayHoursFromGoal(combinedText)
  if (goalWorkdayHours && userSettings?.workday_start_hour !== undefined && userSettings?.workday_end_hour !== undefined) {
    const startDiff = Math.abs((goalWorkdayHours.startHour ?? 9) - userSettings.workday_start_hour)
    const endDiff = Math.abs((goalWorkdayHours.endHour ?? 17) - userSettings.workday_end_hour)
    
    // If there's a significant difference (more than 1 hour), flag it
    if (startDiff > 1 || endDiff > 1) {
      const goalHours = `${goalWorkdayHours.startHour ?? 9}:00 - ${goalWorkdayHours.endHour ?? 17}:00`
      const settingHours = `${userSettings.workday_start_hour}:00 - ${userSettings.workday_end_hour}:00`
      
      conflicts.push({
        type: 'workday_hours',
        description: `Your goal mentions working ${goalHours}, but your settings have workday hours set to ${settingHours}.`,
        goalPreference: `Work ${goalHours}`,
        userSetting: `Workday hours: ${settingHours}`,
        settingsTab: 'workday',
        alternativeText: 'Alternatively, adjust your goal to match your current workday hours.'
      })
    }
  }
  
  // 3. Check for evening availability mismatch
  if (availabilityAnalysis.timeOfDay === 'evening' && userSettings?.workday_end_hour !== undefined) {
    const afterTime = extractTimeFromPattern(combinedText, 'after')
    if (afterTime && afterTime > userSettings.workday_end_hour) {
      conflicts.push({
        type: 'evening_availability',
        description: `Your goal mentions working after ${afterTime}:00, but your workday ends at ${userSettings.workday_end_hour}:00 in your settings.`,
        goalPreference: `Work after ${afterTime}:00`,
        userSetting: `Workday ends at ${userSettings.workday_end_hour}:00`,
        settingsTab: 'workday',
        alternativeText: 'Alternatively, adjust your goal to match your current workday hours.'
      })
    } else if (lowerText.includes('after work') && userSettings.workday_end_hour < 17) {
      // Generic "after work" but workday ends early
      conflicts.push({
        type: 'evening_availability',
        description: `Your goal mentions working "after work", but your workday ends at ${userSettings.workday_end_hour}:00. Evening work typically starts after 5:00 PM.`,
        goalPreference: 'Work after work (evenings)',
        userSetting: `Workday ends at ${userSettings.workday_end_hour}:00`,
        settingsTab: 'workday',
        alternativeText: 'Alternatively, clarify your evening availability in your goal.'
      })
    }
  }
  
  // 4. Check for morning availability mismatch
  if (availabilityAnalysis.timeOfDay === 'morning' && userSettings?.workday_start_hour !== undefined) {
    const beforeTime = extractTimeFromPattern(combinedText, 'before')
    if (beforeTime && beforeTime < userSettings.workday_start_hour) {
      conflicts.push({
        type: 'morning_availability',
        description: `Your goal mentions working before ${beforeTime}:00, but your workday starts at ${userSettings.workday_start_hour}:00 in your settings.`,
        goalPreference: `Work before ${beforeTime}:00`,
        userSetting: `Workday starts at ${userSettings.workday_start_hour}:00`,
        settingsTab: 'workday',
        alternativeText: 'Alternatively, adjust your goal to match your current workday hours.'
      })
    }
  }
  
  // 5. Check for hours per day mismatch
  if (availabilityAnalysis.hoursPerDay && userSettings?.workday_start_hour !== undefined && userSettings?.workday_end_hour !== undefined) {
    const workdayDuration = userSettings.workday_end_hour - userSettings.workday_start_hour
    const lunchDuration = userSettings.lunch_start_hour && userSettings.lunch_end_hour
      ? userSettings.lunch_end_hour - userSettings.lunch_start_hour
      : 1
    const availableHours = workdayDuration - lunchDuration
    
    // If user says they have more hours available than their workday allows
    if (availabilityAnalysis.hoursPerDay > availableHours) {
      conflicts.push({
        type: 'hours_per_day',
        description: `Your goal mentions having ${availabilityAnalysis.hoursPerDay} hours available per day, but your workday settings only allow ${availableHours} hours (${userSettings.workday_start_hour}:00 - ${userSettings.workday_end_hour}:00, minus lunch).`,
        goalPreference: `${availabilityAnalysis.hoursPerDay} hours per day`,
        userSetting: `${availableHours} hours available per day`,
        settingsTab: 'workday',
        alternativeText: `Alternatively, adjust your goal to reflect ${availableHours} hours per day availability.`
      })
    }
  }
  
  return conflicts
}

/**
 * Helper function to check if workday end time is mentioned in clarifications
 */
function checkForWorkdayEnd(clarifications?: Record<string, any> | string[]): boolean {
  if (!clarifications) return false
  
  const combinedText = combineGoalWithClarifications('', clarifications)
  const lowerText = combinedText.toLowerCase()
  
  // Check for time patterns like "5pm", "5 pm", "17:00", "ends at 5"
  const timePatterns = [
    /\b(?:workday|work day|work)\s+(?:ends?|finishes?|is over)\s+(?:at|by)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    /\b(?:ends?|finishes?)\s+(?:at|by)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    /\b(\d{1,2}(?::\d{2})?\s*(?:pm))\b/i, // Any PM time
  ]
  
  for (const pattern of timePatterns) {
    if (pattern.test(lowerText)) {
      return true
    }
  }
  
  return false
}

/**
 * Helper function to check if adding a dependency would create a cycle
 * Returns true if adding fromIdx -> toIdx would create a cycle
 * 
 * IMPORTANT: Forward dependencies (lower idx -> higher idx) are generally safe
 * and should be allowed even if they would technically create a cycle.
 * Only prevent cycles where the dependency goes backwards (higher idx -> lower idx).
 */
function wouldCreateCycle(
  dependencies: Map<number, number[]>,
  fromIdx: number,
  toIdx: number,
  tasks: Array<{ name: string; idx: number }>
): boolean {
  // Get task indices for comparison
  const fromTask = tasks.find(t => t.idx === fromIdx)
  const toTask = tasks.find(t => t.idx === toIdx)
  
  // If we're adding a forward dependency (lower idx -> higher idx), it's generally safe
  // This represents the natural flow: earlier tasks depend on later tasks
  // Only prevent if it would create a DIRECT cycle (toIdx -> fromIdx directly)
  // For forward dependencies, be more lenient - only prevent if there's a direct backwards dependency
  if (fromTask && toTask && fromIdx < toIdx) {
    // This is a forward dependency - check if toIdx already depends on fromIdx DIRECTLY
    // Don't check transitive dependencies for forward deps - they're usually safe
    const toDeps = dependencies.get(toIdx) || []
    if (toDeps.includes(fromIdx)) {
      return true // Direct cycle: toIdx -> fromIdx, and we're adding fromIdx -> toIdx
    }
    
    // For forward dependencies, only check for direct cycles
    // Transitive cycles through backwards dependencies should be handled by breaking those backwards deps
    // Forward dependency that doesn't create a direct cycle - allow it
    return false
  }
  
  // For backwards dependencies (higher idx -> lower idx), be more strict
  // Check if adding this would create a cycle
  if (fromTask && toTask && fromIdx > toIdx) {
    // This is a backwards dependency - check if toIdx already depends on fromIdx
    const visited = new Set<number>()
    const stack: number[] = [toIdx]
    
    while (stack.length > 0) {
      const current = stack.pop()!
      if (current === fromIdx) {
        return true // Cycle detected
      }
      if (visited.has(current)) {
        continue
      }
      visited.add(current)
      
      const deps = dependencies.get(current) || []
      for (const dep of deps) {
        stack.push(dep)
      }
    }
  }
  
  // If we can't determine task order, use conservative cycle detection
  const visited = new Set<number>()
  const stack: number[] = [toIdx]
  
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === fromIdx) {
      return true // Cycle detected: toIdx depends on fromIdx (directly or transitively)
    }
    if (visited.has(current)) {
      continue
    }
    visited.add(current)
    
    const deps = dependencies.get(current) || []
    for (const dep of deps) {
      stack.push(dep)
    }
  }
  
  return false
}

/**
 * Helper function to safely add a dependency, checking for cycles first
 * Returns true if dependency was added, false if it would create a cycle
 */
function safeAddDependency(
  dependencies: Map<number, number[]>,
  dependentIdx: number,
  prerequisiteIdx: number,
  dependentName: string,
  prerequisiteName: string,
  tasks: Array<{ name: string; idx: number }>
): boolean {
  // Check if this would create a cycle
  if (wouldCreateCycle(dependencies, prerequisiteIdx, dependentIdx, tasks)) {
    console.log(`🔧 Skipped dependency: "${dependentName}" -> "${prerequisiteName}" (would create cycle)`)
    return false
  }
  
  // Add the dependency
  if (!dependencies.has(dependentIdx)) {
    dependencies.set(dependentIdx, [])
  }
  const deps = dependencies.get(dependentIdx)!
  if (!deps.includes(prerequisiteIdx)) {
    deps.push(prerequisiteIdx)
  }
  return true
}

/**
 * Extract topic keywords from a task name to determine domain/context
 * Covers programming topics, business topics, and general domains
 */
function extractTopicKeywords(taskName: string): string[] {
  const lower = taskName.toLowerCase()
  const topics: string[] = []
  
  // Programming topics
  const programmingKeywords = [
    'variable', 'loop', 'function', 'class', 'object', 'list', 'array',
    'dictionary', 'string', 'number', 'boolean', 'tuple', 'set',
    'file', 'exception', 'error', 'module', 'package', 'decorator',
    'generator', 'async', 'thread', 'calculator'
  ]
  for (const keyword of programmingKeywords) {
    if (lower.includes(keyword)) {
      topics.push('programming')
      break
    }
  }
  
  // E-commerce/Store keywords
  if (lower.includes('store') || lower.includes('shop') || lower.includes('commerce') || lower.includes('ecommerce') || lower.includes('e-commerce')) topics.push('store')
  if (lower.includes('payment') || lower.includes('checkout') || lower.includes('transaction')) topics.push('payment')
  if (lower.includes('product')) topics.push('product')
  if (lower.includes('customer') || lower.includes('user')) topics.push('customer')
  if (lower.includes('inventory') || lower.includes('stock')) topics.push('inventory')
  if (lower.includes('shipping') || lower.includes('delivery')) topics.push('shipping')
  
  // Platform/Technical keywords
  if (lower.includes('platform') || lower.includes('system')) topics.push('platform')
  if (lower.includes('database') || lower.includes('data') || lower.includes('db') || lower.includes('sql')) topics.push('data')
  if (lower.includes('api') || lower.includes('backend') || lower.includes('server') || lower.includes('rest') || lower.includes('graphql')) topics.push('api')
  if (lower.includes('frontend') || lower.includes('ui') || lower.includes('interface')) topics.push('frontend')
  
  // Content/Marketing keywords
  if (lower.includes('content') || lower.includes('description') || lower.includes('copy') || lower.includes('text')) topics.push('content')
  if (lower.includes('marketing') || lower.includes('promotion') || lower.includes('campaign')) topics.push('marketing')
  if (lower.includes('design') || lower.includes('layout') || lower.includes('theme')) topics.push('design')
  if (lower.includes('seo') || lower.includes('analytics')) topics.push('analytics')
  
  // Business/Strategy keywords
  if (lower.includes('business') || lower.includes('plan') || lower.includes('strategy')) topics.push('business')
  if (lower.includes('research') || lower.includes('analysis') || lower.includes('study')) topics.push('research')
  if (lower.includes('target') || lower.includes('audience') || lower.includes('market')) topics.push('audience')
  
  // Development/Technical keywords
  if (lower.includes('code') || lower.includes('program') || lower.includes('develop') || lower.includes('application') || lower.includes('app')) topics.push('code')
  if (lower.includes('test') || lower.includes('testing') || lower.includes('qa') || lower.includes('unit test') || lower.includes('integration test')) topics.push('testing')
  if (lower.includes('deploy') || lower.includes('launch') || lower.includes('release')) topics.push('launch')
  
  // Learning/Education keywords
  if (lower.includes('learn') || lower.includes('study') || lower.includes('understand')) topics.push('learning')
  if (lower.includes('practice') || lower.includes('exercise') || lower.includes('drill')) topics.push('practice')
  if (lower.includes('tutorial') || lower.includes('guide') || lower.includes('documentation')) topics.push('documentation')
  
  return topics
}

/**
 * Check if two tasks share any topic keywords
 * Returns true if they share at least one topic
 */
function shareTopicKeywords(task1Name: string, task2Name: string): boolean {
  const topics1 = extractTopicKeywords(task1Name)
  const topics2 = extractTopicKeywords(task2Name)
  
  if (topics1.length === 0 || topics2.length === 0) {
    // If either task has no identifiable topics, allow dependency (fallback to original behavior)
    return true
  }
  
  // Check if any topics match
  return topics1.some(topic => topics2.includes(topic))
}

/**
 * Calculate dependency confidence score between two tasks
 * Higher score = more likely to be a valid dependency
 */
function calculateDependencyConfidence(prerequisiteName: string, dependentName: string): number {
  const prereqLower = prerequisiteName.toLowerCase()
  const depLower = dependentName.toLowerCase()
  
  let confidence = 0
  
  // Base confidence from topic overlap
  const prereqTopics = extractTopicKeywords(prerequisiteName)
  const depTopics = extractTopicKeywords(dependentName)
  const sharedTopics = prereqTopics.filter(t => depTopics.includes(t))
  confidence += sharedTopics.length * 20 // 20 points per shared topic
  
  // Penalty for obviously unrelated combinations
  // "payment" setup should NOT be prerequisite for "description" writing
  if ((prereqLower.includes('payment') || prereqLower.includes('checkout')) && 
      (depLower.includes('description') || depLower.includes('content') || depLower.includes('copy'))) {
    confidence -= 50
  }
  
  // "store setup" is NOT prerequisite for "product description" writing
  if (prereqLower.includes('store') && prereqLower.includes('set') && 
      depLower.includes('description') && !depLower.includes('store')) {
    confidence -= 30
  }
  
  // Payment setup should NOT block content creation
  if (prereqLower.includes('payment') && 
      (depLower.includes('write') || depLower.includes('create')) &&
      (depLower.includes('content') || depLower.includes('description'))) {
    confidence -= 50
  }
  
  // Boost confidence for clear logical dependencies
  // Setup/install → build/use is logical
  if ((prereqLower.includes('setup') || prereqLower.includes('install')) &&
      (depLower.includes('build') || depLower.includes('use')) &&
      sharedTopics.length > 0) {
    confidence += 30
  }
  
  // Research → create/write is logical
  if (prereqLower.includes('research') && 
      (depLower.includes('create') || depLower.includes('write')) &&
      sharedTopics.length > 0) {
    confidence += 30
  }
  
  return confidence
}

/**
 * Detect task dependencies based on semantic patterns in task names
 * Returns a map of task idx -> array of dependent task idxs
 * (e.g., if task 3 depends on task 2, map will have: 3 -> [2])
 */
export function detectTaskDependencies(
  tasks: Array<{ name: string; idx: number }>
): Map<number, number[]> {
  let dependencies = new Map<number, number[]>()
  const lowerTaskNames = tasks.map(t => ({ ...t, lowerName: t.name.toLowerCase() }))
  
  // Helper to add dependency with cycle checking
  // When adding dependentIdx -> prerequisiteIdx (dependent depends on prerequisite),
  // check if adding that direction would create a cycle
  const addDependency = (dependentIdx: number, prerequisiteIdx: number, dependentName: string, prerequisiteName: string) => {
    // Check if adding dependentIdx -> prerequisiteIdx would create a cycle
    // This is the correct direction: we're adding dependent -> prerequisite
    if (wouldCreateCycle(dependencies, dependentIdx, prerequisiteIdx, tasks)) {
      console.log(`🔧 Skipped dependency: "${dependentName}" -> "${prerequisiteName}" (would create cycle)`)
      return false
    }
    
    if (!dependencies.has(dependentIdx)) {
      dependencies.set(dependentIdx, [])
    }
    const deps = dependencies.get(dependentIdx)!
    if (!deps.includes(prerequisiteIdx)) {
      deps.push(prerequisiteIdx)
    }
    return true
  }

  for (const task of lowerTaskNames) {
    const taskDeps: number[] = []

    // Pattern: "outline" / "structure" must come before "create" / "build" / "write"
    // Make create/build tasks depend on outline/structure tasks
    if (
      task.lowerName.includes('outline') ||
      task.lowerName.includes('structure') ||
      (task.lowerName.includes('plan') && !task.lowerName.includes('execute'))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('create') ||
            otherTask.lowerName.includes('build') ||
            otherTask.lowerName.includes('write') ||
            otherTask.lowerName.includes('develop') ||
            otherTask.lowerName.includes('make'))
        ) {
          // Make otherTask (create/build) depend on task (outline/structure)
          addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
        }
      }
    }

    // Pattern: "research" must come before "prepare" / "create" / "write"
    // Make prepare/create tasks depend on research tasks
    // CRITICAL: Only if tasks share topics
    if (task.lowerName.includes('research')) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('prepare') ||
            otherTask.lowerName.includes('create') ||
            otherTask.lowerName.includes('write') ||
            otherTask.lowerName.includes('develop'))
        ) {
          // Check if tasks share topics - research should be relevant to what's being created
          const confidence = calculateDependencyConfidence(task.name, otherTask.name)
          const sharesTopics = shareTopicKeywords(task.name, otherTask.name)
          
          if (sharesTopics && confidence >= 0) {
            // Make otherTask (prepare/create) depend on task (research)
            if (!dependencies.has(otherTask.idx)) {
              dependencies.set(otherTask.idx, [])
            }
            const otherTaskDeps = dependencies.get(otherTask.idx)!
            if (!otherTaskDeps.includes(task.idx)) {
              otherTaskDeps.push(task.idx)
            }
          } else if (confidence < 0) {
            console.log(`🔧 Skipped illogical dependency: "${otherTask.name}" → "${task.name}" (confidence: ${confidence})`)
          }
        }
      }
    }

    // Pattern: "gather materials" / "collect" must come before "build" / "create"
    // Make build/create tasks depend on gather/collect tasks
    if (
      task.lowerName.includes('gather') ||
      task.lowerName.includes('collect') ||
      (task.lowerName.includes('materials') && !task.lowerName.includes('organize'))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('build') ||
            otherTask.lowerName.includes('create') ||
            otherTask.lowerName.includes('assemble') ||
            otherTask.lowerName.includes('make'))
        ) {
          // Make otherTask (build/create) depend on task (gather/collect)
          if (!dependencies.has(otherTask.idx)) {
            dependencies.set(otherTask.idx, [])
          }
          const otherTaskDeps = dependencies.get(otherTask.idx)!
          if (!otherTaskDeps.includes(task.idx)) {
            otherTaskDeps.push(task.idx)
          }
        }
      }
    }

    // Pattern: "practice" / "rehearse" must come before "final review" / "polish"
    if (task.lowerName.includes('practice') || task.lowerName.includes('rehears')) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('final review') ||
            otherTask.lowerName.includes('final polish') ||
            (otherTask.lowerName.includes('final') && otherTask.lowerName.includes('review')))
        ) {
          if (!taskDeps.includes(otherTask.idx)) {
            taskDeps.push(otherTask.idx)
          }
        }
      }
    }

    // Pattern: "learn" / "study" must come before "practice" / "apply"
    // Make practice/apply tasks depend on learn/study tasks
    // BUT exclude test/testing tasks - learning comes before testing, not after
    // CRITICAL: Practice should depend on learn, NOT on final review
    // CRITICAL: This is a fundamental ordering - learn ALWAYS comes before practice
    // CRITICAL: Only create dependencies when topics match (e.g., "Practice using variables" should only depend on "Learn about variables", not "Learn about loops")
    // Override cycle detection for this specific case if needed
    if (task.lowerName.includes('learn') || task.lowerName.includes('study')) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('practice') ||
            otherTask.lowerName.includes('apply') ||
            otherTask.lowerName.includes('implement'))
          // EXCLUDE test/testing - learning comes before testing, not after
          && !otherTask.lowerName.includes('test')
          // EXCLUDE final review/polish - practice should come BEFORE final review, not depend on it
          && !otherTask.lowerName.includes('final review')
          && !otherTask.lowerName.includes('final polish')
          && !(otherTask.lowerName.includes('final') && (otherTask.lowerName.includes('review') || otherTask.lowerName.includes('polish')))
          // CRITICAL: Only create dependency if topics match
          && shareTopicKeywords(task.name, otherTask.name)
        ) {
          // Make otherTask (practice/apply) depend on task (learn/study)
          // For learn -> practice, always add the dependency even if cycle detection says no
          // This is a fundamental ordering that should never be skipped
          const wouldCycle = wouldCreateCycle(dependencies, task.idx, otherTask.idx, tasks)
          if (wouldCycle) {
            // If there's a cycle, it's likely because practice -> learn was added incorrectly
            // Remove any practice -> learn dependencies first, then add learn -> practice
            if (dependencies.has(otherTask.idx)) {
              const practiceDeps = dependencies.get(otherTask.idx)!
              const learnDepIndex = practiceDeps.indexOf(task.idx)
              if (learnDepIndex !== -1) {
                practiceDeps.splice(learnDepIndex, 1)
                console.log(`🔧 Removed backwards dependency: "${otherTask.name}" no longer depends on "${task.name}" (practice should depend on learn, not the reverse)`)
                if (practiceDeps.length === 0) {
                  dependencies.delete(otherTask.idx)
          }
              }
            }
          }
          // Now add the correct dependency: practice -> learn (only if topics match)
          addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
        }
      }
    }

    // Pattern: "practice" / "rehearse" / "mock interview" must come AFTER "set up" / "setup" / "tech check"
    // BUT NOT after "test" or "testing" - practice comes before testing, not after
    if (
      task.lowerName.includes('practice') ||
      task.lowerName.includes('rehears') ||
      (task.lowerName.includes('mock') && task.lowerName.includes('interview'))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('set up') ||
            otherTask.lowerName.includes('setup') ||
            otherTask.lowerName.includes('tech check') ||
            (otherTask.lowerName.includes('check') && (otherTask.lowerName.includes('tech') || otherTask.lowerName.includes('equipment'))))
          // EXCLUDE test/testing - practice should come BEFORE test, not after
          && !otherTask.lowerName.includes('test')
        ) {
          if (!taskDeps.includes(otherTask.idx)) {
            taskDeps.push(otherTask.idx)
          }
        }
      }
    }

    // Pattern: "prepare" / "organize" must come before "practice" / "run" (for interview/event prep)
    // Only if both tasks share the same context (interview, presentation, event, etc.)
    // Make practice tasks depend on prepare/organize tasks
    if (
      task.lowerName.includes('prepare') ||
      task.lowerName.includes('organize')
    ) {
      // Extract context keywords from this task
      const taskContext: string[] = []
      if (task.lowerName.includes('interview')) taskContext.push('interview')
      if (task.lowerName.includes('presentation')) taskContext.push('presentation')
      if (task.lowerName.includes('event')) taskContext.push('event')
      if (task.lowerName.includes('meeting')) taskContext.push('meeting')
      
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('practice') ||
            otherTask.lowerName.includes('rehears') ||
            (otherTask.lowerName.includes('mock') && otherTask.lowerName.includes('interview')))
        ) {
          // Only create dependency if contexts match (or if no specific context, allow it)
          const otherContext: string[] = []
          if (otherTask.lowerName.includes('interview')) otherContext.push('interview')
          if (otherTask.lowerName.includes('presentation')) otherContext.push('presentation')
          if (otherTask.lowerName.includes('event')) otherContext.push('event')
          if (otherTask.lowerName.includes('meeting')) otherContext.push('meeting')
          
          // Create dependency if contexts match, or if no specific context in either task
          const contextsMatch = (taskContext.length === 0 && otherContext.length === 0) ||
            (taskContext.length > 0 && otherContext.length > 0 && 
              taskContext.some(ctx => otherContext.includes(ctx)))
          
          if (contextsMatch) {
            // Make otherTask (practice) depend on task (prepare/organize)
            if (!dependencies.has(otherTask.idx)) {
              dependencies.set(otherTask.idx, [])
            }
            const otherTaskDeps = dependencies.get(otherTask.idx)!
            if (!otherTaskDeps.includes(task.idx)) {
              otherTaskDeps.push(task.idx)
            }
          }
        }
      }
    }

    // Pattern: "set up" / "setup" / "install" / "configure" must come before "learn" / "practice" / "build" / "write"
    // Make learn/practice/build tasks depend on setup/install tasks
    // CRITICAL: Practice should depend on setup/learn, NOT on final review
    // CRITICAL: Only create dependency if tasks share topics AND have high confidence
    if (
      task.lowerName.includes('set up') ||
      task.lowerName.includes('setup') ||
      task.lowerName.includes('install') ||
      task.lowerName.includes('configure') ||
      (task.lowerName.includes('environment') && (task.lowerName.includes('set') || task.lowerName.includes('up')))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('learn') ||
            otherTask.lowerName.includes('practice') ||
            otherTask.lowerName.includes('build') ||
            otherTask.lowerName.includes('write') ||
            otherTask.lowerName.includes('explore') ||
            otherTask.lowerName.includes('understand'))
        ) {
          // Check if tasks share topics AND dependency makes logical sense
          const confidence = calculateDependencyConfidence(task.name, otherTask.name)
          const sharesTopics = shareTopicKeywords(task.name, otherTask.name)
          
          // Only add dependency if:
          // 1. Tasks share topics, AND
          // 2. Confidence score is positive (not obviously illogical)
          if (sharesTopics && confidence >= 0) {
            // Make otherTask (learn/practice/build/write) depend on task (setup/install)
            addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
          } else if (confidence < 0) {
            console.log(`🔧 Skipped illogical dependency: "${otherTask.name}" → "${task.name}" (confidence: ${confidence})`)
          }
        }
      }
    }

    // Pattern: "understand" / "learn" basic concepts must come before "explore" / "practice" / "write" / "build"
    // Make explore/practice/write/build tasks depend on understand/learn tasks
    // BUT exclude test/testing tasks - learning should not depend on testing
    // CRITICAL: "explore" comes BEFORE "practice" - don't make explore depend on practice
    // CRITICAL: Learn tasks should NEVER depend on practice tasks - this is backwards
    if (
      task.lowerName.includes('understand') ||
      (task.lowerName.includes('learn') && !task.lowerName.includes('practice'))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('explore') ||
            otherTask.lowerName.includes('practice') ||
            otherTask.lowerName.includes('write') ||
            otherTask.lowerName.includes('build') ||
            (otherTask.lowerName.includes('learn') && otherTask.lowerName.includes('practice')))
          // EXCLUDE test/testing - learning comes before testing, not after
          && !otherTask.lowerName.includes('test')
          // EXCLUDE practice from explore dependencies - explore comes before practice
          && !(task.lowerName.includes('practice') && otherTask.lowerName.includes('explore'))
          // CRITICAL: Don't create dependencies where learn tasks depend on practice tasks
          // This pattern should only create practice -> learn, never learn -> practice
          && !(task.lowerName.includes('learn') && otherTask.lowerName.includes('practice') && task.idx > otherTask.idx)
        ) {
          // Make otherTask (explore/practice/write/build) depend on task (understand/learn)
          addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
        }
      }
    }
    
    // Pattern: "explore" / "understand" must come before "practice"
    // Make practice tasks depend on explore/understand tasks (but not the reverse)
    if (
      task.lowerName.includes('explore') ||
      (task.lowerName.includes('understand') && !task.lowerName.includes('practice'))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          otherTask.lowerName.includes('practice') &&
          !otherTask.lowerName.includes('test')
        ) {
          // Make otherTask (practice) depend on task (explore/understand)
          addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
        }
      }
    }

    // Pattern: Sequential learning - "variables" -> "loops" -> "functions"
    // Make loops depend on variables, functions depend on loops
    // CRITICAL: Only apply to learn/understand tasks, NOT practice tasks
    // Practice tasks should depend on learn tasks, not on other practice tasks through this pattern
    if (task.lowerName.includes('variable') && 
        (task.lowerName.includes('learn') || task.lowerName.includes('understand'))) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('loop') ||
            otherTask.lowerName.includes('function'))
          // Only apply to learn/understand tasks, not practice tasks
          && (otherTask.lowerName.includes('learn') || otherTask.lowerName.includes('understand'))
        ) {
          addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
          }
          }
        }
    if (task.lowerName.includes('loop') && 
        (task.lowerName.includes('learn') || task.lowerName.includes('understand'))) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          otherTask.lowerName.includes('function')
          // Only apply to learn/understand tasks, not practice tasks
          && (otherTask.lowerName.includes('learn') || otherTask.lowerName.includes('understand'))
        ) {
          addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
        }
      }
    }

    // Pattern: "write" / "learn" simple programs must come before "build" complex programs
    // Make build tasks depend on write/learn tasks
    if (
      task.lowerName.includes('write') ||
      (task.lowerName.includes('learn') && task.lowerName.includes('program'))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('build') ||
            otherTask.lowerName.includes('create'))
        ) {
          // Make otherTask (build/create) depend on task (write/learn)
          if (!dependencies.has(otherTask.idx)) {
            dependencies.set(otherTask.idx, [])
          }
          const otherTaskDeps = dependencies.get(otherTask.idx)!
          if (!otherTaskDeps.includes(task.idx)) {
            otherTaskDeps.push(task.idx)
          }
        }
      }
    }

    // Pattern: "build" / "create" part 1 must come before part 2
    // Make part 2 depend on part 1
    if (
      task.lowerName.includes('build') ||
      task.lowerName.includes('create')
    ) {
      const part1Match = task.lowerName.match(/part\s*1|part\s*i[^i]/i)
      if (part1Match) {
        for (const otherTask of lowerTaskNames) {
          if (
            otherTask.idx !== task.idx &&
            (otherTask.lowerName.includes('build') ||
              otherTask.lowerName.includes('create'))
          ) {
            const part2Match = otherTask.lowerName.match(/part\s*2|part\s*ii/i)
            if (part2Match) {
              // Make otherTask (part 2) depend on task (part 1)
              if (!dependencies.has(otherTask.idx)) {
                dependencies.set(otherTask.idx, [])
              }
              const otherTaskDeps = dependencies.get(otherTask.idx)!
              if (!otherTaskDeps.includes(task.idx)) {
                otherTaskDeps.push(task.idx)
              }
            }
          }
        }
      }
    }

    // Pattern: "build" / "create" / "code" must come before "test"
    // Make test tasks depend on build/create/code tasks
    // CRITICAL: Test should depend on building/coding, NOT on practice exercises
    if (
      task.lowerName.includes('build') ||
      task.lowerName.includes('create') ||
      (task.lowerName.includes('code') && !task.lowerName.includes('practice'))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('test') ||
            otherTask.lowerName.includes('testing'))
        ) {
          // Make otherTask (test) depend on task (build/create/code)
          if (!dependencies.has(otherTask.idx)) {
            dependencies.set(otherTask.idx, [])
          }
          const otherTaskDeps = dependencies.get(otherTask.idx)!
          if (!otherTaskDeps.includes(task.idx)) {
            otherTaskDeps.push(task.idx)
          }
        }
      }
    }

    // Pattern: "create" / "build" / "update" / "organize" / "revise" must come before "final review" when they reference the same artifact
    // Make final review tasks depend on create/build/update/organize/revise tasks
    // CRITICAL: Only create dependency if both tasks reference the same artifact (e.g., both mention "slides", "code", "resume", "portfolio", etc.)
    if (
      task.lowerName.includes('build') ||
      task.lowerName.includes('create') ||
      task.lowerName.includes('update') ||
      task.lowerName.includes('organize') ||
      task.lowerName.includes('revise')
    ) {
      // Extract artifact keywords from the create/build/update task
      const artifactKeywords: string[] = []
      if (task.lowerName.includes('slide')) artifactKeywords.push('slide')
      if (task.lowerName.includes('note')) artifactKeywords.push('note')
      if (task.lowerName.includes('code')) artifactKeywords.push('code')
      if (task.lowerName.includes('presentation')) artifactKeywords.push('presentation')
      if (task.lowerName.includes('program')) artifactKeywords.push('program')
      if (task.lowerName.includes('application')) artifactKeywords.push('application')
      if (task.lowerName.includes('project')) artifactKeywords.push('project')
      if (task.lowerName.includes('document')) artifactKeywords.push('document')
      if (task.lowerName.includes('report')) artifactKeywords.push('report')
      if (task.lowerName.includes('website')) artifactKeywords.push('website')
      if (task.lowerName.includes('app')) artifactKeywords.push('app')
      if (task.lowerName.includes('resume')) artifactKeywords.push('resume')
      if (task.lowerName.includes('portfolio')) artifactKeywords.push('portfolio')
      
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('final review') ||
            (otherTask.lowerName.includes('final') && otherTask.lowerName.includes('review')))
        ) {
          // Extract artifact keywords from the final review task
          const reviewArtifactKeywords: string[] = []
          if (otherTask.lowerName.includes('slide')) reviewArtifactKeywords.push('slide')
          if (otherTask.lowerName.includes('note')) reviewArtifactKeywords.push('note')
          if (otherTask.lowerName.includes('code')) reviewArtifactKeywords.push('code')
          if (otherTask.lowerName.includes('presentation')) reviewArtifactKeywords.push('presentation')
          if (otherTask.lowerName.includes('program')) reviewArtifactKeywords.push('program')
          if (otherTask.lowerName.includes('application')) reviewArtifactKeywords.push('application')
          if (otherTask.lowerName.includes('project')) reviewArtifactKeywords.push('project')
          if (otherTask.lowerName.includes('document')) reviewArtifactKeywords.push('document')
          if (otherTask.lowerName.includes('report')) reviewArtifactKeywords.push('report')
          if (otherTask.lowerName.includes('website')) reviewArtifactKeywords.push('website')
          if (otherTask.lowerName.includes('app')) reviewArtifactKeywords.push('app')
          if (otherTask.lowerName.includes('resume')) reviewArtifactKeywords.push('resume')
          if (otherTask.lowerName.includes('portfolio')) reviewArtifactKeywords.push('portfolio')
          if (otherTask.lowerName.includes('material')) reviewArtifactKeywords.push('material')
          
          // Only create dependency if both tasks reference the same artifact
          // Special case: "materials" is a catch-all that matches any artifact keyword
          // If no specific artifacts found, create dependency anyway (general review of created work)
          const hasMatchingArtifact = 
            // Case 1: Review mentions "materials" - matches any artifact keyword
            (reviewArtifactKeywords.includes('material') && artifactKeywords.length > 0) ||
            // Case 2: Both have no specific artifacts (general review of general work)
            (artifactKeywords.length === 0 && reviewArtifactKeywords.length === 0) ||
            // Case 3: Both have specific artifacts and at least one matches
            (artifactKeywords.length > 0 && reviewArtifactKeywords.length > 0 &&
              artifactKeywords.some(keyword => reviewArtifactKeywords.includes(keyword)))
          
          if (hasMatchingArtifact) {
            // Make otherTask (final review) depend on task (create/build/update/organize/revise)
            addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
          }
        }
      }
    }
    
    // Pattern: Explicitly prevent test tasks from depending on practice exercises
    // Test tasks should depend on build/code, not on practice
    if (
      task.lowerName.includes('practice') &&
      (task.lowerName.includes('exercise') || task.lowerName.includes('drill') || task.lowerName.includes('challenge'))
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('test') || otherTask.lowerName.includes('testing'))
        ) {
          // Remove any dependency from test to practice exercises
          // Test should NOT depend on practice exercises
          if (dependencies.has(otherTask.idx)) {
            const otherTaskDeps = dependencies.get(otherTask.idx)!
            const depIndex = otherTaskDeps.indexOf(task.idx)
            if (depIndex !== -1) {
              otherTaskDeps.splice(depIndex, 1)
              console.log(`🔧 Removed backwards dependency: "${otherTask.name}" no longer depends on "${task.name}" (test should depend on build/code, not practice)`)
            }
          }
        }
      }
    }

    // Pattern: "test" must come before "final adjustments" / "polish" / "final review"
    // Make final adjustments depend on test tasks
    if (
      task.lowerName.includes('test') ||
      task.lowerName.includes('testing')
    ) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('final adjustment') ||
            otherTask.lowerName.includes('final polish') ||
            (otherTask.lowerName.includes('final') && (otherTask.lowerName.includes('adjust') || otherTask.lowerName.includes('review'))))
        ) {
          // Make otherTask (final adjustments) depend on task (test)
          addDependency(otherTask.idx, task.idx, otherTask.name, task.name)
        }
      }
    }
  }

  // CRITICAL: Clean up backwards dependencies - practice should NOT depend on final review
  // This must happen AFTER all dependencies are added, to catch any backwards dependencies that were created
  for (const task of lowerTaskNames) {
    if (task.lowerName.includes('practice') || task.lowerName.includes('exercise')) {
      // This is a practice task - check if it incorrectly depends on final review
      if (dependencies.has(task.idx)) {
        const taskDeps = dependencies.get(task.idx)!
        const invalidDeps: number[] = []
        
        for (const depIdx of taskDeps) {
          const depTask = lowerTaskNames.find(t => t.idx === depIdx)
          if (depTask && (
            depTask.lowerName.includes('final review') ||
            depTask.lowerName.includes('final polish') ||
            depTask.lowerName.includes('final adjustment') ||
            (depTask.lowerName.includes('final') && (depTask.lowerName.includes('review') || depTask.lowerName.includes('polish')))
          )) {
            // Practice task incorrectly depends on final review - remove this dependency
            invalidDeps.push(depIdx)
            console.log(`🔧 Removed backwards dependency: "${task.name}" no longer depends on "${depTask.name}" (practice should come BEFORE final review, not after)`)
          }
        }
        
        // Remove invalid dependencies
        if (invalidDeps.length > 0) {
          const cleanedDeps = taskDeps.filter(dep => !invalidDeps.includes(dep))
          if (cleanedDeps.length === 0) {
            dependencies.delete(task.idx)
          } else {
            dependencies.set(task.idx, cleanedDeps)
          }
        }
      }
    }
    
    // Also check final review tasks - they should NOT depend on practice
    if (task.lowerName.includes('final') && (task.lowerName.includes('review') || task.lowerName.includes('polish'))) {
      if (dependencies.has(task.idx)) {
        const taskDeps = dependencies.get(task.idx)!
        const invalidDeps: number[] = []
        
        for (const depIdx of taskDeps) {
          const depTask = lowerTaskNames.find(t => t.idx === depIdx)
          if (depTask && (
            depTask.lowerName.includes('practice') ||
            depTask.lowerName.includes('exercise')
          )) {
            // Final review incorrectly depends on practice - remove this dependency
            invalidDeps.push(depIdx)
            console.log(`🔧 Removed backwards dependency: "${task.name}" no longer depends on "${depTask.name}" (final review should depend on test/build, not practice)`)
          }
        }
        
        // Remove invalid dependencies
        if (invalidDeps.length > 0) {
          const cleanedDeps = taskDeps.filter(dep => !invalidDeps.includes(dep))
          if (cleanedDeps.length === 0) {
            dependencies.delete(task.idx)
          } else {
            dependencies.set(task.idx, cleanedDeps)
        }
      }
    }
    }
    
    // CRITICAL: Clean up backwards dependencies - learn tasks should NOT depend on practice tasks
    // Learn should ALWAYS come before practice, never the reverse
    if ((task.lowerName.includes('learn') || task.lowerName.includes('understand') || task.lowerName.includes('study')) &&
        !task.lowerName.includes('practice')) {
      if (dependencies.has(task.idx)) {
        const taskDeps = dependencies.get(task.idx)!
        const invalidDeps: number[] = []
        
        for (const depIdx of taskDeps) {
          const depTask = lowerTaskNames.find(t => t.idx === depIdx)
          if (depTask && (
            depTask.lowerName.includes('practice') ||
            depTask.lowerName.includes('exercise') ||
            depTask.lowerName.includes('apply')
          )) {
            // Learn task incorrectly depends on practice task - remove this dependency
            invalidDeps.push(depIdx)
            console.log(`🔧 Removed backwards dependency: "${task.name}" no longer depends on "${depTask.name}" (learn should come BEFORE practice, not after)`)
          }
        }
        
        // Remove invalid dependencies
        if (invalidDeps.length > 0) {
          const cleanedDeps = taskDeps.filter(dep => !invalidDeps.includes(dep))
          if (cleanedDeps.length === 0) {
            dependencies.delete(task.idx)
          } else {
            dependencies.set(task.idx, cleanedDeps)
          }
        }
      }
    }
  }

  // Log detected dependencies with detailed statistics
  if (dependencies.size > 0) {
    console.log('🔗 Detected task dependencies:')
    let semanticDepsCount = 0
    let totalDepsCount = 0
    
    dependencies.forEach((deps, taskIdx) => {
      const task = tasks.find(t => t.idx === taskIdx)
      const depTasks = deps.map(idx => tasks.find(t => t.idx === idx)?.name || `task ${idx}`)
      console.log(`  Task ${taskIdx} (${task?.name || 'unknown'}): depends on [${depTasks.join(', ')}]`)
      
      semanticDepsCount++
      totalDepsCount += deps.length
    })
    
    console.log(`📊 Dependency Statistics: ${semanticDepsCount} task(s) have dependencies, ${totalDepsCount} total dependency edge(s)`)
  } else {
    console.log('🔗 No task dependencies detected')
  }

  // Detect circular dependencies
  const cycles = detectCircularDependencies(dependencies)
  if (cycles.length > 0) {
    console.warn('⚠️  Circular dependencies detected:', cycles.map(cycle => cycle.join(' -> ')).join(', '))
    // Resolve circular dependencies
    dependencies = resolveCircularDependencies(dependencies, cycles, tasks)
    console.log('✅ Circular dependencies resolved')
    
    // Validate that cycles are actually resolved
    const remainingCycles = detectCircularDependencies(dependencies)
    if (remainingCycles.length > 0) {
      console.error('❌ Failed to resolve all circular dependencies:', remainingCycles.map(cycle => cycle.join(' -> ')).join(', '))
    }
  }

  // Pre-scheduling validation: Ensure dependencies are acyclic
  const finalCycles = detectCircularDependencies(dependencies)
  if (finalCycles.length > 0) {
    console.error('❌ Pre-scheduling validation failed: Dependencies still contain cycles after resolution')
    throw new Error(`Cannot schedule tasks with circular dependencies: ${finalCycles.map(cycle => cycle.join(' -> ')).join(', ')}`)
  }

  return dependencies
}

function detectCircularDependencies(dependencies: Map<number, number[]>): Array<number[]> {
  const cycles: Array<number[]> = []
  const visited = new Set<number>()
  const recursionStack = new Set<number>()
  
  const dfs = (taskIdx: number, path: number[]): void => {
    if (recursionStack.has(taskIdx)) {
      // Found a cycle
      const cycleStart = path.indexOf(taskIdx)
      cycles.push(path.slice(cycleStart))
      return
    }
    
    if (visited.has(taskIdx)) return
    
    visited.add(taskIdx)
    recursionStack.add(taskIdx)
    
    const deps = dependencies.get(taskIdx) || []
    for (const depIdx of deps) {
      dfs(depIdx, [...path, taskIdx])
    }
    
    recursionStack.delete(taskIdx)
  }
  
  for (const taskIdx of dependencies.keys()) {
    if (!visited.has(taskIdx)) {
      dfs(taskIdx, [])
    }
  }
  
  return cycles
}

/**
 * Resolve circular dependencies by breaking cycles while preserving logical order
 * Uses task type hierarchy: setup → learn → practice → build → test → final
 */
function resolveCircularDependencies(
  dependencies: Map<number, number[]>,
  cycles: Array<number[]>,
  tasks: Array<{ name: string; idx: number }>
): Map<number, number[]> {
  const taskTypePriority = (taskName: string): number => {
    const lower = taskName.toLowerCase()
    // Higher number = later in sequence
    if (lower.includes('set up') || lower.includes('setup') || lower.includes('install') || lower.includes('configure') || lower.includes('environment')) return 1
    if (lower.includes('learn') || lower.includes('understand') || lower.includes('study') || lower.includes('research')) return 2
    if (lower.includes('practice') || lower.includes('rehears') || lower.includes('exercise')) return 3
    if (lower.includes('build') || lower.includes('create') || lower.includes('write') || lower.includes('develop') || lower.includes('implement')) return 4
    if (lower.includes('test') || lower.includes('testing')) return 5
    if (lower.includes('final') || lower.includes('review') || lower.includes('polish') || lower.includes('debug')) return 6
    return 0 // Unknown type
  }

  const resolvedDeps = new Map<number, number[]>()
  // Copy all dependencies
  dependencies.forEach((deps, taskIdx) => {
    resolvedDeps.set(taskIdx, [...deps])
  })

  // For each cycle, break it by removing the weakest dependency
  for (const cycle of cycles) {
    if (cycle.length < 2) continue
    
    // Find the dependency in the cycle that should be removed
    // Use multiple factors: task type hierarchy AND topic similarity
    let weakestDep: { from: number; to: number } | null = null
    let weakestScore = Infinity
    
    for (let i = 0; i < cycle.length; i++) {
      const fromIdx = cycle[i]
      const toIdx = cycle[(i + 1) % cycle.length]
      const fromTask = tasks.find(t => t.idx === fromIdx)
      const toTask = tasks.find(t => t.idx === toIdx)
      
      if (!fromTask || !toTask) continue
      
      const fromType = taskTypePriority(fromTask.name)
      const toType = taskTypePriority(toTask.name)
      
      // Score: lower is weaker (should be removed)
      // If fromType > toType, it's a backwards dependency (e.g., test depends on practice)
      // If fromType < toType, it's a forward dependency (e.g., practice depends on learn)
      let score = fromType - toType
      
      // CRITICAL: Prioritize keeping learn -> practice dependencies
      // If this is a learn -> practice dependency (fromType=2, toType=3), make it very strong (high score)
      // If this is a practice -> learn dependency (fromType=3, toType=2), make it very weak (low score)
      if (fromType === 2 && toType === 3) {
        // Learn -> practice: this is correct, don't remove it
        score = 1000 // Very high score = keep this dependency
      } else if (fromType === 3 && toType === 2) {
        // Practice -> learn: this is backwards, remove it
        score = -1000 // Very low score = remove this dependency
      }
      
      // Factor in topic similarity: dependencies between unrelated topics are weaker
      const topicConfidence = calculateDependencyConfidence(toTask.name, fromTask.name)
      if (topicConfidence < 0) {
        // Negative confidence = illogical dependency, make it very weak
        score -= 500 // Strong penalty for illogical dependencies
      } else {
        // Positive confidence = logical dependency, boost the score slightly
        score += topicConfidence / 10
      }
      
      if (score < weakestScore) {
        weakestScore = score
        weakestDep = { from: fromIdx, to: toIdx }
      }
    }
    
    // Remove the weakest dependency
    if (weakestDep) {
      const deps = resolvedDeps.get(weakestDep.from) || []
      const filtered = deps.filter(depIdx => depIdx !== weakestDep!.to)
      resolvedDeps.set(weakestDep.from, filtered)
      
      const fromTask = tasks.find(t => t.idx === weakestDep!.from)
      const toTask = tasks.find(t => t.idx === weakestDep!.to)
      const topicConfidence = calculateDependencyConfidence(toTask?.name || '', fromTask?.name || '')
      const sharesTopics = shareTopicKeywords(fromTask?.name || '', toTask?.name || '')
      
      console.log(`  🔧 Breaking cycle: Removing dependency from "${fromTask?.name || weakestDep.from}" to "${toTask?.name || weakestDep.to}" (score: ${weakestScore.toFixed(1)}, confidence: ${topicConfidence.toFixed(1)}, shares topics: ${sharesTopics})`)
    }
  }
  
  return resolvedDeps
}

