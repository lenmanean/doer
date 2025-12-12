import { NextRequest, NextResponse } from 'next/server'

import { assignSubscription, type BillingCycle } from '@/lib/billing/plans'
import { logger } from '@/lib/logger'

/**
 * Mock webhook endpoint for testing plan assignment
 * In production, plan assignment always happens via the real Stripe webhook
 */
export async function POST(req: NextRequest) {
  let userId: string | undefined
  let planSlug: string | undefined
  let cycle: BillingCycle = 'monthly'

  try {
    const body = await req.json()
    userId = body?.userId
    planSlug = body?.planSlug
    cycle = (body?.cycle ?? 'monthly') as BillingCycle

    if (!userId || !planSlug) {
      return NextResponse.json(
        { success: false, error: 'userId and planSlug are required' },
        { status: 400 }
      )
    }

    const subscription = await assignSubscription(userId, planSlug, cycle)
    return NextResponse.json({ success: true, subscription })
  } catch (error) {
    logger.error('Mock Stripe Webhook assignment failed', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId,
      planSlug,
      cycle,
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}





