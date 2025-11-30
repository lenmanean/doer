import { NextRequest, NextResponse } from 'next/server'

import { authenticateApiRequest, ApiTokenError } from '@/lib/auth/api-token-auth'
import { analyzeClarificationNeeds, evaluateGoalFeasibility } from '@/lib/ai'
import { UsageLimitExceeded, CreditService } from '@/lib/usage/credit-service'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication (session auth fallback)
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let reserved = false
  let authContext: Awaited<ReturnType<typeof authenticateApiRequest>> | null = null
  let creditService: CreditService | null = null
  let userId: string | null = null
  const CLARIFY_CREDIT_COST = 2 // 2 OpenAI calls: evaluateGoalFeasibility + analyzeClarificationNeeds

  try {
    // Try API token authentication first (for external API calls)
    try {
      authContext = await authenticateApiRequest(req.headers, {
        requiredScopes: ['clarify'],
      })
      creditService = authContext.creditService
      userId = authContext.userId
    } catch (apiTokenError) {
      // Fall back to session-based authentication (for browser requests)
      if (apiTokenError instanceof ApiTokenError) {
        const supabase = await createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          return NextResponse.json(
            { error: 'API_TOKEN_ERROR', message: 'Authorization header missing or invalid. Please sign in to continue.' },
            { status: 401 }
          )
        }
        
        userId = user.id
        creditService = new CreditService(userId)
      } else {
        throw apiTokenError
      }
    }

    await creditService.reserve('api_credits', CLARIFY_CREDIT_COST, {
      route: 'clarify',
    })
    reserved = true

    const body = await req.json()
    const { goal, clarifications } = body

    if (!goal || !goal.trim()) {
      await creditService!.release('api_credits', CLARIFY_CREDIT_COST, {
        route: 'clarify',
        reason: 'validation_error',
      })
      reserved = false

      return NextResponse.json(
        { error: 'Goal text is required' },
        { status: 400 }
      )
    }

    const trimmedGoal = goal.trim()

    // Pass clarifications to AI functions for full contextual awareness
    const feasibility = await evaluateGoalFeasibility(trimmedGoal, clarifications)
    console.log('🧠 Clarify route feasibility evaluation:', feasibility)
    if (!feasibility.isFeasible) {
      await creditService!.release('api_credits', CLARIFY_CREDIT_COST, {
        route: 'clarify',
        reason: 'goal_not_feasible',
      })
      reserved = false

      return NextResponse.json({
        success: false,
        needsClarification: false,
        questions: [],
        error: 'GOAL_NOT_FEASIBLE',
        message: feasibility.reasoning || 'Goal is not realistically achievable within 21 days. Please narrow your goal before proceeding.',
      }, { status: 400 })
    }

    const clarificationNeeds = await analyzeClarificationNeeds(trimmedGoal, clarifications)

    await creditService!.commit('api_credits', CLARIFY_CREDIT_COST, {
      route: 'clarify',
      model: 'gpt-4o-mini',
      calls: 2, // evaluateGoalFeasibility + analyzeClarificationNeeds
    })
    reserved = false

    return NextResponse.json({
      success: true,
      needsClarification: clarificationNeeds.needsClarification,
      questions: clarificationNeeds.questions,
    })
  } catch (error) {
    console.error('Error analyzing clarification needs:', error)

    if (reserved && creditService) {
      await creditService
        .release('api_credits', CLARIFY_CREDIT_COST, {
          route: 'clarify',
          reason: 'exception',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .catch((releaseError) => {
          console.error('Failed to release clarification credit reservation:', releaseError)
        })
    }

    if (error instanceof UsageLimitExceeded) {
      return NextResponse.json(
        {
          error: 'USAGE_LIMIT_EXCEEDED',
          message: 'You have exhausted your clarification credits for this billing cycle.',
          remaining: error.remaining,
        },
        { status: 429 }
      )
    }

    if (error instanceof ApiTokenError) {
      return NextResponse.json(
        { error: 'API_TOKEN_ERROR', message: error.message },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { error: 'Failed to analyze goal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}







