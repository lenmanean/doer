import { NextRequest, NextResponse } from 'next/server'

import { authenticateApiRequest, ApiTokenError } from '@/lib/auth/api-token-auth'
import { analyzeClarificationNeeds, evaluateGoalFeasibility } from '@/lib/ai'
import { UsageLimitExceeded } from '@/lib/usage/credit-service'

export async function POST(req: NextRequest) {
  let reserved = false
  let authContext: Awaited<ReturnType<typeof authenticateApiRequest>> | null = null

  try {
    authContext = await authenticateApiRequest(req.headers, {
      requiredScopes: ['clarify'],
    })

    await authContext.creditService.reserve('api_credits', 1, {
      route: 'clarify',
    })
    reserved = true

    const body = await req.json()
    const { goal } = body

    if (!goal || !goal.trim()) {
      await authContext.creditService.release('api_credits', 1, {
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

    const feasibility = await evaluateGoalFeasibility(trimmedGoal)
    console.log('🧠 Clarify route feasibility evaluation:', feasibility)
    if (!feasibility.isFeasible) {
      await authContext.creditService.release('api_credits', 1, {
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

    const clarificationNeeds = await analyzeClarificationNeeds(trimmedGoal)

    await authContext.creditService.commit('api_credits', 1, {
      route: 'clarify',
      model: 'gpt-4o-mini',
    })
    reserved = false

    return NextResponse.json({
      success: true,
      needsClarification: clarificationNeeds.needsClarification,
      questions: clarificationNeeds.questions,
    })
  } catch (error) {
    console.error('Error analyzing clarification needs:', error)

    if (reserved && authContext) {
      await authContext.creditService
        .release('api_credits', 1, {
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





