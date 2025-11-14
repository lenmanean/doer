import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { initializeUsageBalances } from '@/lib/usage/initialize-balances'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Only initialize Stripe if secret key is available (allows build to succeed)
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * Extracts customer ID from Stripe subscription object
 * Customer can be a string ID or a Customer object
 */
function extractCustomerId(subscription: Stripe.Subscription | Stripe.Checkout.Session): string | null {
  if (typeof subscription.customer === 'string') {
    return subscription.customer
  }
  if (subscription.customer && typeof subscription.customer === 'object' && 'id' in subscription.customer) {
    return subscription.customer.id
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
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
        const stripeCustomerId = extractCustomerId(session)
        
        // Extract user ID from metadata
        const userId = session.metadata?.userId
        
        if (!userId) {
          console.warn('[Stripe webhook] Missing userId in checkout session metadata', {
            sessionId: session.id,
          })
          break
        }

        // Update user_settings.stripe_customer_id (needed for Stripe lookups)
        if (stripeCustomerId) {
          const supabase = getServiceRoleClient()
          await supabase
            .from('user_settings')
            .upsert({
              user_id: userId,
              stripe_customer_id: stripeCustomerId,
            }, {
              onConflict: 'user_id',
            })
          console.log('[Stripe webhook] Updated stripe_customer_id:', {
            userId,
            stripeCustomerId,
          })
        }
        
        // Initialize usage balances for the new subscription
        try {
          await initializeUsageBalances(userId)
          console.log('[Stripe webhook] Initialized usage balances for user:', userId)
        } catch (error) {
          console.error('[Stripe webhook] Failed to initialize usage balances:', error)
          // Don't fail the webhook - balances will be initialized on first use
        }
        
        console.log('[Stripe webhook] Checkout completed - subscription will be queried from Stripe when needed')
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const stripeCustomerId = extractCustomerId(subscription)
        const userId = subscription.metadata?.userId
        
        // Update stripe_customer_id if we have it
        if (stripeCustomerId && userId) {
          const supabase = getServiceRoleClient()
          await supabase
            .from('user_settings')
            .upsert({
              user_id: userId,
              stripe_customer_id: stripeCustomerId,
            }, {
              onConflict: 'user_id',
            })
        }
        
        // Initialize/update usage balances if subscription is active
        if (userId && ['active', 'trialing'].includes(subscription.status)) {
          try {
            await initializeUsageBalances(userId)
            console.log('[Stripe webhook] Initialized/updated usage balances for user:', userId)
          } catch (error) {
            console.error('[Stripe webhook] Failed to initialize usage balances:', error)
            // Don't fail the webhook - balances will be initialized on first use
          }
        }
        
        // No need to sync subscription - we query Stripe directly
        console.log('[Stripe webhook] Subscription updated/created - will be queried from Stripe when needed', {
          subscriptionId: subscription.id,
          status: subscription.status,
        })
        break
      }

      case 'customer.subscription.deleted': {
        // Subscription deleted - no action needed, we query Stripe directly
        const subscription = event.data.object as Stripe.Subscription
        console.log('[Stripe webhook] Subscription deleted - will be reflected in Stripe queries', {
          subscriptionId: subscription.id,
        })
        break
      }

      case 'invoice.payment_failed': {
        // Payment failed - no action needed, we query Stripe directly
        const invoice = event.data.object as Stripe.Invoice
        console.log('[Stripe webhook] Payment failed - will be reflected in Stripe queries', {
          invoiceId: invoice.id,
        })
        break
      }

      case 'invoice.payment_succeeded': {
        // Payment succeeded - no action needed, we query Stripe directly
        console.log('[Stripe webhook] Payment succeeded')
        break
      }

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



