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

export interface UrgencyAnalysis {
  urgencyLevel: 'high' | 'medium' | 'low' | 'none'
  indicators: string[]
  requiresToday: boolean
  requiresSpecificTime: boolean
  deadlinePhrase?: string
  deadlineDate?: Date
  deadlineType?: 'tomorrow' | 'specific_date' | 'none'
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

  return {
    urgencyLevel,
    indicators: [...new Set(indicators)], // Remove duplicates
    requiresToday,
    requiresSpecificTime,
    deadlinePhrase,
    deadlineDate: deadlineInfo.deadlineDate,
    deadlineType: deadlineInfo.deadlineType,
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
 * Detect task dependencies based on semantic patterns in task names
 * Returns a map of task idx -> array of dependent task idxs
 * (e.g., if task 3 depends on task 2, map will have: 3 -> [2])
 */
export function detectTaskDependencies(
  tasks: Array<{ name: string; idx: number }>
): Map<number, number[]> {
  const dependencies = new Map<number, number[]>()
  const lowerTaskNames = tasks.map(t => ({ ...t, lowerName: t.name.toLowerCase() }))

  for (const task of lowerTaskNames) {
    const taskDeps: number[] = []

    // Pattern: "outline" / "structure" must come before "create" / "build" / "write"
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
          if (!taskDeps.includes(otherTask.idx)) {
            taskDeps.push(otherTask.idx)
          }
        }
      }
    }

    // Pattern: "research" must come before "prepare" / "create" / "write"
    if (task.lowerName.includes('research')) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('prepare') ||
            otherTask.lowerName.includes('create') ||
            otherTask.lowerName.includes('write') ||
            otherTask.lowerName.includes('develop'))
        ) {
          if (!taskDeps.includes(otherTask.idx)) {
            taskDeps.push(otherTask.idx)
          }
        }
      }
    }

    // Pattern: "gather materials" / "collect" must come before "build" / "create"
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
          if (!taskDeps.includes(otherTask.idx)) {
            taskDeps.push(otherTask.idx)
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
    if (task.lowerName.includes('learn') || task.lowerName.includes('study')) {
      for (const otherTask of lowerTaskNames) {
        if (
          otherTask.idx !== task.idx &&
          (otherTask.lowerName.includes('practice') ||
            otherTask.lowerName.includes('apply') ||
            otherTask.lowerName.includes('implement'))
        ) {
          if (!taskDeps.includes(otherTask.idx)) {
            taskDeps.push(otherTask.idx)
          }
        }
      }
    }

    if (taskDeps.length > 0) {
      dependencies.set(task.idx, taskDeps)
    }
  }

  return dependencies
}

