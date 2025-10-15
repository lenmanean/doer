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

/**
 * Validates if a goal is realistic for a 365-day timeline
 */
export async function validateGoalFeasibility(goal: string): Promise<{
  isFeasible: boolean
  reasoning: string
}> {
  const prompt = `
You are a goal feasibility validator. Determine if this goal can realistically be achieved within 120 days.

RULES:
- Be PERMISSIVE - only reject truly impossible goals
- Return JSON: { "isFeasible": boolean, "reasoning": "string" }

UNFEASIBLE EXAMPLES:
- "Become a millionaire"
- "Get a PhD"
- "Become a professional athlete in a new sport"

FEASIBLE EXAMPLES:
- "Learn to play guitar"
- "Run a 5K race"
- "Learn basic Spanish"

User Goal: "${goal}"
`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a goal validator. Return only JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    return {
      isFeasible: parsed.isFeasible !== false,
      reasoning: parsed.reasoning || 'Goal appears feasible'
    }
  } catch (error) {
    console.error('Validation error:', error)
    return { isFeasible: true, reasoning: 'Validation failed - assuming feasible' }
  }
}

/**
 * Generate roadmap structure (timeline, milestones, tasks)
 * AI focuses on CONTENT only - no dates or scheduling
 */
export async function generateRoadmapContent(request: AIModelRequest): Promise<{
  timeline_days: number
  goal_title: string
  plan_summary: string
  end_date: string
  milestones: Array<{
    name: string
    rationale: string
  }>
  milestone_tasks: Array<{
    milestone_idx: number
    name: string
    details: string
  }>
  daily_tasks: Array<{
    name: string
    details: string
  }>
}> {
  const prompt = `Create a structured plan for: "${request.goal}"

${request.clarifications ? `CONTEXT: Q1: ${request.clarificationQuestions?.[0]} → ${request.clarifications.clarification_1} | Q2: ${request.clarificationQuestions?.[1]} → ${request.clarifications.clarification_2}
Adjust: Prior experience = shorter timeline, beginner = longer timeline` : ''}

TIMELINE (Choose SHORTEST realistic):
• 1-7d: Simple tasks (organize, write resume, basic skill)
• 7-21d: Small skills (cooking, DIY, fitness start, photo editing)
• 21-45d: Moderate skills (guitar, coding basics, habits, couch-to-5K)
• 45-90d: Comprehensive (language basics, major habits, competitions)
• 90-120d: RARE - only genuinely complex goals
Default SHORT. Max 120 days. Bias toward faster completion.

STRUCTURE (STRICT MINIMUMS):
1. Milestones: 1-5 based on timeline
   - 1-7d: 1-2 milestones
   - 8-21d: 2-3 milestones
   - 22-45d: 3-4 milestones
   - 46-90d: 4-5 milestones
   - 90+d: 5 milestones

2. Milestone tasks: 1-4 per milestone
   - Each milestone needs AT LEAST 1 task
   - Total milestone_tasks ≥ milestones
   - Example: 3 milestones = minimum 3 milestone tasks
   - Use 1 task for simple milestones, 2-4 for complex ones

3. Daily tasks: EXACTLY (timeline_days - 2)
   - Example: 21 days = 19 daily tasks (EXACT)

4. Title: 3-6 words, catchy
5. Summary: max 14 words

START: ${request.start_date}

JSON FORMAT:
{
  "timeline_days": <number>,
  "goal_title": "3-6 word title",
  "plan_summary": "14 word max summary",
  "end_date": "YYYY-MM-DD",
  "milestones": [{"name": "Descriptive action phrase", "rationale": "why it matters"}],
  "milestone_tasks": [{"milestone_idx": 1, "name": "Specific action", "details": "clear steps"}],
  "daily_tasks": [{"name": "Specific activity", "details": "actionable daily task"}]
}

CRITICAL VALIDATION BEFORE RESPONDING:
✓ milestone_tasks.length ≥ milestones.length (MINIMUM 1 per milestone)
✓ daily_tasks.length = timeline_days - 2 (EXACT)
✓ Names = specific actions (NOT "Milestone 1", "Task 1")
✓ end_date = start_date + timeline_days
✓ Timeline biased SHORT
✓ All tasks unique & actionable`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Roadmap generator. Return valid JSON. CRITICAL: 1) milestone_tasks.length ≥ milestones.length (MINIMUM 1 per milestone), 2) daily_tasks.length = timeline_days - 2 (EXACT), 3) Descriptive names (NOT "Milestone 1" or "Task 1"), 4) Bias SHORT timelines for quick plans' },
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
    end_date: parsed.end_date,
    milestones: parsed.milestones?.length,
    milestone_tasks: parsed.milestone_tasks?.length,
    daily_tasks: parsed.daily_tasks?.length,
    expected_daily: parsed.timeline_days - 2
  })

  // Validate AI included end_date
  if (!parsed.end_date) {
    throw new Error('AI did not generate end_date')
  }

  return parsed
}
