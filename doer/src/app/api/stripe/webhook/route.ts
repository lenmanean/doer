import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { assignSubscription, type BillingCycle, type SubscriptionStatus } from '@/lib/billing/plans'

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
 * 
 * This function ALWAYS returns a valid BillingCycle enum value
 */
function convertStripeIntervalToBillingCycle(
  interval: string | undefined | null
): BillingCycle {
  if (!interval) {
    console.log('[Stripe webhook] No interval provided, defaulting to monthly')
    return 'monthly'
  }
  
  const normalized = interval.toLowerCase().trim()
  console.log(`[Stripe webhook] Converting interval: "${interval}" (normalized: "${normalized}")`)
  
  // Handle exact matches first
  if (normalized === 'month' || normalized === 'monthly') {
    console.log('[Stripe webhook] Matched month/monthly -> monthly')
    return 'monthly'
  }
  if (normalized === 'year' || normalized === 'yearly' || normalized === 'annual') {
    console.log('[Stripe webhook] Matched year/yearly/annual -> annual')
    return 'annual'
  }
  
  // Handle partial matches
  if (normalized.includes('month')) {
    console.log('[Stripe webhook] Partial match "month" -> monthly')
    return 'monthly'
  }
  if (normalized.includes('year') || normalized.includes('annual')) {
    console.log('[Stripe webhook] Partial match "year"/"annual" -> annual')
    return 'annual'
  }
  
  // Default to monthly if interval is not recognized
  console.warn(`[Stripe webhook] Unknown billing interval: "${interval}" (normalized: "${normalized}"), defaulting to "monthly"`)
  return 'monthly'
}

/**
 * Maps Stripe subscription status to our SubscriptionStatus enum
 */
function mapStripeSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
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
      console.warn(`[Stripe webhook] Unknown subscription status: "${stripeStatus}", defaulting to "active"`)
      return 'active'
  }
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

/**
 * Formats Stripe timestamp to date string (YYYY-MM-DD)
 */
function formatStripeDate(timestamp: number | null | undefined): string | undefined {
  if (!timestamp) return undefined
  const date = new Date(timestamp * 1000) // Stripe timestamps are in seconds
  return date.toISOString().split('T')[0] // Format as YYYY-MM-DD
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
        
        // Extract Stripe IDs from session
        const stripeCustomerId = extractCustomerId(session)
        const stripeSubscriptionId = session.subscription 
          ? (typeof session.subscription === 'string' ? session.subscription : session.subscription.id)
          : null
        
        // Log raw values for debugging
        console.log('[Stripe webhook] Checkout session completed - raw values:', {
          sessionId: session.id,
          stripeCustomerId,
          stripeSubscriptionId,
          metadataBillingCycle,
          metadata: JSON.stringify(metadata),
        })
        
        // Validate and convert billing cycle - metadata might contain "month" instead of "monthly"
        let billingCycle: BillingCycle = 'monthly'
        if (metadataBillingCycle && ['monthly', 'annual'].includes(metadataBillingCycle)) {
          // Metadata has valid billing cycle
          billingCycle = metadataBillingCycle as BillingCycle
          console.log('[Stripe webhook] Using valid metadata billing cycle:', billingCycle)
        } else if (metadataBillingCycle) {
          // Metadata has billing cycle but it's in wrong format (e.g., "month" or "year")
          billingCycle = convertStripeIntervalToBillingCycle(metadataBillingCycle)
          console.log('[Stripe webhook] Converted metadata billing cycle:', metadataBillingCycle, '->', billingCycle)
        } else {
          console.log('[Stripe webhook] No billing cycle in metadata, defaulting to monthly')
        }
        
        // Final validation - ensure billingCycle is valid before proceeding
        if (!['monthly', 'annual'].includes(billingCycle)) {
          console.error('[Stripe webhook] Invalid billing cycle after conversion:', billingCycle)
          billingCycle = 'monthly' // Force to valid default
        }

        if (!userId || !planSlug) {
          console.warn('[Stripe webhook] Missing userId/planSlug in session metadata', {
            sessionId: session.id,
            metadata,
          })
          break
        }

        // Update user_settings.stripe_customer_id if customer ID is available
        if (stripeCustomerId) {
          const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
          const supabase = getServiceRoleClient()
          await supabase
            .from('user_settings')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('user_id', userId)
          console.log('[Stripe webhook] Updated user_settings.stripe_customer_id:', {
            userId,
            stripeCustomerId,
          })
        }
        
        console.log('[Stripe webhook] Proceeding with subscription assignment:', {
          userId,
          planSlug,
          billingCycle,
          stripeCustomerId,
          stripeSubscriptionId,
        })

        try {
          // Double-check billing cycle is valid before calling assignSubscription
          if (!['monthly', 'annual'].includes(billingCycle)) {
            console.error('[Stripe webhook] Invalid billing cycle before assignSubscription:', {
              billingCycle,
              metadataBillingCycle,
            })
            billingCycle = 'monthly' // Force to valid default
          }

          // If we have a subscription ID, fetch the subscription to get period dates
          let periodStart: string | undefined
          let periodEnd: string | undefined
          let status: SubscriptionStatus | undefined

          if (stripeSubscriptionId && stripe) {
            try {
              const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
              status = mapStripeSubscriptionStatus(subscription.status)
              periodStart = formatStripeDate(subscription.current_period_start)
              periodEnd = formatStripeDate(subscription.current_period_end)
              console.log('[Stripe webhook] Retrieved subscription details:', {
                subscriptionId: stripeSubscriptionId,
                status,
                periodStart,
                periodEnd,
              })
            } catch (error) {
              console.error('[Stripe webhook] Error retrieving subscription:', error)
              // Continue without period dates - assignSubscription will calculate them
            }
          }
          
          await assignSubscription(userId, planSlug, billingCycle, {
            stripeCustomerId: stripeCustomerId || undefined,
            stripeSubscriptionId: stripeSubscriptionId || undefined,
            status,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          })
          console.log('[Stripe webhook] Assigned subscription via checkout.session.completed', {
            userId,
            planSlug,
            billingCycle,
            stripeCustomerId,
            stripeSubscriptionId,
          })
        } catch (error) {
          console.error('[Stripe webhook] Error assigning subscription:', {
            error: error instanceof Error ? error.message : String(error),
            userId,
            planSlug,
            billingCycle,
            metadataBillingCycle,
            stack: error instanceof Error ? error.stack : undefined,
          })
          throw error // Re-throw to be caught by outer try-catch
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}
        const userId = metadata.userId
        const planSlug = metadata.planSlug
        
        // Extract Stripe IDs from subscription
        const stripeCustomerId = extractCustomerId(subscription)
        const stripeSubscriptionId = subscription.id
        
        // Get billing cycle from Stripe's interval (month/year) or metadata, converting as needed
        const stripeInterval = subscription.items.data[0]?.price?.recurring?.interval
        const metadataBillingCycle = metadata.billingCycle as string | undefined
        
        // Map Stripe subscription status to our enum
        const status = mapStripeSubscriptionStatus(subscription.status)
        
        // Extract period dates from subscription
        const periodStart = formatStripeDate(subscription.current_period_start)
        const periodEnd = formatStripeDate(subscription.current_period_end)
        
        // Log raw values for debugging
        console.log('[Stripe webhook] Subscription event - raw values:', {
          subscriptionId: stripeSubscriptionId,
          stripeCustomerId,
          status: subscription.status,
          mappedStatus: status,
          periodStart,
          periodEnd,
          metadataBillingCycle,
          stripeInterval,
          metadata: JSON.stringify(metadata),
        })
        
        // Validate and convert billing cycle - metadata might contain "month" instead of "monthly"
        let billingCycle: BillingCycle = 'monthly'
        if (metadataBillingCycle && ['monthly', 'annual'].includes(metadataBillingCycle)) {
          // Metadata has valid billing cycle
          billingCycle = metadataBillingCycle as BillingCycle
          console.log('[Stripe webhook] Using valid metadata billing cycle:', billingCycle)
        } else if (metadataBillingCycle) {
          // Metadata has billing cycle but it's in wrong format (e.g., "month" or "year")
          billingCycle = convertStripeIntervalToBillingCycle(metadataBillingCycle)
          console.log('[Stripe webhook] Converted metadata billing cycle:', metadataBillingCycle, '->', billingCycle)
        } else if (stripeInterval) {
          // Use Stripe's interval and convert it
          billingCycle = convertStripeIntervalToBillingCycle(stripeInterval)
          console.log('[Stripe webhook] Converted Stripe interval:', stripeInterval, '->', billingCycle)
        } else {
          console.log('[Stripe webhook] No billing cycle found, defaulting to monthly')
        }
        
        // Final validation - ensure billingCycle is valid before proceeding
        if (!['monthly', 'annual'].includes(billingCycle)) {
          console.error('[Stripe webhook] Invalid billing cycle after conversion:', billingCycle)
          billingCycle = 'monthly' // Force to valid default
        }

        if (!userId || !planSlug) {
          console.log('[Stripe webhook] Subscription event without userId/planSlug, checking by subscription ID', {
            subscriptionId: stripeSubscriptionId,
          })
          
          // Try to find subscription by Stripe ID
          if (stripeSubscriptionId) {
            const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
            const supabase = getServiceRoleClient()
            const { data: existingSub } = await supabase
              .from('user_plan_subscriptions')
              .select('user_id, billing_plan_cycles!inner(billing_plan:billing_plans!inner(slug))')
              .eq('external_subscription_id', stripeSubscriptionId)
              .maybeSingle()
            
            if (existingSub) {
              // Update existing subscription with new status and period dates
              await supabase
                .from('user_plan_subscriptions')
                .update({
                  status: status,
                  current_period_start: periodStart || undefined,
                  current_period_end: periodEnd || undefined,
                  external_customer_id: stripeCustomerId || undefined,
                  updated_at: new Date().toISOString(),
                })
                .eq('external_subscription_id', stripeSubscriptionId)
              
              console.log('[Stripe webhook] Updated existing subscription by Stripe ID:', {
                subscriptionId: stripeSubscriptionId,
                status,
              })
            }
          }
          break
        }

        // Update user_settings.stripe_customer_id if customer ID is available
        if (stripeCustomerId) {
          const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
          const supabase = getServiceRoleClient()
          await supabase
            .from('user_settings')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('user_id', userId)
          console.log('[Stripe webhook] Updated user_settings.stripe_customer_id:', {
            userId,
            stripeCustomerId,
          })
        }
        
        console.log('[Stripe webhook] Proceeding with subscription assignment:', {
          userId,
          planSlug,
          billingCycle,
          stripeCustomerId,
          stripeSubscriptionId,
          status,
          periodStart,
          periodEnd,
        })

        try {
          // Double-check billing cycle is valid before calling assignSubscription
          if (!['monthly', 'annual'].includes(billingCycle)) {
            console.error('[Stripe webhook] Invalid billing cycle before assignSubscription:', {
              billingCycle,
              metadataBillingCycle,
              stripeInterval,
            })
            billingCycle = 'monthly' // Force to valid default
          }
          
          // assignSubscription will handle idempotency by checking Stripe subscription ID
          await assignSubscription(userId, planSlug, billingCycle, {
            stripeCustomerId: stripeCustomerId || undefined,
            stripeSubscriptionId: stripeSubscriptionId || undefined,
            status,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          })
          console.log('[Stripe webhook] Assigned subscription via subscription event', {
            userId,
            planSlug,
            billingCycle,
            stripeCustomerId,
            stripeSubscriptionId,
            status,
          })
        } catch (error) {
          console.error('[Stripe webhook] Error assigning subscription:', {
            error: error instanceof Error ? error.message : String(error),
            userId,
            planSlug,
            billingCycle,
            metadataBillingCycle,
            stripeInterval,
            stack: error instanceof Error ? error.stack : undefined,
          })
          throw error // Re-throw to be caught by outer try-catch
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const metadata = subscription.metadata || {}
        const userId = metadata.userId
        const stripeSubscriptionId = subscription.id

        const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
        const supabase = getServiceRoleClient()

        // Try to update by Stripe subscription ID first (more reliable)
        if (stripeSubscriptionId) {
          const { error: updateError } = await supabase
            .from('user_plan_subscriptions')
            .update({ 
              status: 'canceled',
              cancel_at: formatStripeDate(subscription.canceled_at) || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('external_subscription_id', stripeSubscriptionId)

          if (!updateError) {
            console.log('[Stripe webhook] Marked subscription as canceled by Stripe ID', {
              subscriptionId: stripeSubscriptionId,
            })
            break
          }
        }

        // Fallback to updating by user ID if Stripe ID lookup failed
        if (userId) {
          await supabase
            .from('user_plan_subscriptions')
            .update({ 
              status: 'canceled',
              cancel_at: formatStripeDate(subscription.canceled_at) || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .in('status', ['active', 'trialing'])

          console.log('[Stripe webhook] Marked subscription as canceled by user ID', {
            userId,
            subscriptionId: stripeSubscriptionId,
          })
        } else {
          console.warn('[Stripe webhook] Subscription deleted but no userId or subscriptionId found', {
            subscriptionId: stripeSubscriptionId,
            metadata,
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = typeof invoice.subscription === 'string' 
          ? invoice.subscription 
          : invoice.subscription?.id

        if (subscriptionId && stripe) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            const metadata = subscription.metadata || {}
            const userId = metadata.userId

            const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
            const supabase = getServiceRoleClient()

            // Try to update by Stripe subscription ID first (more reliable)
            const { error: updateError } = await supabase
              .from('user_plan_subscriptions')
              .update({ 
                status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('external_subscription_id', subscriptionId)

            if (!updateError) {
              console.log('[Stripe webhook] Marked subscription as past_due by Stripe ID', {
                subscriptionId,
              })
              break
            }

            // Fallback to updating by user ID if Stripe ID lookup failed
            if (userId) {
              await supabase
                .from('user_plan_subscriptions')
                .update({ 
                  status: 'past_due',
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId)
                .in('status', ['active', 'trialing'])

              console.log('[Stripe webhook] Marked subscription as past_due by user ID', {
                userId,
                subscriptionId,
              })
            } else {
              console.warn('[Stripe webhook] Payment failed but no userId found', {
                subscriptionId,
                metadata,
              })
            }
          } catch (error) {
            console.error('[Stripe webhook] Error handling payment_failed event:', error)
          }
        } else {
          console.warn('[Stripe webhook] Payment failed but no subscription ID found', {
            invoiceId: invoice.id,
          })
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



