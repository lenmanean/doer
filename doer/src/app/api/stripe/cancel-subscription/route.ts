import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

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

    // Find active or trialing subscription
    // Check for both active and trialing subscriptions
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: userSettings.stripe_customer_id,
      status: 'active',
      limit: 1,
    })

    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: userSettings.stripe_customer_id,
      status: 'trialing',
      limit: 1,
    })

    const subscription = activeSubscriptions.data[0] || trialingSubscriptions.data[0]

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active or trialing subscription found' },
        { status: 404 }
      )
    }

    // Verify subscription belongs to user (check metadata)
    if (subscription.metadata?.userId !== user.id) {
      return NextResponse.json(
        { error: 'Subscription does not belong to this user' },
        { status: 403 }
      )
    }

    const isTrialing = subscription.status === 'trialing'

    // Cancel subscription at period end
    // For trial subscriptions, this ensures users keep access until trial ends
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })

    // Update database subscription status
    const serviceRoleClient = getServiceRoleClient()
    const periodEnd = (updatedSubscription as any).current_period_end as number | undefined
    const trialEnd = (updatedSubscription as any).trial_end as number | undefined
    
    // For trial subscriptions, use trial_end if available, otherwise use current_period_end
    const cancelAt = trialEnd || periodEnd

    // Update subscription - include both active and trialing statuses
    const { error: dbError } = await serviceRoleClient
      .from('user_plan_subscriptions')
      .update({
        cancel_at_period_end: true,
        cancel_at: cancelAt 
          ? new Date(cancelAt * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .eq('external_subscription_id', subscription.id)

    if (dbError) {
      console.error('Error updating subscription in database:', dbError)
      // Don't fail the request - Stripe cancellation succeeded
    }

      const message = isTrialing
        ? 'Your trial will continue until it ends, then your subscription will be canceled and you will be downgraded to the Basic plan.'
        : 'Subscription will be canceled at the end of the billing period'

      return NextResponse.json(
        {
          success: true,
          message,
          cancelAt: cancelAt ? new Date(cancelAt * 1000).toISOString() : null,
          isTrialing,
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

