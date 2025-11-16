import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'

// Force dynamic rendering since this route uses searchParams
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/check-subscription?userId=xxx
 * Admin endpoint to check subscription data for a user
 * This is a temporary diagnostic endpoint
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = getServiceRoleClient()

    // Check billing plans
    const { data: billingPlans, error: plansError } = await supabase
      .from('billing_plans')
      .select('*')
      .order('slug')

    // Check billing plan cycles
    const { data: planCycles, error: cyclesError } = await supabase
      .from('billing_plan_cycles')
      .select(`
        *,
        billing_plan:billing_plans (
          slug,
          name
        )
      `)
      .order('cycle')

    // Check user subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_plan_subscriptions')
      .select(`
        *,
        billing_plan_cycles!inner (
          cycle,
          api_credit_limit,
          integration_action_limit,
          price_cents,
          billing_plan:billing_plans (
            slug,
            name
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Check user settings for Stripe customer ID
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('stripe_customer_id, user_id, first_name, last_name, email')
      .eq('user_id', userId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      userId,
      billingPlans: {
        data: billingPlans,
        error: plansError?.message,
        count: billingPlans?.length || 0,
      },
      planCycles: {
        data: planCycles,
        error: cyclesError?.message,
        count: planCycles?.length || 0,
      },
      subscriptions: {
        data: subscriptions,
        error: subsError?.message,
        count: subscriptions?.length || 0,
      },
      userSettings: {
        data: userSettings,
        error: settingsError?.message,
        hasStripeCustomerId: !!userSettings?.stripe_customer_id,
      },
    }, { status: 200 })

  } catch (error) {
    console.error('[Check Subscription] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check subscription data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

