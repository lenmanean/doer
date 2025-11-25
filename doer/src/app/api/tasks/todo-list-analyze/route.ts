import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/ai'
import { authenticateApiRequest, ApiTokenError } from '@/lib/auth/api-token-auth'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'

// Force dynamic rendering since we use cookies for authentication (session auth fallback)
export const dynamic = 'force-dynamic'

const TODO_LIST_ANALYZE_CREDIT_COST = 1 // 1 OpenAI call: analyze tasks

export async function POST(req: NextRequest) {
  let reserved = false
  let authContext: Awaited<ReturnType<typeof authenticateApiRequest>> | null = null

  try {
    // Authenticate user via API token or session
    try {
      authContext = await authenticateApiRequest(req.headers, {
        requiredScopes: [], // No specific scope required for todo list analysis
      })
      // Reserve credits for OpenAI call
      await authContext.creditService.reserve('api_credits', TODO_LIST_ANALYZE_CREDIT_COST, {
        route: 'tasks.todo-list-analyze',
      })
      reserved = true
    } catch (authError) {
      // If API token auth fails, try session auth (for web UI)
      const supabase = await createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
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
      await creditService.reserve('api_credits', TODO_LIST_ANALYZE_CREDIT_COST, {
        route: 'tasks.todo-list-analyze',
      })
      reserved = true
    }

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError || !user) {
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TODO_LIST_ANALYZE_CREDIT_COST, {
          route: 'tasks.todo-list-analyze',
          reason: 'user_not_authenticated',
        })
        reserved = false
      }
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { tasks } = body

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TODO_LIST_ANALYZE_CREDIT_COST, {
          route: 'tasks.todo-list-analyze',
          reason: 'validation_error',
        })
        reserved = false
      }
      return NextResponse.json(
        { error: 'Tasks array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate tasks
    const validTasks = tasks.filter((t: any) => t.name && t.name.trim())
    if (validTasks.length === 0) {
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TODO_LIST_ANALYZE_CREDIT_COST, {
          route: 'tasks.todo-list-analyze',
          reason: 'validation_error',
        })
        reserved = false
      }
      return NextResponse.json(
        { error: 'At least one task with a name is required' },
        { status: 400 }
      )
    }

    // Build prompt for AI analysis
    const tasksList = validTasks.map((t: any, idx: number) => 
      `${idx + 1}. ${t.name}${t.priority ? ` (Priority: ${t.priority})` : ''}`
    ).join('\n')

    const prompt = `Analyze these tasks and determine realistic duration estimates for each one.

TASKS:
${tasksList}

DURATION ESTIMATION RULES:
• Determine EXACT duration for each task based on complexity and context
• NO hardcoded durations - analyze the specific task
• Range: 5-360 minutes per task
• BE REALISTIC: Simple tasks like "spread peanut butter" = 1-2 minutes, not 10 minutes
• BE REALISTIC: "Gather ingredients" = 2-5 minutes, not 15 minutes
• BE REALISTIC: "Assemble sandwich" = 1-2 minutes, not 5 minutes
• Think about how long YOU would actually take to do each task
• EXAMPLES: "Heat pan" = 2-3 min, "Slice bread" = 1-2 min, "Butter bread" = 1 min, "Flip sandwich" = 30 seconds
• Complex tasks like "Write research paper" = 120-360 minutes
• Medium tasks like "Review document" = 30-60 minutes
• Quick tasks like "Send email" = 5-15 minutes

PRIORITY ASSIGNMENT (if not provided):
• Priority 1 (Critical): Foundation tasks that block other work, core functionality, dependencies (must be done first)
• Priority 2 (High): Important tasks that enable progress, key features, learning prerequisites (should be done early)
• Priority 3 (Medium): Valuable tasks that enhance the project, nice-to-have features, optimization (can be done later)
• Priority 4 (Low): Optional tasks, polish, documentation, nice-to-have additions (can be done last)

TASK DETAILS:
• Generate a brief description/details for each task (1-2 sentences)
• Focus on what needs to be accomplished

RETURN JSON FORMAT:
{
  "tasks": [
    {
      "name": "Task name exactly as provided",
      "details": "Brief description of what this task involves",
      "duration_minutes": 60,
      "priority": 1
    }
  ]
}

Return only valid JSON.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a task analysis expert. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      })

      const parsed = JSON.parse(completion.choices[0].message.content || '{}')
      
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new Error('Invalid response format from AI')
      }

      // Validate and ensure all tasks have required fields
      const analyzedTasks = parsed.tasks.map((task: any, idx: number) => {
        // Use original task name if AI changed it
        const originalTask = validTasks[idx]
        return {
          name: originalTask.name,
          details: task.details || '',
          duration_minutes: Math.max(5, Math.min(360, task.duration_minutes || 30)),
          priority: task.priority || originalTask.priority || 3
        }
      })

      // Commit credit after successful OpenAI call
      if (reserved && authContext) {
        await authContext.creditService.commit('api_credits', TODO_LIST_ANALYZE_CREDIT_COST, {
          route: 'tasks.todo-list-analyze',
          model: 'gpt-4o-mini',
        })
        reserved = false
      }

      return NextResponse.json({
        success: true,
        tasks: analyzedTasks
      })
    } catch (aiError) {
      console.error('AI analysis error:', aiError)
      
      // Release credit on error
      if (reserved && authContext) {
        await authContext.creditService.release('api_credits', TODO_LIST_ANALYZE_CREDIT_COST, {
          route: 'tasks.todo-list-analyze',
          reason: 'ai_error',
          error: aiError instanceof Error ? aiError.message : 'Unknown error',
        }).catch((releaseError) => {
          console.error('Failed to release credit:', releaseError)
        })
        reserved = false
      }
      
      return NextResponse.json(
        { error: 'Failed to analyze tasks with AI' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Todo list analyze error:', error)
    
    // Release credit on error
    if (reserved && authContext) {
      await authContext.creditService.release('api_credits', TODO_LIST_ANALYZE_CREDIT_COST, {
        route: 'tasks.todo-list-analyze',
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
          message: 'You have exhausted your API credits for this billing cycle.',
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
      { error: error instanceof Error ? error.message : 'Failed to analyze tasks' },
      { status: 500 }
    )
  }
}














