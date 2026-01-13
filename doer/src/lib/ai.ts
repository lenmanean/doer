// src/lib/ai.ts
import OpenAI from 'openai'

if (process.env.NODE_ENV !== 'production' && !process.env.OPENAI_API_KEY) {
  console.warn(
    '\n⚠️  Warning: OPENAI_API_KEY is missing. AI routes will fail.\n' +
      '→ Add it to your .env.local file\n'
  )
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

import { AIModelRequest } from './types'
import { combineGoalWithClarifications, detectAvailabilityPatterns } from './goal-analysis'

/**
 * Evaluates whether a goal is realistically achievable within the 21-day cap
 * Includes clarifications for full contextual awareness
 */
export async function evaluateGoalFeasibility(
  goal: string,
  clarifications?: Record<string, any> | string[]
): Promise<{
  isFeasible: boolean
  reasoning: string
}> {
  // Combine goal with clarifications for full context
  const contextualGoal = combineGoalWithClarifications(goal, clarifications)
  
  const prompt = `
You are a feasibility reviewer. Determine if the following goal can realistically be achieved WITHIN 21 DAYS and provide a short reason.

RULES:
- Be PERMISSIVE - only reject goals that are clearly impossible or violate physical/logical constraints.
- Accept ambitious goals as long as they are technically achievable, even if challenging.
- Consider that users may work intensively, have prior experience, or use shortcuts.
- Only return isFeasible = false for goals that are:
  * Physically impossible (e.g., "travel to Mars in 21 days")
  * Legally/ethically impossible (e.g., "become a licensed doctor in 21 days")
  * Logically contradictory (e.g., "complete a 6-month course in 1 day")
- For tight timelines or ambitious goals, return isFeasible = true and note the challenge in reasoning.
- Consider ALL provided context, including any clarifications or additional details.
- Respond in JSON ONLY: { "isFeasible": boolean, "reasoning": "string" }

Goal and Context:
"${contextualGoal}"
`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a permissive feasibility reviewer. Only reject clearly impossible goals. Return strict JSON with boolean isFeasible and string reasoning.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    return {
      isFeasible: parsed.isFeasible === true,
      reasoning: parsed.reasoning || 'Unable to determine feasibility'
    }
  } catch (error) {
    console.error('Feasibility evaluation error:', error)
    // Fail open so the calling code can decide how to handle
    return { isFeasible: true, reasoning: 'Feasibility check failed – defaulting to feasible' }
  }
}

/**
 * Analyzes a goal to determine if clarification questions are needed
 * Includes clarifications for full contextual awareness
 */
export async function analyzeClarificationNeeds(
  goal: string,
  clarifications?: Record<string, any> | string[],
  workdaySettings?: { workday_end_hour?: number }
): Promise<{
  needsClarification: boolean
  questions: string[]
}> {
  // Combine goal with clarifications for full context
  const contextualGoal = combineGoalWithClarifications(goal, clarifications)
  
  // Detect availability patterns to include in prompt (check user settings first)
  const availabilityPatterns = detectAvailabilityPatterns(goal, clarifications, workdaySettings)
  const availabilityContext = availabilityPatterns.requiresClarification
    ? `\n\nAVAILABILITY PATTERNS DETECTED:
- Time of day: ${availabilityPatterns.timeOfDay || 'not specified'}
- Hours per day: ${availabilityPatterns.hoursPerDay || 'not specified'}
- Days of week: ${availabilityPatterns.daysOfWeek?.join(', ') || 'not specified'}
- Requires clarification: ${availabilityPatterns.requiresClarification ? 'YES' : 'NO'}
${availabilityPatterns.clarificationQuestions ? `- Suggested questions: ${availabilityPatterns.clarificationQuestions.join(', ')}` : ''}`
    : ''
  
  const prompt = `Analyze this goal to determine if clarification questions are needed before creating a plan.

GOAL AND CONTEXT: "${contextualGoal}"${availabilityContext}

ANALYSIS CRITERIA:
- Ambiguity: Is the goal vague or unclear? (e.g., "learn programming" vs "learn Python")
- Missing context: Does it lack critical information? (experience level, resources, constraints)
- Scope uncertainty: Could it mean different things? (e.g., "get fit" - cardio, strength, flexibility?)
- Time-sensitive details: Are there implicit deadlines or schedules?
- Timeline ambiguity: Can't determine realistic timeline from goal alone? (e.g., "learn programming" - quick intro vs deep mastery?)
- Availability patterns: Does the goal mention specific times (evenings, mornings, weekends)? Do we need to know when work ends or when sessions should start?

DECISION RULES:
- Consider ALL provided context, including clarifications - if context already answers questions, don't ask them again
- If goal WITH context is SPECIFIC and CLEAR → return empty questions array
- If goal needs clarification → generate 1-3 focused questions maximum
- Questions should be essential for creating a quality plan
- Avoid asking questions that are already answered in the provided context
- Try to infer timeline from goal description and context first
- If availability patterns are detected but details are missing (e.g., "evening after work" but no workday end time), include relevant questions

EXAMPLES:
- "Run a 5K in under 30 minutes" → CLEAR, no questions needed
- "Learn guitar" → UNCLEAR, needs: "What's your current guitar experience level?"
- "Start a business" → UNCLEAR, needs: "What type of business?" and "What's your budget range?"
- "Learn programming" → UNCLEAR timeline, needs: "How much time do you have? Quick intro (1-2 weeks) or deep mastery (3-6 months)?"
- "I have 2 hours each evening after work" → needs: "What time does your workday end?"
- "I can only work on weekends" → needs: "What hours are you available on weekends?"

Return JSON format:
{
  "needsClarification": boolean,
  "questions": string[]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a goal analysis expert. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    return {
      needsClarification: parsed.needsClarification === true,
      questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : []
    }
  } catch (error) {
    console.error('Clarification analysis error:', error)
    return { needsClarification: false, questions: [] }
  }
}

/**
 * Generate roadmap structure with duration estimates and priority assignments
 * AI focuses on CONTENT and DURATION ESTIMATION - no dates or scheduling
 */
export async function generateRoadmapContent(request: AIModelRequest, userId?: string): Promise<{
  timeline_days: number
  goal_text: string
  goal_title: string
  plan_summary: string
  tasks: Array<{
    name: string
    details: string
    estimated_duration_minutes: number
    priority: 1 | 2 | 3 | 4
  }>
}> {
  const formatSlot = (slot: { start: string; end: string; source?: string }) => {
    const start = new Date(slot.start)
    const end = new Date(slot.end)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
    const startISO = start.toISOString()
    const endISO = end.toISOString()
    return `${startISO} → ${endISO}${slot.source ? ` (${slot.source})` : ''}`
  }

  const availabilityContextLines: string[] = []
  if (request.availability) {
    const busyLines = request.availability.busySlots
      .map(formatSlot)
      .filter((line): line is string => Boolean(line))
    if (busyLines.length > 0) {
      availabilityContextLines.push('EXISTING SCHEDULED COMMITMENTS (do NOT schedule tasks during these windows - these include existing scheduled tasks and calendar events):')
      busyLines.slice(0, 12).forEach(line => availabilityContextLines.push(`- ${line}`))
      if (busyLines.length > 12) {
        availabilityContextLines.push(`- ... ${busyLines.length - 12} more slots omitted for brevity`)
      }
      
      // Calculate actual available capacity per day from busy slots
      const startDate = new Date(request.start_date)
      const busySlotsByDay = new Map<string, number>() // date string -> minutes
      
      for (const slot of request.availability.busySlots) {
        try {
          const slotStart = new Date(slot.start)
          const slotEnd = new Date(slot.end)
          if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) continue
          
          const slotDate = slotStart.toISOString().split('T')[0]
          const slotDuration = Math.round((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60))
          
          if (slotDuration > 0) {
            const current = busySlotsByDay.get(slotDate) || 0
            busySlotsByDay.set(slotDate, current + slotDuration)
          }
        } catch (error) {
          // Skip invalid slots
          continue
        }
      }
      
      // Calculate daily capacity (assuming 9am-5pm workday with 1 hour lunch = 420 minutes)
      // This is a default - actual capacity will be calculated by scheduler based on user settings
      const defaultDailyCapacity = 420 // 8 hours - 1 hour lunch = 7 hours = 420 minutes
      
      // Show capacity impact for first few days
      if (busySlotsByDay.size > 0) {
        availabilityContextLines.push('')
        availabilityContextLines.push('ACTUAL AVAILABLE CAPACITY PER DAY (accounting for existing commitments):')
        
        const sortedDays = Array.from(busySlotsByDay.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(0, 7) // Show first 7 days
        
        for (const [date, busyMinutes] of sortedDays) {
          const available = Math.max(0, defaultDailyCapacity - busyMinutes)
          const utilizationPercent = Math.round((busyMinutes / defaultDailyCapacity) * 100)
          availabilityContextLines.push(`- ${date}: ${busyMinutes} min already scheduled, ${available} min available (${utilizationPercent}% utilized)`)
        }
        
        if (busySlotsByDay.size > 7) {
          availabilityContextLines.push(`- ... ${busySlotsByDay.size - 7} more days with existing commitments`)
        }
        
        availabilityContextLines.push('')
        availabilityContextLines.push('CRITICAL CAPACITY INSTRUCTIONS:')
        availabilityContextLines.push('- Generate tasks that fit within the ACTUAL available capacity shown above')
        availabilityContextLines.push('- If a day has less than 100 minutes available, consider extending the timeline to spread work across more days')
        availabilityContextLines.push('- If total task duration exceeds available capacity across all days, extend timeline_days accordingly')
        availabilityContextLines.push('- Example: If Day 1 has only 20 min available but tasks total 200 min, extend timeline to 2-3 days')
      } else {
        availabilityContextLines.push('IMPORTANT: Adjust your task generation and timeline to work around these existing commitments. If there are many conflicts, consider extending the timeline or breaking tasks into smaller chunks that can fit between commitments.')
      }
    }

    const timeOffLines = request.availability.timeOff
      .map(formatSlot)
      .filter((line): line is string => Boolean(line))
    if (timeOffLines.length > 0) {
      availabilityContextLines.push('TIME OFF (treat as hard blocks, like vacation/sick days):')
      timeOffLines.forEach(line => availabilityContextLines.push(`- ${line}`))
    }

    if (request.availability.deadline) {
      const deadline = new Date(request.availability.deadline)
      if (!isNaN(deadline.getTime())) {
        availabilityContextLines.push(`HARD DEADLINE: All tasks must finish before ${deadline.toISOString()}`)
      }
    }
  }

  const availabilityContext =
    availabilityContextLines.length > 0
      ? `\nAVAILABILITY CONTEXT:\n${availabilityContextLines.join('\n')}\n\n`
      : ''

  // Build time constraint context if applicable
  let timeConstraintContext = ''
  if (request.timeConstraints && request.timeConstraints.isStartDateToday) {
    const { remainingMinutes, urgencyLevel, requiresToday, timelineRequirement } = request.timeConstraints
    const remainingHours = Math.floor(remainingMinutes / 60)
    const remainingMins = remainingMinutes % 60
    
    timeConstraintContext = `\nTIME CONSTRAINT AWARENESS:
• Start date is TODAY - only ${remainingHours} hour${remainingHours !== 1 ? 's' : ''} and ${remainingMins} minute${remainingMins !== 1 ? 's' : ''} remain in today's workday
• User urgency level: ${urgencyLevel.toUpperCase()}${requiresToday ? ' (explicitly requires completion today)' : ''}
• IMPORTANT: If total task duration exceeds remaining time (${remainingMinutes} minutes):
  - If user expressed urgency ("today", "by end of day"): Extend timeline_days to include tomorrow and note this adjustment in plan_summary
  - If no urgency expressed: Extend timeline_days naturally to ensure all tasks can be completed
• Always ensure timeline_days accounts for available time on start day
• If extending timeline, distribute tasks across days - don't pack everything into day 1
• Example: If ${remainingMinutes} min remain but tasks total 300 min → extend to 2 days, start some tasks tomorrow

`
    
    // Add timeline requirement context if user explicitly specified a timeline
    if (timelineRequirement?.minimumDays) {
      timeConstraintContext += `\nTIMELINE REQUIREMENT: The user has explicitly requested a ${timelineRequirement.minimumDays}-day timeline. Ensure your timeline_days reflects this requirement, even if tasks could theoretically fit in fewer days. The timeline_days should be at least ${timelineRequirement.minimumDays} days.\n\n`
    }

  }

  // Combine goal with clarifications for full contextual awareness
  const contextualGoal = combineGoalWithClarifications(request.goal, request.clarifications)
  
  // Fetch Notion context if available (before building prompt sections)
  let notionContext: string | null = null
  if (userId) {
    try {
      const { fetchNotionContext } = await import('@/lib/knowledge/notion-context')
      notionContext = await fetchNotionContext(userId, request.goal)
    } catch (error) {
      // Silently fail if Notion context fetching fails - don't block plan generation
      console.warn('Failed to fetch Notion context:', error)
    }
  }
  
  // Build clarifications section for additional context (if structured Q&A format exists)
  const clarificationsSection = request.clarifications && request.clarificationQuestions ? `
CLARIFICATIONS PROVIDED:
${request.clarificationQuestions.map((q: string, i: number) => {
  const answer = Array.isArray(request.clarifications) 
    ? request.clarifications[i]
    : request.clarifications?.[`clarification_${i + 1}`] || request.clarifications?.[`answer_${i + 1}`] || 'Not provided'
  return `Q${i + 1}: ${q}\nA${i + 1}: ${answer}`
}).join('\n\n')}

IMPORTANT: Use these clarifications to tailor the plan. Adjust timeline and task complexity based on user's experience level and specific requirements.` : ''

  // Build tools section if tools are provided
  const { formatToolsForPrompt, groupToolsByCategory } = await import('@/lib/tool-extraction')
  let toolsSection = ''
  if (request.tools && request.tools.length > 0) {
    const toolsText = formatToolsForPrompt(request.tools)
    const groupedTools = groupToolsByCategory(request.tools)
    const categorySections: string[] = []
    
    for (const [category, tools] of Object.entries(groupedTools)) {
      if (category !== 'other' && tools.length > 0) {
        categorySections.push(`${category}: ${tools.join(', ')}`)
      }
    }
    
    toolsSection = `
TOOLS AND SOFTWARE CONTEXT:
${toolsText}${categorySections.length > 0 ? `\nTool categories: ${categorySections.join('; ')}` : ''}

CRITICAL INSTRUCTIONS FOR TOOL USAGE:
- Tasks MUST explicitly reference the specific tools/software mentioned above when relevant
- If a task involves creating slides, and user mentioned "Google Slides", the task details should say "Create slides in Google Slides" NOT just "Create slides"
- If a task involves scheduling/calendar work and user mentioned "Google Calendar", reference it specifically
- Task names should be generic (e.g., "Create presentation slides") but task details MUST include the specific tool (e.g., "Use Google Slides to create 10-12 slides covering...")
- Incorporate tool-specific features when relevant (e.g., "Share via Google Slides sharing options" if Google Slides was mentioned)
- If multiple tools were mentioned for different purposes, use the appropriate tool for each relevant task
- DO NOT create generic tasks that could work with any tool - be specific based on what the user specified

Examples:
- User mentions "Google Slides" → Task details: "Create 10-12 slides in Google Slides covering the main topics. Use Google Slides templates and sharing features."
- User mentions "PowerPoint" → Task details: "Design presentation slides in PowerPoint with consistent theme and animations."
- User mentions "DOER and Google Calendar" → Relevant tasks should mention using DOER for task management and Google Calendar for scheduling
`
  }

  // Build Notion context section if available
  const notionContextSection = notionContext ? `
NOTION CONTEXT:
The user has provided the following context from their Notion workspace:
${notionContext}

Use this context to inform your plan generation. Reference relevant information from Notion when creating tasks and timelines.
` : ''

  const prompt = `Create a structured plan with realistic duration estimates for:

"${contextualGoal}"

${clarificationsSection}${toolsSection}${notionContextSection}

${availabilityContext}${timeConstraintContext}DURATION ESTIMATION:
• AI determines EXACT duration for each task based on complexity
• NO hardcoded durations - analyze the specific task context
• Consider user's goal and realistic completion time
• Range: 5-360 minutes per task (10-60 min typical, 90-120 min for deep work)
• If a task would exceed 120 minutes, split it into smaller focused blocks when possible
• BE REALISTIC about how long tasks actually take:
  - Research/reading: 15-30 minutes per topic
  - Writing/creating: 30-60 minutes per deliverable
  - Practice/rehearsal: 30-45 minutes per session
  - Simple setup/preparation: 10-20 minutes
• IMPORTANT: If you're creating a 1-day plan, total duration MUST be under 250 minutes
• Example breakdown for 1-day plan (presentation):
  - Research topic: 30 min
  - Outline presentation: 20 min
  - Create slides: 60 min
  - Write speaker notes: 30 min
  - Practice delivery: 40 min
  - Final review: 20 min
  - TOTAL: 200 minutes (fits in 1 day with buffer)

TIMELINE ESTIMATION:
1. Analyze goal complexity and required skill development time
2. Consider realistic learning/practice curves
3. Estimate total days needed (range: 1-21 days MAX). Bias toward the SHORTEST realistic timeline.
4. Examples:
   - "Polish resume and cover letter": 1-2 days
   - "Prepare for a remote job interview": 2 days
   - "Refresh personal portfolio site": 5-7 days
   - "Plan and rehearse a workshop": 10-14 days

TIMELINE CALCULATION RULES:
• CRITICAL: If user explicitly specified a timeline (e.g., "in the next two weeks", "over 14 days"), timeline_days MUST be at least that number, even if tasks could fit in fewer days. User-specified timelines take ABSOLUTE PRIORITY over capacity calculations.
• Sum all task durations (in minutes)
• REALISTIC DAILY CAPACITY: ~250 minutes per day (accounts for breaks, interruptions, realistic pacing)
  - Base workday: 9am-5pm (8 hours = 480 minutes)
  - Minus lunch: 1 hour (60 minutes)
  - Realistic capacity: 60% of remaining time = 252 minutes per day
• CAPACITY FORMULA: For N-day plan, max total task duration = N × 250 minutes
  - 1 day plan = max 250 minutes of tasks
  - 2 day plan = max 500 minutes of tasks
  - 3 day plan = max 750 minutes of tasks
• TIMELINE MUST SCALE WITH TOTAL WORKLOAD: Draw timeline_days from total duration + buffer rather than defaulting to a short span. If the sum of durations exceeds 250×timeline_days, extend the timeline until the workload fits (realistic pacing beats short timelines).
• CRITICAL FOR SINGLE-DAY PLANS: Keep total task duration under 250 minutes
• Examples:
  - If total tasks = 240 minutes → 1 day plan (fits)
  - If total tasks = 480 minutes → 2 day plan minimum
  - If total tasks = 720 minutes → 3 day plan minimum
  - If user says "in the next two weeks" (14 days) → timeline_days MUST be 14, even if tasks only need 2 days
• Add 10-20% buffer for realistic pacing (already built into 60% capacity)
• Short-term goals (<250 min total) = 1 day (UNLESS user specified longer timeline)
• Medium goals (250-500 min) = 2 days (UNLESS user specified longer timeline)
• Long-term goals = proportional days (max 21)
• MAX 21 days. Bias toward SHORTEST realistic timeline (UNLESS user explicitly specified a longer timeline).
• CRITICAL: timeline_days MUST NOT exceed 21. If calculated timeline > 21 days, reduce task count or simplify goal scope.
• Quality over quantity: Better to have 10-12 high-quality tasks over 21 days than 20+ generic tasks.
• If goal requires more than 21 days, break into phases or simplify scope.

MULTI-DAY PLAN DISTRIBUTION:
• For 2+ day plans, distribute tasks to avoid front-loading
• Day 1: Foundational work (Priority 1-2 tasks that enable others)
• Middle days: Core execution (Priority 2-3 tasks)
• Final day: Completion tasks, final prep, time-sensitive items
• Example 2-day interview prep:
  - Day 1: Resume update, portfolio work, research (foundational)
  - Day 2: Practice interviews, tech setup, final review (execution + time-sensitive)
• Balance workload: Aim for 60-80% capacity each day, not 100% on one day
• Don't schedule all Priority 1 tasks on Day 1 if there's time on Day 2
• Distribute work evenly to prevent burnout and maintain quality

AVAILABILITY-CONSCIOUS DISTRIBUTION:
• When assigning tasks, assume the user wants to honor their declared workday start/end times and lunch break, so spread the total duration across the available days rather than stacking everything on the final date.
• Use the provided availability context (time off, busy slots, lunch windows) to avoid locking tasks into unavailable periods; mention the relevant window only if it changes the timeline.
• Extract availability patterns from goal text (evenings, mornings, weekends, hours per day)
• If user mentions "X hours available", ensure daily task duration doesn't exceed X hours
• If user mentions "evening after work", note this in plan_summary and adjust task timing expectations
• Target a realistic per-day capacity (e.g., 250-320 minutes max) and keep tasks balanced across the active days—high durations should be broken into multiple days if they would otherwise exceed that cap.
• Prefer to fill earlier active days first but allow higher-priority, dependency-sensitive tasks to move toward the start of the timeline while still leaving room for practice/final review on later days.

AVAILABILITY PATTERNS IN GOAL TEXT:
• If the user mentions specific availability (e.g., "evenings after work", "2 hours per day", "weekends only"), extract and respect these constraints
• When user says "evening after work", assume they mean after their workday ends (typically 5-6 PM)
• If user specifies hours per day (e.g., "2 hours available"), ensure total daily task duration respects this limit
• Mention availability constraints in plan_summary if they affect timeline or task distribution
• Example: "User has 2 hours each evening → plan tasks to fit within 120 minutes per day"

PRIORITY ASSIGNMENT (1-4):
• Keep Priority 1 (Critical) tasks to essential prerequisites ONLY (target ≤35% of total tasks)
• Priority 1 (Critical): ONLY for foundational dependencies - tasks that MUST be done before others can start
  - Example: "Research company" comes before "Prepare talking points" (need research to prepare)
  - Example: "Learn basics" before "Practice advanced techniques" (need knowledge to practice)
  - Example: "Gather materials" before "Build project" (need materials to build)
  - NOT for time-sensitive tasks that should happen near deadline
  - NOT for setup tasks that should be done close to event time

• Priority 2 (High): Important preparatory work and core execution tasks
  - Time-sensitive tasks that should happen 1-2 days before deadline
  - Practice / rehearsal sessions that must happen before final polish
  - Example: "Set up interview space" (do closer to interview, not first day)
  - Example: "Tech check" (do day before event, not days earlier)
  - Example: "Practice presentation delivery" (rehearse before final review)
  - Core work that doesn't block other tasks but is still important

• Priority 3 (Medium): Valuable enhancing + wrap-up tasks with flexible timing
  - Final review / polish / QA tasks that happen after practice or testing
  - Optional improvements, extra iterations, backlog grooming
  - Example: "Final review of slides and notes" (only after practice is complete)
  - Example: "Practice mock interviews" (valuable but can be done anytime)
  - Example: "Add extra features" (nice-to-have enhancements)
  - Tasks that improve quality but aren't strictly required

• Priority 4 (Low): Nice-to-have additions and optional polish
  - Documentation, extra polish, optional features
  - Things that add value but can be skipped if time is tight

CRITICAL PRIORITY RULES:
1. If Task B needs output/result from Task A → Task A MUST be Priority 1, Task B is Priority 2+
2. If Task X should happen near deadline (setup, final prep) → Priority 2-3, NOT Priority 1
3. Setup/prep tasks for events → Schedule 1 day before event, assign Priority 2-3
4. Practice / rehearsal tasks MUST have equal or higher priority (lower number) than any final review / polish tasks
   • Example: Practice presentation (Priority 2) → Final review (Priority 3 or 4)
5. Final review / polish tasks MUST be scheduled AFTER the related work and practice
   • Assign Priority 3-4 so they occur last in the timeline
6. Relaxation / mental prep tasks should be Priority 3-4 and occur after all actionable work
7. Research/foundational learning → Priority 1 (needed before dependent work)
8. Planning/structuring tasks that create blueprints or frameworks → Priority 1 (foundational - must be done before creation/building tasks)
   • If a task creates a structure, plan, outline, or design that other tasks will use as input, it MUST be Priority 1
   • Analyze the goal description to identify which tasks create foundational frameworks that others depend on

EXAMPLES OF CORRECT PRIORITY ASSIGNMENT:
• Priority 1: Foundational tasks that others depend on (research, planning, structuring, gathering prerequisites)
• Priority 2: Core execution tasks that use outputs from Priority 1 tasks
• Priority 3: Enhancement and polish tasks that improve upon Priority 2 work
• Priority 4: Optional additions and documentation

General principle: Analyze the goal description to identify task dependencies. If Task B requires the output/result from Task A, then Task A is foundational and should be Priority 1, while Task B is Priority 2+.

SCHEDULING STRATEGY:
• Schedule Priority 1 tasks first (foundation work)
• Then Priority 2 tasks (core functionality) 
• Then Priority 3 tasks (enhancements)
• Finally Priority 4 tasks (polish)
• Within each priority, schedule longer tasks first to avoid fragmentation
• CRITICAL: Ensure logical dependencies are respected regardless of priority numbers

TASK DEPENDENCY ENFORCEMENT:
• Task idx (order) MUST reflect logical dependencies - if Task B uses output from Task A, Task A must have lower idx
• Priority assignment MUST also reflect dependencies - foundational tasks (those that others depend on) MUST be Priority 1
• Analyze the goal description to identify logical dependencies between tasks:
  - Tasks that create structures, plans, outlines, or designs that other tasks will use → Priority 1
  - Tasks that gather information, learn basics, or research that other tasks need → Priority 1
  - Tasks that collect materials or resources needed for later tasks → Priority 1
  - Tasks that execute using outputs from foundational tasks → Priority 2+
  - Tasks that practice or rehearse using completed work → Priority 2
  - Tasks that review, polish, or enhance completed work → Priority 3+
• CRITICAL DEPENDENCY ORDERING RULES:
  - Learning tasks (learn, understand, study) MUST come BEFORE practice tasks
  - Practice tasks MUST come BEFORE testing tasks (practice → test, NOT test → practice)
  - Building/creating tasks MUST come BEFORE testing tasks (build → test)
  - Testing tasks MUST come BEFORE final review/polish tasks (test → final)
  - Setup/installation tasks MUST come BEFORE learning/practice tasks
  - Example CORRECT order: Setup → Learn → Practice → Build → Test → Final Review
  - Example INCORRECT order: Practice → Learn (backwards), Test → Practice (backwards)
• When assigning priority, ask: "Does any other task need the output/result of this task?" If yes → Priority 1
• When assigning idx, think: "What must be done first for this task to be possible?"
• Base your analysis on the specific goal description provided, not on generic patterns
• If you're unsure about dependency order or priority, err on the side of putting foundational tasks earlier with Priority 1
• VERIFY: Before finalizing, check that your task order follows the logical flow: Setup → Learn → Practice → Build → Test → Final
• AVOID: Creating circular dependencies or backwards dependencies (e.g., practice depending on test)

STRUCTURE REQUIREMENTS:
1. Tasks: All tasks in unified list with duration estimates
   - Each task needs estimated_duration_minutes (5-360 minutes)
   - Each task needs priority (1, 2, 3, or 4)
   - CRITICAL: Priority must match dependency relationships - analyze the goal description to identify which tasks are foundational (others depend on them) and assign Priority 1 to those
   - Total tasks should support the timeline (aim for 10-15 high-quality tasks)
   - Generate appropriate mix of priorities based on logical dependencies identified in the goal
   - Task names: 3-8 words, specific and actionable (NOT "Task 1", "Do thing")
   - Task details: 1-2 clear sentences explaining what to do
   - Each task must be meaningful and contribute to goal achievement
   - Maintain high quality task descriptions - quality over quantity

2. Title: 3-6 words, catchy
3. Summary: max 14 words

START: ${request.start_date}

JSON FORMAT:
{
  "timeline_days": <calculated based on total duration>,
  "goal_title": "3-6 word catchy, concise title (e.g., 'Prepare tomorrow's presentation', NOT the full goal text)",
  "plan_summary": "14 word max summary",
  "tasks": [
    {
      "name": "Specific action",
      "details": "clear steps",
      "estimated_duration_minutes": <15-360>,
      "priority": 1|2|3|4
    }
  ]
}

CRITICAL TITLE REQUIREMENTS:
- goal_title MUST be 3-6 words, catchy, and concise
- goal_title should NOT be the full user goal text
- goal_title should be an imperative, action-oriented phrase
- Examples:
  * User says "I need to prepare a presentation for tomorrow morning" → goal_title: "Prepare Tomorrow's Presentation"
  * User says "I want to learn React in 2 weeks" → goal_title: "Learn React Fundamentals"
  * User says "Help me build a portfolio website" → goal_title: "Build Portfolio Website"
- Avoid: Long sentences, full goal text, time references in title (e.g., "for tomorrow", "next week")
- Prefer: Action verb + key noun phrase

IMPORTANT: Do NOT include "end_date" in the response. The application will calculate it from timeline_days and start_date.

CRITICAL VALIDATION BEFORE RESPONDING:
✓ All tasks have realistic duration estimates (5-360 minutes)
✓ All tasks have priorities (1, 2, 3, or 4)
✓ Timeline calculated from total duration + buffer
✓ Names = specific actions (NOT "Task 1")
✓ end_date = start_date + timeline_days
✓ Timeline biased SHORT but realistic
✓ All tasks unique & actionable
✓ Duration estimates based on actual task complexity, not priority
✓ Priorities assigned based on logical dependencies and importance`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Duration-aware roadmap generator. Return valid JSON. CRITICAL: 1) All tasks have REALISTIC duration estimates (5-360 minutes) - think about how long YOU would actually take, 2) All tasks have priorities (1, 2, 3, or 4), 3) Timeline calculated from total duration + buffer, 4) Descriptive names (NOT "Task 1"), 5) Bias SHORT timelines but be realistic, 6) Assign priorities based on logical dependencies and importance, 7) Short tasks = 10-20 minutes, focused work = 30-60 minutes, deep work = 90-120 minutes' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
    max_tokens: 12000,
  })

  const output = completion.choices[0].message.content
  if (!output) throw new Error('Empty AI response')

  const parsed = JSON.parse(output)
  
  console.log('AI Roadmap Content Generated:', {
    timeline_days: parsed.timeline_days,
    tasks: parsed.tasks?.length,
    total_duration_minutes: parsed.tasks?.reduce((sum: number, task: any) => sum + (task.estimated_duration_minutes || 0), 0) || 0
  })

  // Validate AI included required fields
  if (!parsed.tasks || parsed.tasks.length === 0) {
    throw new Error('AI did not generate tasks')
  }
  
  // Validate all tasks have duration estimates and priorities
  for (const task of parsed.tasks) {
    if (!task.estimated_duration_minutes || task.estimated_duration_minutes < 5 || task.estimated_duration_minutes > 360) {
      throw new Error(`Task "${task.name}" has invalid duration: ${task.estimated_duration_minutes} (must be 5-360 minutes)`)
    }
    if (!task.priority || ![1, 2, 3, 4].includes(task.priority)) {
      throw new Error(`Task "${task.name}" has invalid priority: ${task.priority}`)
    }
  }

  // Validate timeline does not exceed 21 days
  if (parsed.timeline_days > 21) {
    throw new Error(`TIMELINE_EXCEEDED: AI generated timeline of ${parsed.timeline_days} days exceeds 21-day limit. Please simplify your goal or break into smaller phases.`)
  }

  return parsed
}

/**
 * Generates context-aware clarification questions for an existing plan
 * Based on the plan content, user schedule, and calendar events
 */
export async function generatePlanClarificationQuestions(request: {
  goal: string
  planSummary: string
  timelineDays: number
  tasks: Array<{ name: string; details: string; duration: number; priority: number }>
  existingSchedules: Array<{ date: string; start_time: string; end_time: string }>
  calendarBusySlots: Array<{ start: string; end: string }>
  workdaySettings: { startHour: number; endHour: number; lunchStart: number; lunchEnd: number; allowWeekends: boolean }
}): Promise<{ questions: Array<{ text: string; options: string[]; type?: 'single' | 'multiple' }>; reasoning: string }> {
  // Import tool extraction utilities
  const { extractToolsFromText } = await import('@/lib/tool-extraction')
  
  // Calculate capacity utilization
  const workdayMinutes = (request.workdaySettings.endHour - request.workdaySettings.startHour) * 60
  const lunchMinutes = Math.max(0, request.workdaySettings.lunchEnd - request.workdaySettings.lunchStart)
  const availableMinutesPerDay = Math.max(1, workdayMinutes - lunchMinutes) // Ensure not zero
  const totalTaskMinutes = request.tasks.reduce((sum, task) => sum + (task.duration || 0), 0)
  const timelineDays = Math.max(1, request.timelineDays) // Prevent division by zero
  const averageMinutesPerDay = totalTaskMinutes / timelineDays
  const capacityUtilization = availableMinutesPerDay > 0 ? (averageMinutesPerDay / availableMinutesPerDay) * 100 : 0

  // Analyze schedule conflicts
  const hasScheduleConflicts = request.existingSchedules.length > 0 || request.calendarBusySlots.length > 0
  const conflictSummary = hasScheduleConflicts
    ? `User has ${request.existingSchedules.length} existing scheduled tasks and ${request.calendarBusySlots.length} calendar busy slots.`
    : 'User has no existing scheduled tasks or calendar conflicts.'

  // Check if tasks suggest tool usage but tools are not mentioned
  const goalText = request.goal.toLowerCase()
  const planSummaryText = request.planSummary.toLowerCase()
  const allTaskText = request.tasks.map(t => `${t.name} ${t.details || ''}`).join(' ').toLowerCase()
  const combinedText = `${goalText} ${planSummaryText} ${allTaskText}`
  
  // Detect tool-related keywords that suggest tool usage
  const toolKeywords = {
    presentation: ['presentation', 'slides', 'slide deck', 'pitch', 'demo', 'present'],
    calendar: ['schedule', 'calendar', 'appointment', 'meeting', 'event'],
    design: ['design', 'mockup', 'prototype', 'ui', 'ux', 'wireframe'],
    development: ['code', 'program', 'develop', 'build', 'app', 'website', 'software'],
    writing: ['write', 'document', 'blog', 'article', 'copy', 'content'],
    spreadsheet: ['spreadsheet', 'data', 'analysis', 'track', 'calculate'],
  }
  
  // Check if goal/tasks suggest tool usage
  let suggestedToolCategories: string[] = []
  for (const [category, keywords] of Object.entries(toolKeywords)) {
    if (keywords.some(keyword => combinedText.includes(keyword))) {
      suggestedToolCategories.push(category)
    }
  }
  
  // Extract any tools already mentioned
  const mentionedTools = extractToolsFromText(request.goal)
  const mentionedToolsInTasks = request.tasks.flatMap(t => 
    extractToolsFromText(`${t.name} ${t.details || ''}`)
  )
  const allMentionedTools = [...new Set([...mentionedTools, ...mentionedToolsInTasks])]
  
  // Determine if tool question would be valuable
  const needsToolQuestion = suggestedToolCategories.length > 0 && allMentionedTools.length === 0

  const prompt = `You are an intelligent plan enhancement assistant. Analyze the following plan and generate 0-5 clarification questions that would help improve the plan's accuracy and effectiveness.

GOAL: "${request.goal}"

PLAN SUMMARY: "${request.planSummary}"

TIMELINE: ${request.timelineDays} day${request.timelineDays !== 1 ? 's' : ''}

TASKS (${request.tasks.length} total, ${totalTaskMinutes} minutes total):
${request.tasks.map((t, i) => `${i + 1}. ${t.name} (${t.duration} min, Priority ${t.priority})`).join('\n')}

CAPACITY ANALYSIS:
- Available minutes per day: ${availableMinutesPerDay}
- Average minutes per day needed: ${Math.round(averageMinutesPerDay)}
- Capacity utilization: ${Math.round(capacityUtilization)}%
${capacityUtilization > 90 ? '⚠️ HIGH CAPACITY - Plan may be too ambitious' : capacityUtilization < 50 ? '✓ LOW CAPACITY - Plan has room for more' : '✓ MODERATE CAPACITY - Plan is well-balanced'}

SCHEDULE CONTEXT:
${conflictSummary}
${request.workdaySettings.allowWeekends ? 'User can work on weekends.' : 'User cannot work on weekends.'}
Workday: ${request.workdaySettings.startHour}:00 - ${request.workdaySettings.endHour}:00
Lunch: ${request.workdaySettings.lunchStart}:00 - ${request.workdaySettings.lunchEnd}:00

ANALYSIS CRITERIA:
1. **Capacity Issues**: If capacity utilization > 90%, ask about time availability or willingness to extend timeline
2. **Task Clarity**: If any tasks are vague or could be interpreted multiple ways, ask for specifics
3. **Missing Context**: If plan lacks important details (experience level, resources, constraints), ask about them
4. **Timeline Realism**: If timeline seems tight or loose, ask about flexibility or urgency
5. **Schedule Conflicts**: If there are many conflicts, ask about priority or flexibility
6. **Task Dependencies**: If tasks seem out of order or missing prerequisites, ask about dependencies
7. **Resource Needs**: If tasks require specific tools/materials, ask about availability
8. **Tool/Software Needs**: If tasks suggest tool usage (presentations, design, development, etc.) but no specific tools are mentioned, ask what tools/software the user plans to use. This is CRITICAL for creating accurate, actionable tasks.

TOOL DETECTION ANALYSIS:
${suggestedToolCategories.length > 0 ? `Tasks suggest usage of: ${suggestedToolCategories.join(', ')} tools` : 'No specific tool categories detected'}
${allMentionedTools.length > 0 ? `Tools already mentioned: ${allMentionedTools.join(', ')}` : 'No tools mentioned in goal or tasks'}
${needsToolQuestion ? '⚠️ TOOL QUESTION RECOMMENDED: Tasks suggest tool usage but no specific tools are mentioned. This is a high-value question.' : ''}

DECISION RULES:
- Generate 0-5 questions (fewer is better - only ask what's truly valuable)
- Questions should be SPECIFIC and ACTIONABLE
- Avoid questions already answered by the goal or plan
- Focus on questions that would SIGNIFICANTLY improve plan quality
- If plan is already well-defined, return empty array
- Questions should help refine timeline, task scope, or scheduling

QUESTION TYPE SELECTION (CRITICAL):
Each question MUST specify a "type" field: "single" or "multiple"

Use **"multiple"** (check all that apply) when:
- Question asks about multiple tools/resources/features that can coexist (e.g., "What tools will you use?")
- Question asks "what areas/aspects/features" (plural implies multiple selections possible)
- Question is about priorities/focus areas where multiple selections are meaningful
- Options are NOT mutually exclusive (e.g., users can use PowerPoint AND Google Slides)
- Question asks about resources, constraints, or aspects that can overlap

Use **"single"** (radio button, one choice only) when:
- Question asks for one preference/level/choice (e.g., "What's your experience level?")
- Options are mutually exclusive (e.g., experience levels: Beginner, Intermediate, Advanced)
- Binary/Yes-No questions or timeline flexibility decisions
- Question uses singular form implying one choice (e.g., "How do you prefer to practice?")
- Only one answer can be true at a time

MULTIPLE CHOICE REQUIREMENTS:
- Each question MUST include 2-5 answer options
- The number of options should be appropriate for the question (typically 2-4, use 5 only for complex questions)
- For SINGLE-select questions: Options should be mutually exclusive and cover the most common scenarios
- For MULTIPLE-select questions: Options should NOT be mutually exclusive and users may select multiple
- Always include an "Other" option as the last option to allow custom responses (works for both types)
- Options should be concise (1-2 short phrases each)
- Make options specific and actionable, not vague

EXAMPLES:

SINGLE-SELECT EXAMPLES (type: "single"):
- High capacity (95%): {
    "text": "Would you be able to extend the timeline, or do you have additional time available?",
    "type": "single",
    "options": ["Extend timeline by 1-2 days", "I can add 1-2 hours per day", "I prefer to keep the current timeline", "Other"]
  }
- Missing context: {
    "text": "What's your current experience level with [relevant skill]?",
    "type": "single",
    "options": ["Beginner", "Intermediate", "Advanced", "Expert", "Other"]
  }
- Timeline tight: {
    "text": "Is the ${request.timelineDays}-day timeline firm, or could it be extended if needed?",
    "type": "single",
    "options": ["Timeline is firm, cannot extend", "Can extend by 1-2 days if needed", "Can extend by 3+ days if needed", "Timeline is flexible", "Other"]
  }
- Preference question: {
    "text": "How do you prefer to practice your presentation delivery?",
    "type": "single",
    "options": ["Alone", "With a friend or colleague", "In front of a small group", "Record myself and review", "Other"]
  }

MULTIPLE-SELECT EXAMPLES (type: "multiple"):
- Tool/software question (for presentations) - MULTIPLE: {
    "text": "Do you have any specific tools or software you plan to use for creating slides?",
    "type": "multiple",
    "options": ["PowerPoint", "Google Slides", "Keynote", "Canva", "None", "Other"]
  }
- Tool/software question (for design work) - MULTIPLE: {
    "text": "What design tools will you use for this project?",
    "type": "multiple",
    "options": ["Figma", "Adobe XD", "Sketch", "Canva", "Photoshop", "Other"]
  }
- Focus areas question - MULTIPLE: {
    "text": "What specific aspects of project management should the presentation focus on?",
    "type": "multiple",
    "options": ["Planning and organization", "Execution and delivery", "Team collaboration", "Risk management", "Monitoring and reporting", "Other"]
  }
- Resources question - MULTIPLE: {
    "text": "What resources will you use for research?",
    "type": "multiple",
    "options": ["Online articles and blogs", "Books and publications", "Video tutorials", "Industry reports", "Academic papers", "Other"]
  }
- Vague task areas - MULTIPLE (replaces "All of the above" workaround): {
    "text": "For 'Research best practices', what specific areas should be prioritized?",
    "type": "multiple",
    "options": ["Performance optimization", "Security best practices", "Code structure and patterns", "Scalability", "User experience", "Other"]
  }

Return JSON format:
{
  "questions": [
    {
      "text": "Question text here",
      "type": "single" | "multiple",
      "options": ["Option 1", "Option 2", "Option 3", "Other"]
    }
  ],
  "reasoning": "Brief explanation of why these questions were generated (or why none were needed)"
}

CRITICAL: Every question MUST include a "type" field set to either "single" or "multiple". Default to "single" only if truly uncertain.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an intelligent plan enhancement assistant. Generate 0-5 specific, actionable clarification questions with multiple choice options (2-5 options each, always include "Other" as last option). Each question must specify a "type" field: "single" for radio buttons (one choice) or "multiple" for checkboxes (check all that apply). Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })

    const output = completion.choices[0].message.content
    if (!output) {
      throw new Error('Empty AI response')
    }

    const parsed = JSON.parse(output)

    // Validate response structure
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('AI did not return questions array')
    }

    // Validate and transform questions to include options and type
    const validQuestions = parsed.questions
      .filter((q: any) => {
        if (!q || typeof q !== 'object') return false
        if (typeof q.text !== 'string' || q.text.trim().length === 0) return false
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) return false
        // Ensure all options are strings
        if (!q.options.every((opt: any) => typeof opt === 'string' && opt.trim().length > 0)) return false
        // Validate type if provided
        if (q.type !== undefined && q.type !== 'single' && q.type !== 'multiple') return false
        // Ensure "Other" is included as last option
        const lastOption = q.options[q.options.length - 1]?.toLowerCase().trim()
        if (lastOption !== 'other') {
          // Add "Other" if not present
          q.options.push('Other')
        }
        return true
      })
      .slice(0, 5) // Limit to 5 questions max
      .map((q: any) => ({
        text: q.text.trim(),
        type: (q.type === 'multiple' ? 'multiple' : 'single') as 'single' | 'multiple', // Default to 'single' for backward compatibility
        options: q.options.map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0)
      }))

    return {
      questions: validQuestions,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Questions generated to improve plan quality',
    }
  } catch (error) {
    console.error('Error generating clarification questions:', error)
    // Return empty questions on error rather than failing
    return {
      questions: [],
      reasoning: 'Unable to generate questions at this time',
    }
  }
}
