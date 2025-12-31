// src/app/api/plans/adjust-timeline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/ai'
import { TimelineAdjustmentRequest } from '@/lib/types'
import { authenticateApiRequest, ApiTokenError } from '@/lib/auth/api-token-auth'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'

// Force dynamic rendering since we use cookies for authentication (session auth fallback)
export const dynamic = 'force-dynamic'

const TIMELINE_ADJUSTMENT_CREDIT_COST = 1 // 1 OpenAI call: redistributeTasksAcrossTimeline

export async function POST(request: NextRequest) {
  let reserved = false
  let authContext: Awaited<ReturnType<typeof authenticateApiRequest>> | null = null
  let sessionUser: any = null // Store user from session auth to avoid re-fetching

  try {
    // Authenticate user via API token or session
    try {
      authContext = await authenticateApiRequest(request.headers, {
        requiredScopes: [], // No specific scope required for timeline adjustment
      })
      // Reserve credits for OpenAI call
      await authContext.creditService.reserve('api_credits', TIMELINE_ADJUSTMENT_CREDIT_COST, {
        route: 'plans.adjust-timeline',
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
      await creditService.reserve('api_credits', TIMELINE_ADJUSTMENT_CREDIT_COST, {
        route: 'plans.adjust-timeline',
      })
      reserved = true
      // Store user for later use (avoid re-fetching)
      sessionUser = user
    }

    // Get user - for session auth we already have it, for API token auth we need to fetch it
    const supabase = await createClient()
    let user = sessionUser
    if (!user) {
      // Need to fetch full user object (API token auth case)
      const {
        data: { user: fetchedUser },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !fetchedUser) {
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TIMELINE_ADJUSTMENT_CREDIT_COST, {
          route: 'plans.adjust-timeline',
          reason: 'user_not_authenticated',
        })
        reserved = false
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = fetchedUser
    }

    const body: TimelineAdjustmentRequest = await request.json()
    const { planId, newDuration, tasks } = body

    // Verify plan ownership
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TIMELINE_ADJUSTMENT_CREDIT_COST, {
          route: 'plans.adjust-timeline',
          reason: 'plan_not_found',
        })
        reserved = false
      }
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Generate AI-powered timeline redistribution
    const adjustedTasks = await redistributeTasksAcrossTimeline(tasks, newDuration, plan.start_date)

    // Commit credit after successful OpenAI call
    if (reserved && authContext) {
      await authContext.creditService.commit('api_credits', TIMELINE_ADJUSTMENT_CREDIT_COST, {
        route: 'plans.adjust-timeline',
        model: 'gpt-4o-mini',
      })
      reserved = false
    }

    // Update plan end date
    const startDate = new Date(plan.start_date)
    const newEndDate = new Date(startDate)
    newEndDate.setDate(startDate.getDate() + newDuration - 1)

    const { error: updateError } = await supabase
      .from('plans')
      .update({
        end_date: newEndDate.toISOString().split('T')[0],
        timeline_days: newDuration
      })
      .eq('id', planId)

    if (updateError) {
      console.error('Error updating plan:', updateError)
      return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      adjustedTasks,
      newEndDate: newEndDate.toISOString().split('T')[0],
      timelineDays: newDuration
    })

  } catch (error) {
    console.error('Timeline adjustment error:', error)
    
    // Release credit on error
    if (reserved && authContext) {
      await authContext.creditService.release('api_credits', TIMELINE_ADJUSTMENT_CREDIT_COST, {
        route: 'plans.adjust-timeline',
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

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Use AI to redistribute tasks across a new timeline
 */
async function redistributeTasksAcrossTimeline(
  tasks: any[],
  newDuration: number,
  startDate: string
): Promise<any[]> {
  const prompt = `Redistribute these tasks across a new timeline of ${newDuration} days.

ORIGINAL TASKS:
${tasks.map((task, i) => `${i + 1}. ${task.name} (${task.estimated_duration_minutes} min, Priority ${task.priority || 3})`).join('\n')}

NEW TIMELINE: ${newDuration} days starting ${startDate}

REDISTRIBUTION RULES:
1. Maintain task order and priority-based scheduling
2. Distribute tasks evenly across available days
3. Consider task priority when spacing (Priority 1 tasks first, then 2, 3, 4)
4. Ensure realistic daily workload (max 7 hours per day)
5. Add buffer time between complex/long tasks
6. Group related tasks when possible

RETURN JSON:
{
  "redistributed_tasks": [
    {
      "task_index": 0,
      "name": "Task name",
      "estimated_duration_minutes": 60,
      "priority": 2,
      "suggested_day": 1,
      "suggested_time": "09:00",
      "rationale": "Why this placement"
    }
  ]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a task scheduling expert. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    return parsed.redistributed_tasks || []

  } catch (error) {
    console.error('AI redistribution error:', error)
    // Fallback: simple even distribution
    return tasks.map((task, index) => ({
      task_index: index,
      name: task.name,
      estimated_duration_minutes: task.estimated_duration_minutes,
      priority: task.priority || 3,
      suggested_day: Math.floor((index / tasks.length) * newDuration) + 1,
      suggested_time: '09:00',
      rationale: 'Even distribution fallback'
    }))
  }
}





















