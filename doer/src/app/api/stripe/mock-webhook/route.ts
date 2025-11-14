import { NextRequest, NextResponse } from 'next/server'

import { assignSubscription, type BillingCycle } from '@/lib/billing/plans'
import { logger } from '@/lib/logger'

const PLAN_ASSIGNMENT_ENABLED = (process.env.PLAN_ASSIGNMENT_ENABLED || '').toLowerCase() === 'true'

export async function POST(req: NextRequest) {
  let userId: string | undefined
  let planSlug: string | undefined
  let cycle: BillingCycle = 'monthly'

  if (!PLAN_ASSIGNMENT_ENABLED) {
    return NextResponse.json(
      { success: false, message: 'Plan assignment disabled' },
      { status: 202 }
    )
  }

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
    logger.error('Mock Stripe Webhook assignment failed', error as Error, { userId, planSlug, cycle })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}





