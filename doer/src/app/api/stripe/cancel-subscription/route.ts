import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Only initialize Stripe if secret key is available (allows build to succeed)
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get user's Stripe customer ID
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!userSettings?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this user' },
        { status: 404 }
      )
    }

    // Find active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: userSettings.stripe_customer_id,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    const subscription = subscriptions.data[0]

    // Verify subscription belongs to user (check metadata)
    if (subscription.metadata?.userId !== user.id) {
      return NextResponse.json(
        { error: 'Subscription does not belong to this user' },
        { status: 403 }
      )
    }

    // Cancel subscription at period end
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })

    // Update database subscription status
    const serviceRoleClient = getServiceRoleClient()
    const periodEnd = (updatedSubscription as any).current_period_end as number | undefined
    const { error: dbError } = await serviceRoleClient
      .from('user_plan_subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true,
        cancel_at: periodEnd 
          ? new Date(periodEnd * 1000).toISOString()
          : null,
      })
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (dbError) {
      console.error('Error updating subscription in database:', dbError)
      // Don't fail the request - Stripe cancellation succeeded
    }

      return NextResponse.json(
        {
          success: true,
          message: 'Subscription will be canceled at the end of the billing period',
          cancelAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        },
        { status: 200 }
      )
  } catch (error) {
    console.error('Error canceling subscription', error)

    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : (error as Error)?.message ?? 'Unexpected server error canceling subscription.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

