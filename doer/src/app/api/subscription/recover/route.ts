import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { assignSubscription, type BillingCycle } from '@/lib/billing/plans'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * POST /api/subscription/recover
 * Recovers missing subscriptions from Stripe and saves them to the database
 * This is a one-time recovery mechanism for subscriptions that were created
 * in Stripe but not saved to the database due to the billing plans seeding issue
 */
export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get user's Stripe customer ID from user_settings
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!userSettings?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer ID found for this user' },
        { status: 404 }
      )
    }

    const stripeCustomerId = userSettings.stripe_customer_id

    // Fetch all active subscriptions from Stripe for this customer
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all', // Get all subscriptions (active, canceled, etc.)
      limit: 100,
    })

    if (stripeSubscriptions.data.length === 0) {
      return NextResponse.json(
        { 
          message: 'No subscriptions found in Stripe for this customer',
          recovered: 0 
        },
        { status: 200 }
      )
    }

    // Check which subscriptions are missing from the database
    const { data: existingSubscriptions } = await supabase
      .from('user_plan_subscriptions')
      .select('external_subscription_id')
      .eq('user_id', user.id)

    const existingStripeIds = new Set(
      existingSubscriptions?.map(s => s.external_subscription_id).filter(Boolean) || []
    )

    const recovered: Array<{
      stripeSubscriptionId: string
      planSlug: string
      billingCycle: string
      status: string
    }> = []
    const errors: Array<{
      stripeSubscriptionId: string
      error: string
    }> = []

    // Process each Stripe subscription
    for (const stripeSubscription of stripeSubscriptions.data) {
      // Skip if already in database
      if (existingStripeIds.has(stripeSubscription.id)) {
        continue
      }

      // Extract plan information from subscription metadata or price
      const metadata = stripeSubscription.metadata || {}
      let planSlug = metadata.planSlug
      let billingCycle = metadata.billingCycle as BillingCycle | undefined

      // If not in metadata, try to infer from price
      if (!planSlug || !billingCycle) {
        const price = stripeSubscription.items.data[0]?.price
        if (price) {
          // Check price ID against environment variables
          const priceId = price.id
          if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
            planSlug = 'pro'
            billingCycle = 'monthly'
          } else if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
            planSlug = 'pro'
            billingCycle = 'annual'
          } else if (priceId === process.env.STRIPE_PRICE_BASIC) {
            planSlug = 'basic'
            billingCycle = 'monthly'
          } else {
            // Try to infer from interval
            const interval = price.recurring?.interval
            if (interval === 'month') {
              billingCycle = 'monthly'
            } else if (interval === 'year') {
              billingCycle = 'annual'
            }
            // Default to pro if we can't determine
            if (!planSlug) {
              planSlug = 'pro'
            }
          }
        }
      }

      // If still can't determine, skip
      if (!planSlug || !billingCycle) {
        errors.push({
          stripeSubscriptionId: stripeSubscription.id,
          error: 'Could not determine plan slug or billing cycle from Stripe subscription',
        })
        continue
      }

      // Map Stripe status to our status
      const mapStatus = (stripeStatus: string) => {
        const normalized = stripeStatus.toLowerCase().trim()
        switch (normalized) {
          case 'trialing':
            return 'trialing'
          case 'active':
            return 'active'
          case 'past_due':
            return 'past_due'
          case 'canceled':
          case 'unpaid':
          case 'incomplete':
          case 'incomplete_expired':
            return 'canceled'
          default:
            return 'active'
        }
      }

      // Format Stripe timestamp to date string
      const formatDate = (timestamp: number | null | undefined): string | undefined => {
        if (!timestamp) return undefined
        const date = new Date(timestamp * 1000)
        return date.toISOString().split('T')[0]
      }

      try {
        // Assign subscription to database
        await assignSubscription(user.id, planSlug, billingCycle, {
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          status: mapStatus(stripeSubscription.status),
          currentPeriodStart: formatDate((stripeSubscription as any).current_period_start),
          currentPeriodEnd: formatDate((stripeSubscription as any).current_period_end),
        })

        recovered.push({
          stripeSubscriptionId: stripeSubscription.id,
          planSlug,
          billingCycle,
          status: mapStatus(stripeSubscription.status),
        })
      } catch (error) {
        errors.push({
          stripeSubscriptionId: stripeSubscription.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return NextResponse.json({
      success: true,
      recovered: recovered.length,
      total: stripeSubscriptions.data.length,
      alreadyExists: existingStripeIds.size,
      recoveredSubscriptions: recovered,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 200 })

  } catch (error) {
    console.error('[Recover Subscription] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to recover subscriptions',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

