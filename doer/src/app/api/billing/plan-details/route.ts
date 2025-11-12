import { NextRequest, NextResponse } from 'next/server'
import { getPlanCycleBySlugAndCycle, type BillingCycle } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const planSlug = searchParams.get('planSlug')?.toLowerCase()
    const cycle = (searchParams.get('cycle')?.toLowerCase() || 'monthly') as BillingCycle

    if (!planSlug || !['basic', 'pro'].includes(planSlug)) {
      return NextResponse.json(
        { error: 'Invalid planSlug. Must be "basic" or "pro"' },
        { status: 400 }
      )
    }

    if (!['monthly', 'annual'].includes(cycle)) {
      return NextResponse.json(
        { error: 'Invalid cycle. Must be "monthly" or "annual"' },
        { status: 400 }
      )
    }

    const planCycle = await getPlanCycleBySlugAndCycle(planSlug, cycle)

    return NextResponse.json({
      name: planCycle.plan.name,
      cycle: planCycle.cycle,
      priceCents: planCycle.priceCents,
      apiCreditLimit: planCycle.apiCreditLimit,
      integrationActionLimit: planCycle.integrationActionLimit,
    })
  } catch (error) {
    console.error('Error fetching plan details:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch plan details' },
      { status: 500 }
    )
  }
}

