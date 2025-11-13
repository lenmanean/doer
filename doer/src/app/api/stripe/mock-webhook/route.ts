import { NextRequest, NextResponse } from 'next/server'

import { assignSubscription, type BillingCycle } from '@/lib/billing/plans'

const PLAN_ASSIGNMENT_ENABLED = (process.env.PLAN_ASSIGNMENT_ENABLED || '').toLowerCase() === 'true'

export async function POST(req: NextRequest) {
  if (!PLAN_ASSIGNMENT_ENABLED) {
    return NextResponse.json(
      { success: false, message: 'Plan assignment disabled' },
      { status: 202 }
    )
  }

  try {
    const body = await req.json()
    const userId: string | undefined = body?.userId
    const planSlug: string | undefined = body?.planSlug
    const cycle: BillingCycle = body?.cycle ?? 'monthly'

    if (!userId || !planSlug) {
      return NextResponse.json(
        { success: false, error: 'userId and planSlug are required' },
        { status: 400 }
      )
    }

    const subscription = await assignSubscription(userId, planSlug, cycle)
    return NextResponse.json({ success: true, subscription })
  } catch (error) {
    console.error('[Mock Stripe Webhook] Assignment failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}




