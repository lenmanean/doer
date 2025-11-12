import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { assignSubscription, type BillingCycle } from '@/lib/billing/plans'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const PLAN_ASSIGNMENT_ENABLED =
  (process.env.PLAN_ASSIGNMENT_ENABLED || '').toLowerCase() === 'true'

// Only initialize Stripe if secret key is available (allows build to succeed)
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * Converts Stripe's recurring interval to our BillingCycle enum
 * Stripe uses "month" and "year", but our enum expects "monthly" and "annual"
 * Also handles case-insensitive matching and partial matches
 */
function convertStripeIntervalToBillingCycle(
  interval: string | undefined | null
): BillingCycle {
  if (!interval) {
    return 'monthly'
  }
  
  const normalized = interval.toLowerCase().trim()
  
  // Handle exact matches
  if (normalized === 'month' || normalized === 'monthly') {
    return 'monthly'
  }
  if (normalized === 'year' || normalized === 'yearly' || normalized === 'annual') {
    return 'annual'
  }
  
  // Handle partial matches (e.g., "monthly" contains "month")
  if (normalized.includes('month')) {
    return 'monthly'
  }
  if (normalized.includes('year') || normalized.includes('annual')) {
    return 'annual'
  }
  
  // Default to monthly if interval is not recognized
  console.warn(`[Stripe webhook] Unknown billing interval: "${interval}", defaulting to "monthly"`)
  return 'monthly'
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
  }

  if (!PLAN_ASSIGNMENT_ENABLED) {
    return NextResponse.json({ success: false, message: 'Plan assignment disabled' }, { status: 202 })
  }

  if (!webhookSecret) {
    return NextResponse.json({ success: false, error: 'Webhook secret not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ success: false, error: 'Missing Stripe signature header' }, { status: 400 })
  }

  const payload = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error('[Stripe webhook] Invalid signature', error)
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata || {}

        const userId = metadata.userId
        const planSlug = metadata.planSlug
        const metadataBillingCycle = metadata.billingCycle as string | undefined
        // Validate and convert billing cycle - metadata might contain "month" instead of "monthly"
        let billingCycle: BillingCycle = 'monthly'
        if (metadataBillingCycle && ['monthly', 'annual'].includes(metadataBillingCycle)) {
          // Metadata has valid billing cycle
          billingCycle = metadataBillingCycle as BillingCycle
        } else if (metadataBillingCycle) {
          // Metadata has billing cycle but it's in wrong format (e.g., "month" or "year")
          billingCycle = convertStripeIntervalToBillingCycle(metadataBillingCycle)
        }

        if (!userId || !planSlug) {
          console.warn('[Stripe webhook] Missing userId/planSlug in session metadata', {
            sessionId: session.id,
            metadata,
          })
          break
        }

        await assignSubscription(userId, planSlug, billingCycle)
        console.log('[Stripe webhook] Assigned subscription via checkout.session.completed', {
          userId,
          planSlug,
          billingCycle,
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}
        const userId = metadata.userId
        const planSlug = metadata.planSlug
        // Get billing cycle from Stripe's interval (month/year) or metadata, converting as needed
        const stripeInterval = subscription.items.data[0]?.price?.recurring?.interval
        const metadataBillingCycle = metadata.billingCycle as string | undefined
        // Validate and convert billing cycle - metadata might contain "month" instead of "monthly"
        let billingCycle: BillingCycle = 'monthly'
        if (metadataBillingCycle && ['monthly', 'annual'].includes(metadataBillingCycle)) {
          // Metadata has valid billing cycle
          billingCycle = metadataBillingCycle as BillingCycle
        } else if (metadataBillingCycle) {
          // Metadata has billing cycle but it's in wrong format (e.g., "month" or "year")
          billingCycle = convertStripeIntervalToBillingCycle(metadataBillingCycle)
        } else if (stripeInterval) {
          // Use Stripe's interval and convert it
          billingCycle = convertStripeIntervalToBillingCycle(stripeInterval)
        }

        if (!userId || !planSlug) {
          console.log('[Stripe webhook] Subscription event without metadata, ignoring', {
            subscriptionId: subscription.id,
          })
          break
        }

        // Check if subscription already assigned (idempotency)
        const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
        const supabase = getServiceRoleClient()
        const { data: existing } = await supabase
          .from('user_plan_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()

        if (existing && subscription.status === 'active') {
          console.log('[Stripe webhook] Subscription already assigned, skipping', {
            userId,
            subscriptionId: subscription.id,
          })
          break
        }

        await assignSubscription(userId, planSlug, billingCycle)
        console.log('[Stripe webhook] Assigned subscription via subscription event', {
          userId,
          planSlug,
          billingCycle,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}
        const userId = metadata.userId

        if (userId) {
          const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
          const supabase = getServiceRoleClient()
          await supabase
            .from('user_plan_subscriptions')
            .update({ status: 'canceled' })
            .eq('user_id', userId)
            .eq('status', 'active')

          console.log('[Stripe webhook] Marked subscription as canceled', {
            userId,
            subscriptionId: subscription.id,
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = typeof (invoice as any).subscription === 'string' 
          ? (invoice as any).subscription 
          : (invoice as any).subscription?.id

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const metadata = subscription.metadata || {}
          const userId = metadata.userId

          if (userId) {
            const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
            const supabase = getServiceRoleClient()
            await supabase
              .from('user_plan_subscriptions')
              .update({ status: 'past_due' })
              .eq('user_id', userId)
              .eq('status', 'active')

            console.log('[Stripe webhook] Marked subscription as past_due', {
              userId,
              subscriptionId,
            })
          }
        }
        break
      }

      case 'invoice.payment_succeeded':
        // Payment succeeded events are informative – assignment already handled elsewhere.
        break

      default:
        console.log('[Stripe webhook] Unhandled event type', event.type)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Stripe webhook] Handler error', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



