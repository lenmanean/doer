import { NextRequest, NextResponse } from 'next/server'
import { getPlanCycleBySlugAndCycle, type BillingCycle } from '@/lib/billing/plans'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubscriptionFromStripe } from '@/lib/stripe/subscriptions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const planSlug = searchParams.get('planSlug')?.toLowerCase()
  const cycle = (searchParams.get('cycle')?.toLowerCase() || 'monthly') as BillingCycle

  try {
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

    // Check if user is authenticated and already has this plan
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      try {
        const currentSubscription = await getActiveSubscriptionFromStripe(user.id)
        if (currentSubscription && 
            currentSubscription.planSlug === planSlug && 
            currentSubscription.billingCycle === cycle &&
            (currentSubscription.status === 'active' || currentSubscription.status === 'trialing')) {
          return NextResponse.json(
            { 
              error: `You already have an active ${planSlug} plan (${cycle}). You cannot subscribe to the same plan again.`,
              alreadySubscribed: true,
              currentPlan: {
                planSlug: currentSubscription.planSlug,
                billingCycle: currentSubscription.billingCycle,
                status: currentSubscription.status,
              }
            },
            { status: 400 }
          )
        }
      } catch (subscriptionError) {
        // If we can't check subscription, continue anyway (might be first subscription)
        console.warn('Could not check existing subscription:', subscriptionError)
      }
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch plan details'
    
    // Provide helpful error message for missing plan cycles
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { 
          error: `Billing plan cycle "${planSlug || 'unknown'}" (${cycle}) not found. Please ensure the plan is properly configured in the database.`,
          details: errorMessage
        },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

