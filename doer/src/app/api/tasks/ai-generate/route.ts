import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/ai'
import { formatDateForDB } from '@/lib/date-utils'
import { authenticateApiRequest, ApiTokenError } from '@/lib/auth/api-token-auth'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'
import { isTaskInPast, getCurrentDateTime, calculateDuration } from '@/lib/task-time-utils'

// Force dynamic rendering since we use cookies for authentication (session auth fallback)
export const dynamic = 'force-dynamic'

// Utilities to resolve natural language weekdays/times in a consistent timezone
const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'America/Los_Angeles'

function getNowInTimeZone(tz: string): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>
  // Construct a local-time string and let Date treat it as local
  return new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:00`)
}

function resolveWeekdayDate(
  text: string,
  baseDate: Date,
  tz: string
): { date?: string; weekdayDetected?: string } {
  const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const lower = text.toLowerCase()
  const match = weekdays
    .map((w, idx) => ({ w, idx, m: lower.match(new RegExp(`(?:next|this)?\s*${w}`)) }))
    .find((r) => r.m)

  if (!match) return {}

  // Determine qualifier: next vs this (default to next if word 'next' present, else this->current week if still ahead, otherwise next week)
  const hasNext = new RegExp(`next\s*${match.w}`).test(lower)
  const hasThis = new RegExp(`this\s*${match.w}`).test(lower)

  // Compute day difference using timezone-aware base date
  const base = getNowInTimeZone(tz)
  base.setFullYear(baseDate.getFullYear())
  base.setMonth(baseDate.getMonth())
  base.setDate(baseDate.getDate())
  const baseDow = base.getDay()
  let diff = (match.idx - baseDow + 7) % 7
  if (hasNext || (!hasThis && diff === 0)) {
    diff = diff === 0 ? 7 : diff // ensure future if 'next' or same-day without 'this'
  }

  const target = new Date(base)
  target.setDate(base.getDate() + diff)
  return { date: formatDateForDB(target), weekdayDetected: match.w }
}

function resolveExplicitTime(text: string): { startTime?: string; endTime?: string } | undefined {
  const lower = text.toLowerCase()
  
  // Try to match time ranges like "7-10pm", "7pm-10pm", "7:00-10:00pm", "7-10 pm"
  // Pattern 1: Both times with AM/PM: "7pm-10pm"
  let rangeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  if (rangeMatch) {
    let startHour = parseInt(rangeMatch[1], 10)
    const startMinute = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0
    const startAmPm = rangeMatch[3]
    let endHour = parseInt(rangeMatch[4], 10)
    const endMinute = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0
    const endAmPm = rangeMatch[6]
    
    if (startAmPm === 'pm' && startHour < 12) startHour += 12
    if (startAmPm === 'am' && startHour === 12) startHour = 0
    if (endAmPm === 'pm' && endHour < 12) endHour += 12
    if (endAmPm === 'am' && endHour === 12) endHour = 0
    
    return {
      startTime: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
      endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
    }
  }
  
  // Pattern 2: Range with AM/PM at the end: "7-10pm", "7:00-10:00pm"
  rangeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  if (rangeMatch) {
    let startHour = parseInt(rangeMatch[1], 10)
    const startMinute = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0
    let endHour = parseInt(rangeMatch[3], 10)
    const endMinute = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0
    const ampm = rangeMatch[5]
    
    // Convert both times based on AM/PM (applies to both)
    if (ampm === 'pm') {
      if (startHour < 12) startHour += 12
      if (endHour < 12) endHour += 12
    } else {
      if (startHour === 12) startHour = 0
      if (endHour === 12) endHour = 0
    }
    
    return {
      startTime: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
      endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
    }
  }
  
  // Fall back to single time match
  const m = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/)
  if (!m) return undefined
  let hour = parseInt(m[1], 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  return { startTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` }
}

function formatTimeForDisplay(time24: string, timeFormat: '12h' | '24h'): string {
  const [hour, minute] = time24.split(':').map(Number)
  
  if (timeFormat === '24h') {
    return time24
  }
  
  // Convert to 12-hour format
  let hour12 = hour
  let period = 'AM'
  
  if (hour === 0) {
    hour12 = 12
    period = 'AM'
  } else if (hour < 12) {
    hour12 = hour
    period = 'AM'
  } else if (hour === 12) {
    hour12 = 12
    period = 'PM'
  } else {
    hour12 = hour - 12
    period = 'PM'
  }
  
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`
}

function resolveRelativeDate(text: string, baseDate: Date, tz: string): { date?: string; relativeDetected?: string } {
  const lower = text.toLowerCase()
  
  // Check for "tomorrow"
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(baseDate)
    tomorrow.setDate(baseDate.getDate() + 1)
    return { date: formatDateForDB(tomorrow), relativeDetected: 'tomorrow' }
  }
  
  // Check for "today"
  if (lower.includes('today')) {
    return { date: formatDateForDB(baseDate), relativeDetected: 'today' }
  }
  
  // Check for "next week"
  if (lower.includes('next week')) {
    const nextWeek = new Date(baseDate)
    nextWeek.setDate(baseDate.getDate() + 7)
    return { date: formatDateForDB(nextWeek), relativeDetected: 'next week' }
  }
  
  return {}
}

async function handleRecurringTaskFollowUp(
  followUpResponse: string,
  followUpData: any,
  scheduleInfo: any[],
  workdayStartHour: number,
  workdayEndHour: number,
  today: Date,
  timeFormat: '12h' | '24h' = '12h',
  priorityContext?: any
) {
  // Extract duration - prioritize parsed times from original description
  let durationMinutes = null
  let startTime = null
  let endTime = null
  
  // Use parsed times from original description if available
  if (followUpData.parsedStartTime && followUpData.parsedEndTime) {
    startTime = followUpData.parsedStartTime
    endTime = followUpData.parsedEndTime
    durationMinutes = calculateDuration(startTime, endTime)
  } else if (followUpData.inferredDuration) {
    // Use inferred duration if available
    durationMinutes = followUpData.inferredDuration
  } else if (followUpResponse) {
    // Try to parse duration from response
    const durationMatch = followUpResponse.match(/(\d+)\s*(?:minute|min|hour|hr|h)/i)
    if (durationMatch) {
      const value = parseInt(durationMatch[1])
      if (followUpResponse.toLowerCase().includes('hour') || followUpResponse.toLowerCase().includes('hr') || followUpResponse.toLowerCase().includes('h')) {
        durationMinutes = value * 60
      } else {
        durationMinutes = value
      }
    }
  }
  
  // Default duration if still not found
  if (!durationMinutes) {
    durationMinutes = 30 // Default fallback
  }
  
  // Parse indefinite vs end date
  const isIndefinite = followUpResponse.toLowerCase().includes('indefinite')
  let endDate: string | null = null
  if (!isIndefinite) {
    // Try to extract date from response
    const dateMatch = followUpResponse.match(/until\s+(\d{4}-\d{2}-\d{2})/i) || 
                      followUpResponse.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      endDate = dateMatch[1]
    }
  }

  const prompt = `You are processing a follow-up response for a recurring task. Generate the recurring task based on the user's clarification.

ORIGINAL TASK: ${followUpData.taskName}
DETECTED PATTERN: ${followUpData.detectedPattern}
USER'S FOLLOW-UP RESPONSE: "${followUpResponse}"
${startTime ? `PARSED TIME RANGE FROM ORIGINAL DESCRIPTION: ${startTime} to ${endTime}` : ''}
DURATION (inferred/parsed): ${durationMinutes} minutes
IS INDEFINITE: ${isIndefinite}
END DATE: ${endDate || 'null'}

USER'S CURRENT SCHEDULE (next 2 weeks):
${scheduleInfo.length > 0 ? scheduleInfo.map(s => `- ${s.date} ${s.time}: ${s.task}${s.priority ? ` (Priority ${s.priority}: ${s.priority === 1 ? 'Critical' : s.priority === 2 ? 'High' : s.priority === 3 ? 'Medium' : 'Low'})` : ' (No priority set)'}`).join('\n') : 'No existing tasks scheduled'}

${priorityContext ? `USER'S PRIORITY DISTRIBUTION ANALYSIS:
- Total tasks with priorities: ${priorityContext.total}
- Distribution: Critical(1)=${priorityContext.distribution[1]}, High(2)=${priorityContext.distribution[2]}, Medium(3)=${priorityContext.distribution[3]}, Low(4)=${priorityContext.distribution[4]}
- Tasks scheduled this week: ${priorityContext.thisWeek}
- This week's priority levels: ${priorityContext.thisWeekPriorities.length > 0 ? priorityContext.thisWeekPriorities.join(', ') : 'none'}
- Use this distribution to determine appropriate priority for the new task and avoid clustering high-priority tasks` : ''}

WORKDAY PREFERENCES:
- Work hours: ${workdayStartHour}:00 - ${workdayEndHour}:00
- Current date: ${formatDateForDB(today)}
- User time format: ${timeFormat === '24h' ? '24-hour (HH:MM)' : '12-hour (h:MM AM/PM)'}

FOLLOW-UP PROCESSING RULES:
1. Extract duration:
   - If followUpData.inferredDuration exists, use that (AI already inferred it for quick tasks)
   - If followUpData.needsDuration is false, use followUpData.inferredDuration
   - Otherwise, parse from followUpResponse if mentioned
   - If still not found, estimate based on task type:
     * Simple/quick tasks: 5-10 minutes
     * Medium tasks: 30-60 minutes
     * Complex tasks: 60-180 minutes

2. Parse time range from followUpResponse:
   - Look for "indefinite" → set isIndefinite = true
   - Look for "until [date]" or date patterns → extract end date
   - If neither found, default to indefinite

3. Use inferred duration when available (for quick tasks like "take out trash")

4. Generate recurring task schedule for the next 12 weeks
   - ABSOLUTE REQUIREMENT: NEVER generate tasks for dates in the past
   - Start generating from the current date (${formatDateForDB(today)}) forward only
   - If a recurring pattern would fall on a past date, skip it and start from the next occurrence

5. Find optimal time slots that don't conflict with existing tasks
   - NEVER suggest times in the past, even if they fit the recurring pattern

6. For PRIORITY DETERMINATION:
   - Analyze the recurring task's urgency and complexity
   - Consider the user's existing priority distribution to avoid clustering
   - Assign priority 1-4 based on task importance
   - Default to Priority 3 (Medium) if unsure

RETURN JSON FORMAT:
{
  "name": "Task name",
  "details": "Task description. If the user provided a URL in their description, include it here.${timeFormat === '24h' ? ' If mentioning times, use 24-hour format (e.g., "19:00 to 22:00").' : ' If mentioning times, use 12-hour format with AM/PM (e.g., "7:00 PM to 10:00 PM").'}",
  "duration_minutes": 30,
  "isRecurring": true,
  "isIndefinite": true/false,
  "recurrenceDays": [1, 3, 5], // 0=Sunday, 1=Monday, etc.
  "recurrenceStartDate": "2024-01-15",
  "recurrenceEndDate": "2024-04-15" or null if indefinite,
  "suggestedTime": "09:00",
  "priority": 3,
  "reasoning": "Why this schedule was chosen.${timeFormat === '24h' ? ' If mentioning times, use 24-hour format (e.g., "19:00 to 22:00").' : ' If mentioning times, use 12-hour format with AM/PM (e.g., "7:00 PM to 10:00 PM").'}",
  "priority_reasoning": "Why this priority (1-4) was assigned based on urgency, complexity, and schedule balance."
}

CRITICAL VALIDATION:
✓ Parse follow-up response correctly
✓ Generate realistic duration if not specified
✓ Set appropriate recurrence days based on pattern
✓ Choose optimal time slots
✓ Handle indefinite vs date range properly`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are an expert at processing recurring task follow-up responses. Return only valid JSON. CRITICAL: When writing details or reasoning text that mentions times, use the user's preferred time format: ${timeFormat === '24h' ? '24-hour format (e.g., 19:00-22:00)' : '12-hour format with AM/PM (e.g., 7:00 PM-10:00 PM)'}.` 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    })

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}')
    
    // Use parsed times from original description if available, otherwise use AI response
    let finalStartTime: string
    let finalEndTime: string
    const finalDuration = durationMinutes || aiResponse.duration_minutes || 30
    
    if (startTime && endTime) {
      // Use parsed times from original description
      finalStartTime = startTime
      finalEndTime = endTime
    } else {
      // Calculate from AI's suggested time and duration
      finalStartTime = aiResponse.suggestedTime || '09:00'
      const [startHour, startMinute] = finalStartTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMinute
      const endMinutes = startMinutes + finalDuration
      const endHour = Math.floor(endMinutes / 60) % 24
      const endMinute = endMinutes % 60
      finalEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
    }

    // Validate and default priority for recurring tasks
    let priority = aiResponse.priority
    if (!priority || priority < 1 || priority > 4) {
      priority = 3 // Default to Medium if invalid
      console.warn('Recurring task: AI returned invalid priority, defaulting to 3')
    }

    return NextResponse.json({
      success: true,
      isRecurring: true,
      task: {
        name: aiResponse.name,
        details: aiResponse.details || '',
        duration_minutes: finalDuration,
        priority: priority,
        suggested_time: finalStartTime,
        suggested_end_time: finalEndTime,
        isRecurring: true,
        isIndefinite: isIndefinite || aiResponse.isIndefinite || false,
        recurrenceDays: aiResponse.recurrenceDays,
        recurrenceStartDate: aiResponse.recurrenceStartDate,
        recurrenceEndDate: endDate || aiResponse.recurrenceEndDate || null,
        reasoning: aiResponse.reasoning || 'AI-generated recurring task schedule',
        priority_reasoning: aiResponse.priority_reasoning || `Assigned priority ${priority} based on task analysis`
      }
    })

  } catch (error) {
    console.error('Error processing recurring task follow-up:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process recurring task follow-up', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let reserved = false
  let authContext: Awaited<ReturnType<typeof authenticateApiRequest>> | null = null
  const TASK_GENERATION_CREDIT_COST = 1 // 1 OpenAI call per task generation (2 if recurring follow-up)

  try {
    // Authenticate user via API token or session
    try {
      authContext = await authenticateApiRequest(request.headers, {
        requiredScopes: [], // No specific scope required for task generation
      })
      // Reserve credits for OpenAI call
      await authContext.creditService.reserve('api_credits', TASK_GENERATION_CREDIT_COST, {
        route: 'tasks.ai-generate',
      })
      reserved = true
    } catch (authError) {
      // If API token auth fails, try session auth (for web UI)
      const supabase = await createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      // For session auth, create a CreditService instance
      const { CreditService } = await import('@/lib/usage/credit-service')
      const creditService = new CreditService(user.id, undefined)
      await creditService.getSubscription()
      authContext = {
        tokenId: '', // Empty string for session auth
        userId: user.id,
        scopes: [], // No scopes for session auth
        expiresAt: null,
        creditService,
      }
      // Reserve credits for OpenAI call
      await creditService.reserve('api_credits', TASK_GENERATION_CREDIT_COST, {
        route: 'tasks.ai-generate',
      })
      reserved = true
    }

    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TASK_GENERATION_CREDIT_COST, {
          route: 'tasks.ai-generate',
          reason: 'user_not_authenticated',
        })
        reserved = false
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { description, constrainedDate, constrainedTime, followUpData, timeFormat = '12h' } = body

    if (!description || !description.trim()) {
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TASK_GENERATION_CREDIT_COST, {
          route: 'tasks.ai-generate',
          reason: 'validation_error',
        })
        reserved = false
      }
      return NextResponse.json({ error: 'Task description is required' }, { status: 400 })
    }

    // Get user's current schedule for the next 2 weeks
    // Use timezone-aware 'today' to avoid UTC drift
    const today = getNowInTimeZone(DEFAULT_TZ)
    const twoWeeksFromNow = new Date(today)
    twoWeeksFromNow.setDate(today.getDate() + 14)
    
    const { data: existingTasks, error: tasksError } = await supabase
      .from('task_schedule')
      .select(`
        date,
        start_time,
        end_time,
        tasks!inner(name, priority)
      `)
      .eq('user_id', user.id)
      .gte('date', formatDateForDB(today))
      .lte('date', formatDateForDB(twoWeeksFromNow))
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (tasksError) {
      console.error('Error fetching user tasks:', tasksError)
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TASK_GENERATION_CREDIT_COST, {
          route: 'tasks.ai-generate',
          reason: 'schedule_fetch_error',
        })
        reserved = false
      }
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
    }

    // Format existing schedule for AI
    const scheduleInfo = existingTasks?.map(task => ({
      date: task.date,
      time: `${task.start_time}-${task.end_time}`,
      task: (task.tasks as any)?.name || 'Unknown task',
      priority: (task.tasks as any)?.priority || null
    })) || []

    // Fetch all user's tasks (including past and future beyond 2 weeks) for priority analysis
    const { data: allTasks, error: allTasksError } = await supabase
      .from('tasks')
      .select('priority, estimated_duration_minutes')
      .eq('user_id', user.id)
      .not('priority', 'is', null)

    if (allTasksError) {
      console.warn('Error fetching all tasks for priority analysis:', allTasksError)
    }

    // Calculate priority distribution
    const priorityDistribution = {
      1: 0, // Critical
      2: 0, // High
      3: 0, // Medium
      4: 0  // Low
    }

    allTasks?.forEach(task => {
      if (task.priority >= 1 && task.priority <= 4) {
        priorityDistribution[task.priority as keyof typeof priorityDistribution]++
      }
    })

    const totalTasksWithPriority = allTasks?.length || 0
    const priorityContext = {
      distribution: priorityDistribution,
      total: totalTasksWithPriority,
      thisWeek: scheduleInfo.filter(s => s.priority).length,
      thisWeekPriorities: scheduleInfo.filter(s => s.priority).map(s => s.priority)
    }

    // Get user's workday preferences
    const { data: settings } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    const preferences = settings?.preferences || {}
    const workdaySettings = preferences.workday || {}
    const workdayStartHour = workdaySettings.workday_start_hour || 9
    const workdayEndHour = workdaySettings.workday_end_hour || 17
    const userTimeFormat = timeFormat || preferences.time_format || '12h'

    // Check if this is a follow-up response for recurring task
    if (followUpData) {
      try {
        const result = await handleRecurringTaskFollowUp(description, followUpData, scheduleInfo, workdayStartHour, workdayEndHour, today, userTimeFormat, priorityContext)
        // Commit credit after successful OpenAI call in handleRecurringTaskFollowUp
        if (reserved && authContext) {
          await authContext.creditService.commit('api_credits', TASK_GENERATION_CREDIT_COST, {
            route: 'tasks.ai-generate',
            model: 'gpt-4o-mini',
            type: 'recurring_followup',
          })
          reserved = false
        }
        return result
      } catch (error) {
        // Release credit on error
        if (reserved && authContext) {
          await authContext.creditService.release('api_credits', TASK_GENERATION_CREDIT_COST, {
            route: 'tasks.ai-generate',
            reason: 'recurring_followup_error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }).catch((releaseError) => {
            console.error('Failed to release credit:', releaseError)
          })
          reserved = false
        }
        throw error
      }
    }

    // Create AI prompt for initial task analysis
    const prompt = `You are an AI task scheduler. Analyze the user's task description to determine if it's a recurring task and generate appropriate response.

USER'S TASK DESCRIPTION: "${description.trim()}"

${constrainedDate ? `CRITICAL CONSTRAINT: User explicitly selected a time slot on ${constrainedDate}${constrainedTime ? ` at ${constrainedTime}` : ''}. You MUST use ${constrainedDate} as the suggested_date. DO NOT suggest any other date unless the user's description explicitly mentions a specific different date (like "January 15th" or "next Tuesday"). Relative terms like "tomorrow" or "next week" should be IGNORED when a time slot is selected.` : 'FLEXIBLE SCHEDULING: Find the next best available time slot'}

USER'S CURRENT SCHEDULE (next 2 weeks):
${scheduleInfo.length > 0 ? scheduleInfo.map(s => `- ${s.date} ${s.time}: ${s.task}${s.priority ? ` (Priority ${s.priority}: ${s.priority === 1 ? 'Critical' : s.priority === 2 ? 'High' : s.priority === 3 ? 'Medium' : 'Low'})` : ' (No priority set)'}`).join('\n') : 'No existing tasks scheduled'}

${priorityContext ? `USER'S PRIORITY DISTRIBUTION ANALYSIS:
- Total tasks with priorities: ${priorityContext.total}
- Distribution: Critical(1)=${priorityContext.distribution[1]}, High(2)=${priorityContext.distribution[2]}, Medium(3)=${priorityContext.distribution[3]}, Low(4)=${priorityContext.distribution[4]}
- Tasks scheduled this week: ${priorityContext.thisWeek}
- This week's priority levels: ${priorityContext.thisWeekPriorities.length > 0 ? priorityContext.thisWeekPriorities.join(', ') : 'none'}
- Use this distribution to determine appropriate priority for the new task and avoid clustering high-priority tasks` : ''}

WORKDAY PREFERENCES:
- Work hours: ${workdayStartHour}:00 - ${workdayEndHour}:00
- Current date: ${formatDateForDB(today)}
- User time format: ${userTimeFormat === '24h' ? '24-hour (HH:MM)' : '12-hour (h:MM AM/PM)'}

RECURRING TASK DETECTION:
CRITICAL: Only detect recurring tasks when EXPLICIT recurring keywords are present. Simply mentioning a day of the week (e.g., "Friday", "Monday") does NOT mean recurring - it could just be scheduling a one-time task on that day.

Look for these STRONG recurring patterns ONLY:
- "every [day]" (e.g., "every Monday", "every Tuesday") - REQUIRES the word "every"
- "daily", "weekly", "monthly" - explicit frequency words
- "recurring", "repeat", "repeating" - explicit recurring keywords
- "[day]s" with plural (e.g., "Mondays", "Fridays") - note the plural form
- "schedule [task] every [day]" - explicit "every" keyword

DO NOT detect recurring for:
- Single day mentions: "Friday", "Monday", "next Tuesday" (one-time scheduling)
- "[task] on Friday" (one-time task on that day)
- "[task] tomorrow" (one-time task)
- "[task] next week" (one-time task)

If you detect a STRONG recurring pattern, return a follow-up question instead of generating the task.

TASK DURATION INFERENCE:
Before asking about duration, analyze the task type and infer a reasonable duration:

QUICK TASKS (5-10 minutes) - DO NOT ask about duration, infer automatically:
- "take out trash", "take out the trash" → 5 minutes
- "water plants", "feed pets", "check mail" → 5-10 minutes
- "make bed", "brush teeth", "quick shower" → 5-10 minutes
- "put dishes away", "empty dishwasher" → 5-10 minutes
- "check email", "quick call" → 5-10 minutes
- Any task with words like "quick", "brief", "simple", "just" → 5-10 minutes

MEDIUM TASKS (15-60 minutes) - May need to ask if unclear:
- "grocery shopping", "meal prep", "exercise", "workout" → 30-60 minutes
- "write email", "read article", "study session" → 15-30 minutes

LONG TASKS (60+ minutes) - Should ask:
- "deep clean", "preparation", "project work", "research" → Ask for duration

ANALYSIS RULES:
1. If RECURRING TASK detected:
   - Infer duration if task is clearly a quick task (5-10 minutes)
   - Only ask about duration if task type is unclear or likely longer than 10 minutes
   - Always ask about indefinite vs end date
   - Return follow-up question with "needsDuration" flag
   - Don't generate the actual task yet

2. If NOT recurring:
   - Generate the task normally with optimal scheduling

3. For TASK DESCRIPTION (details field):
   - Write a clear, actionable description of what the user will actually do
   - Use imperative mood (e.g., "Record a song", "Take out the trash", "Call mom")
   - Avoid meta-descriptions like "Schedule a time to..." or "Remember to..."
   - Focus on the actual task action, not the scheduling aspect
   - Keep it concise but descriptive
   - CRITICAL: If the user's description contains a URL (http://, https://, or www.), you MUST include that URL in the task details field. Preserve the URL exactly as provided by the user.
   - CRITICAL: If mentioning times in the description, use the user's preferred format: ${userTimeFormat === '24h' ? '24-hour format (e.g., "19:00 to 22:00")' : '12-hour format with AM/PM (e.g., "7:00 PM to 10:00 PM")'}

4. For DURATION ESTIMATION (non-recurring only):
   - Simple tasks: 5-15 minutes (e.g., "take out trash", "call mom")
   - Medium tasks: 30-90 minutes (e.g., "grocery shopping", "write email")
   - Complex tasks: 120-360 minutes (e.g., "deep clean kitchen", "prepare presentation")
   - Be realistic: "take out trash" = 2-5 minutes, not 30 minutes

4. For SCHEDULING (non-recurring only):
   ${constrainedDate ? 
     `- CRITICAL: User explicitly selected time slot on ${constrainedDate}${constrainedTime ? ` at ${constrainedTime}` : ''}. You MUST use ${constrainedDate} as the suggested_date. DO NOT suggest any other date.
     - If the user's description mentions a different time within the same day, use that time (e.g., if user says "12:30-1pm" but selected 12:00pm slot, use 12:30-1pm)
     - If the user's description mentions a specific different date (like "January 15th" or "next Tuesday"), you may use that date instead, but ONLY if it's explicitly mentioned
     - IGNORE relative terms like "tomorrow", "next week", etc. when a time slot is selected - use the selected date (${constrainedDate})
     - Only adjust duration if needed
     - If time conflicts, suggest the closest available slot on that day
     - ABSOLUTE REQUIREMENT: NEVER suggest dates or times in the past. If ${constrainedDate} is today (${formatDateForDB(today)}) and the selected time has passed, you MUST reject the request or suggest a future time.
     - CRITICAL: If ${constrainedDate} is today (${formatDateForDB(today)}), the suggested_time MUST be AFTER the current time (${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')}). Do NOT suggest times in the past.
     - In your reasoning, explain why you're using the selected date (${constrainedDate}) and how you balanced it with the user's stated time preferences` :
     `- Find the NEXT AVAILABLE slot from today onward
     - ABSOLUTE REQUIREMENT: NEVER suggest dates or times in the past. This is strictly forbidden.
     - CRITICAL: Current time is ${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')} on ${formatDateForDB(today)}. You MUST NOT suggest times in the past.
     - If scheduling for today, suggested_time MUST be AFTER ${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')}
     - If the user mentions a past time, ignore it and suggest the next available future time instead
     - Prefer work hours (${workdayStartHour}:00-${workdayEndHour}:00) when possible
     - Avoid scheduling during existing tasks
     - If no slots available today, suggest the earliest possible time tomorrow or later`}

5. For TIME PARSING:
   - "Thursday at 5pm" → Thursday, 17:00
   - "tomorrow morning" → next day, 09:00
   - "next Monday" → next Monday, 09:00
   - "this afternoon" → today, 14:00
   - "evening" → 18:00
   - "lunch time" → 12:00

6. For DATE CALCULATION:
   - Use current date: ${formatDateForDB(today)}
   - Calculate relative dates (tomorrow, next week, etc.)
   - Return dates in YYYY-MM-DD format

RETURN JSON FORMAT:

If RECURRING TASK detected:
{
  "isRecurring": true,
  "followUpQuestion": "I see you want to schedule this as a recurring task. Should this continue indefinitely or do you have an end date in mind?",
  "needsDuration": false,
  "inferredDuration": 5,
  "detectedPattern": "every Monday",
  "taskName": "Take out trash"
}

OR if duration is unclear:

{
  "isRecurring": true,
  "followUpQuestion": "I see you want to schedule this as a recurring task. Please specify: 1) How long should each session be? 2) Should this continue indefinitely or do you have an end date in mind?",
  "needsDuration": true,
  "detectedPattern": "every Monday",
  "taskName": "Workout session"
}

CRITICAL: Set "needsDuration" to false for quick tasks (5-10 minutes) and infer the duration automatically. Only set "needsDuration" to true for tasks where duration is unclear or likely longer than 10 minutes.

If NOT recurring:
{
  "isRecurring": false,
  "name": "Concise task name",
  "details": "Clear task description or steps. If the user provided a URL in their description, include it here.${userTimeFormat === '24h' ? ' If mentioning times, use 24-hour format (e.g., "19:00 to 22:00").' : ' If mentioning times, use 12-hour format with AM/PM (e.g., "7:00 PM to 10:00 PM").'}",
  "duration_minutes": 30,
  "priority": 3,
  "suggested_date": "2024-01-15",
  "suggested_time": "14:00",
  "reasoning": "Why this time slot and priority were chosen.${constrainedDate ? ` Include why this date (${constrainedDate}) was selected based on the user's time slot selection.` : ''}${userTimeFormat === '24h' ? ' If mentioning times, use 24-hour format (e.g., "19:00 to 22:00").' : ' If mentioning times, use 12-hour format with AM/PM (e.g., "7:00 PM to 10:00 PM").'}",
  "priority_reasoning": "Why this priority (1-4) was assigned based on urgency, complexity, and schedule balance."
}

CRITICAL VALIDATION:
✓ If recurring: return follow-up question, don't generate task
✓ If not recurring: generate task with realistic duration and optimal timing
✓ Task name is specific and actionable
✓ Duration is realistic (5-360 minutes)
✓ Priority is a valid integer between 1-4 (REQUIRED)
✓ Priority reasoning explains the decision
✓ Date is in YYYY-MM-DD format
✓ Time is in HH:MM format (24-hour) for suggested_time field
✓ Details and reasoning text use user's preferred time format${userTimeFormat === '24h' ? ' (24-hour)' : ' (12-hour with AM/PM)'} when mentioning times
✓ Reasoning explains the scheduling choice
✓ Respects constraints if provided
✓ Avoids conflicts with existing tasks
✓ Considers priority distribution to avoid clustering`

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert task scheduler. Return only valid JSON. Be realistic with duration estimates and respect user constraints. CRITICAL: Only detect recurring tasks when EXPLICIT recurring keywords are present (e.g., "every", "daily", "weekly", plural days like "Mondays"). Simply mentioning a day name (e.g., "Friday") is a one-time task on that day, NOT recurring.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    })

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}')

    // If the user text contains an explicit weekday/time (e.g., "next Tuesday at 8am"),
    // compute it deterministically in our timezone and override AI suggestion if mismatched.
    const explicit = resolveWeekdayDate(description, today, DEFAULT_TZ)
    const explicitTime = resolveExplicitTime(description)
    const relative = resolveRelativeDate(description, today, DEFAULT_TZ)
    
    // CRITICAL: When user selects a time slot (constrainedDate), that date ALWAYS takes precedence
    // Priority order: constrainedDate (user's explicit selection) > explicit date in description > relative date > AI suggestion
    if (constrainedDate) {
      // CRITICAL: If user selected a time slot, ALWAYS use that date
      // This takes precedence over everything else - user's explicit selection is the source of truth
      aiResponse.suggested_date = constrainedDate
    } else if (explicit.date) {
      // Only use explicit date if user hasn't selected a time slot
      aiResponse.suggested_date = explicit.date
    } else if (relative.date) {
      // Relative dates (tomorrow, today, next week) only if no constrainedDate
      aiResponse.suggested_date = relative.date
    }
    if (explicitTime) {
      if (explicitTime.startTime) {
        aiResponse.suggested_time = explicitTime.startTime
      }
      if (explicitTime.endTime) {
        // Calculate duration from explicit end time
        aiResponse.duration_minutes = calculateDuration(
          explicitTime.startTime || aiResponse.suggested_time,
          explicitTime.endTime
        )
      }
    }
    
    // Handle recurring task follow-up
    if (aiResponse.isRecurring) {
      // Parse time range from original description if available
      const parsedTime = resolveExplicitTime(description)
      let inferredDuration = null
      let parsedStartTime = null
      let parsedEndTime = null
      
      if (parsedTime) {
        parsedStartTime = parsedTime.startTime
        parsedEndTime = parsedTime.endTime
        
        // Calculate duration if both times are available
        if (parsedStartTime && parsedEndTime) {
          inferredDuration = calculateDuration(parsedStartTime, parsedEndTime)
        }
      }
      
      return NextResponse.json({
        success: true,
        isRecurring: true,
        followUpQuestion: aiResponse.followUpQuestion,
        detectedPattern: aiResponse.detectedPattern,
        taskName: aiResponse.taskName,
        needsDuration: aiResponse.needsDuration,
        inferredDuration: inferredDuration || aiResponse.inferredDuration,
        parsedStartTime: parsedStartTime,
        parsedEndTime: parsedEndTime
      })
    }

    // Handle regular task generation
    if (!aiResponse.name || !aiResponse.duration_minutes || !aiResponse.suggested_date || !aiResponse.suggested_time) {
      throw new Error('Invalid AI response format')
    }

    // Validate duration is within acceptable range
    if (aiResponse.duration_minutes < 5 || aiResponse.duration_minutes > 360) {
      aiResponse.duration_minutes = Math.max(5, Math.min(360, aiResponse.duration_minutes))
    }

    // Calculate end time first to validate the complete task
    let startTime = aiResponse.suggested_time
    let endTime: string
    if (explicitTime?.endTime) {
      endTime = explicitTime.endTime
    } else {
      const duration = aiResponse.duration_minutes
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMinute
      const endMinutes = startMinutes + duration
      const endHour = Math.floor(endMinutes / 60) % 24
      const endMinute = endMinutes % 60
      endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
    }

    // HARD VALIDATION: AI must NEVER generate tasks in the past
    // Reject any task with past dates or overdue times
    const { todayStr, currentTimeStr } = getCurrentDateTime()
    if (isTaskInPast(aiResponse.suggested_date, endTime, todayStr, currentTimeStr)) {
      console.error('AI attempted to generate task in the past:', {
        suggested_date: aiResponse.suggested_date,
        suggested_time: startTime,
        end_time: endTime,
        current_date: todayStr,
        current_time: currentTimeStr
      })
      throw new Error('AI cannot generate tasks in the past. The suggested date/time has already passed.')
    }

    // Validate and default priority
    let priority = aiResponse.priority
    if (!priority || priority < 1 || priority > 4) {
      priority = 3 // Default to Medium if invalid
      console.warn('AI returned invalid priority, defaulting to 3')
    }

    // Commit credit after successful OpenAI call
    if (reserved && authContext) {
      await authContext.creditService.commit('api_credits', TASK_GENERATION_CREDIT_COST, {
        route: 'tasks.ai-generate',
        model: 'gpt-4o-mini',
        type: 'task_generation',
      })
      reserved = false
    }

    return NextResponse.json({
      success: true,
      isRecurring: false,
      task: {
        name: aiResponse.name,
        details: aiResponse.details || '',
        duration_minutes: aiResponse.duration_minutes,
        priority: priority,
        suggested_date: aiResponse.suggested_date,
        suggested_time: aiResponse.suggested_time,
        suggested_end_time: endTime,
        suggested_time_display: formatTimeForDisplay(aiResponse.suggested_time, timeFormat),
        suggested_end_time_display: formatTimeForDisplay(endTime, timeFormat),
        reasoning: aiResponse.reasoning || 'AI-generated optimal time slot',
        priority_reasoning: aiResponse.priority_reasoning || `Assigned priority ${priority} based on task analysis`
      }
    })

  } catch (error) {
    console.error('Error generating AI task:', error)
    
    // Release credit on error
    if (reserved && authContext) {
      await authContext.creditService.release('api_credits', TASK_GENERATION_CREDIT_COST, {
        route: 'tasks.ai-generate',
        reason: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }).catch((releaseError) => {
        console.error('Failed to release credit:', releaseError)
      })
      reserved = false
    }

    // Handle UsageLimitExceeded error
    if (error instanceof UsageLimitExceeded) {
      return NextResponse.json(
        {
          error: 'USAGE_LIMIT_EXCEEDED',
          message: 'You have reached your plan\'s limit for this feature. Please upgrade your plan or wait for the next billing cycle.',
          remaining: error.remaining,
        },
        { status: 429 }
      )
    }

    // Handle ApiTokenError
    if (error instanceof ApiTokenError) {
      return NextResponse.json(
        { error: 'API_TOKEN_ERROR', message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to generate task', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
