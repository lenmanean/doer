import Stripe from 'stripe'

import { getServiceRoleClient } from '@/lib/supabase/service-role'
import {
  getPlanCycleBySlugAndCycle,
  type BillingCycle,
  type SubscriptionStatus,
  type UsageMetric,
} from '@/lib/billing/plans'
import { logger } from '@/lib/logger'

type PlanSlug = 'basic' | 'pro'

const METRICS: UsageMetric[] = ['api_credits', 'integration_actions']

const priceMap: Record<string, { planSlug: PlanSlug; billingCycle: BillingCycle }> = {
  [process.env.STRIPE_PRICE_BASIC ?? '']: { planSlug: 'basic', billingCycle: 'monthly' },
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? '']: { planSlug: 'pro', billingCycle: 'monthly' },
  [process.env.STRIPE_PRICE_PRO_ANNUAL ?? '']: { planSlug: 'pro', billingCycle: 'annual' },
}

function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  const normalized = stripeStatus?.toLowerCase?.().trim()
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

function formatStripeDate(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return new Date().toISOString().split('T')[0]!
  }
  return new Date(timestamp * 1000).toISOString().split('T')[0]!
}

function inferPlanFromSubscription(subscription: Stripe.Subscription): {
  planSlug: PlanSlug
  billingCycle: BillingCycle
} {
  const subscriptionId = subscription.id
  const metadataSlug = subscription.metadata?.planSlug as PlanSlug | undefined
  const metadataCycle = subscription.metadata?.billingCycle as BillingCycle | undefined
  
  // Priority 1: Check metadata (most reliable source)
  if (metadataSlug && metadataCycle) {
    logger.info('[subscription-sync] Inferred plan from metadata', {
      subscriptionId,
      planSlug: metadataSlug,
      billingCycle: metadataCycle,
      method: 'metadata',
    })
    return { planSlug: metadataSlug, billingCycle: metadataCycle }
  }

  const priceId = subscription.items?.data?.[0]?.price?.id
  
  // Priority 2: Check priceMap (pre-populated from env vars)
  if (priceId && priceMap[priceId]) {
    const result = priceMap[priceId]
    logger.info('[subscription-sync] Inferred plan from priceMap', {
      subscriptionId,
      priceId,
      planSlug: result.planSlug,
      billingCycle: result.billingCycle,
      method: 'priceMap',
    })
    return result
  }

  // Priority 3: Check environment variables directly (fallback if priceMap lookup failed)
  if (priceId) {
    if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
      logger.info('[subscription-sync] Inferred plan from env var (Pro Monthly)', {
        subscriptionId,
        priceId,
        method: 'env_var_direct',
      })
      return { planSlug: 'pro', billingCycle: 'monthly' }
    }
    if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
      logger.info('[subscription-sync] Inferred plan from env var (Pro Annual)', {
        subscriptionId,
        priceId,
        method: 'env_var_direct',
      })
      return { planSlug: 'pro', billingCycle: 'annual' }
    }
    if (priceId === process.env.STRIPE_PRICE_BASIC) {
      logger.info('[subscription-sync] Inferred plan from env var (Basic)', {
        subscriptionId,
        priceId,
        method: 'env_var_direct',
      })
      return { planSlug: 'basic', billingCycle: 'monthly' }
    }
  }

  // Priority 4: Fallback to interval-based detection (least reliable)
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval
  const billingCycle: BillingCycle = interval === 'year' ? 'annual' : 'monthly'
  
  logger.warn('[subscription-sync] Inferred plan from interval fallback (metadata and price lookup failed)', {
    subscriptionId,
    priceId: priceId || 'missing',
    interval: interval || 'missing',
    planSlug: 'pro',
    billingCycle,
    method: 'interval_fallback',
    metadata: subscription.metadata || {},
  })
  
  return { planSlug: 'pro', billingCycle }
}

function extractCustomerId(subscription: Stripe.Subscription): string | null {
  if (typeof subscription.customer === 'string') {
    return subscription.customer
  }
  if (subscription.customer && typeof subscription.customer === 'object' && 'id' in subscription.customer) {
    return subscription.customer.id
  }
  return null
}

interface SyncSubscriptionOptions {
  userId?: string
}

/**
 * Persist a Stripe subscription snapshot into Supabase and ensure usage balances are initialized.
 */
export async function syncSubscriptionSnapshot(
  subscription: Stripe.Subscription,
  options: SyncSubscriptionOptions = {}
): Promise<void> {
  const userId = options.userId ?? (subscription.metadata?.userId as string | undefined)
  if (!userId) {
    logger.warn('[subscription-sync] Missing userId for subscription sync', {
      subscriptionId: subscription.id,
    })
    return
  }

  try {
    const { planSlug, billingCycle } = inferPlanFromSubscription(subscription)
    const planCycle = await getPlanCycleBySlugAndCycle(planSlug, billingCycle)
    const supabase = getServiceRoleClient()

    // Check if subscription is incomplete but payment succeeded
    // In this case, we should treat it as active, not canceled
    let status = mapStripeStatus(subscription.status)
    let currentPeriodStart = formatStripeDate((subscription as any).current_period_start)
    let currentPeriodEnd = formatStripeDate((subscription as any).current_period_end)
    
    // If subscription is incomplete, check if payment succeeded
    if (subscription.status === 'incomplete') {
      try {
        // Try to get the invoice to check payment status
        const invoice = subscription.latest_invoice
        if (invoice) {
          let invoiceObj: Stripe.Invoice | null = null
          if (typeof invoice === 'string') {
            // Import Stripe client
            const { default: Stripe } = await import('stripe')
            const stripeSecretKey = process.env.STRIPE_SECRET_KEY
            if (stripeSecretKey) {
              const stripe = new Stripe(stripeSecretKey)
              invoiceObj = await stripe.invoices.retrieve(invoice, {
                expand: ['payment_intent'],
              })
            }
          } else if (invoice && typeof invoice === 'object') {
            invoiceObj = invoice as Stripe.Invoice
          }

          if (invoiceObj) {
            const paymentIntent = (invoiceObj as any).payment_intent
            let paymentIntentObj: Stripe.PaymentIntent | null = null

            if (typeof paymentIntent === 'string') {
              // Import Stripe client
              const { default: Stripe } = await import('stripe')
              const stripeSecretKey = process.env.STRIPE_SECRET_KEY
              if (stripeSecretKey) {
                const stripe = new Stripe(stripeSecretKey)
                paymentIntentObj = await stripe.paymentIntents.retrieve(paymentIntent)
              }
            } else if (paymentIntent && typeof paymentIntent === 'object') {
              paymentIntentObj = paymentIntent as Stripe.PaymentIntent
            }

            // If payment succeeded, treat as active
            if (paymentIntentObj?.status === 'succeeded') {
              status = 'active'
              logger.info('[subscription-sync] Incomplete subscription with succeeded payment, treating as active', {
                subscriptionId: subscription.id,
                userId,
              })
            }
          }
        }
      } catch (checkError) {
        logger.warn('[subscription-sync] Error checking payment status for incomplete subscription', {
          error: checkError instanceof Error ? checkError.message : String(checkError),
          subscriptionId: subscription.id,
        })
        // Continue with original status if check fails
      }
    }

    // If period dates are the same or not set, calculate them based on billing cycle
    if (!currentPeriodStart || !currentPeriodEnd || currentPeriodStart === currentPeriodEnd) {
      const now = new Date()
      currentPeriodStart = formatStripeDate(Math.floor(now.getTime() / 1000))
      
      // Calculate end date based on billing cycle
      const endDate = new Date(now)
      if (billingCycle === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1)
      } else {
        endDate.setMonth(endDate.getMonth() + 1)
      }
      currentPeriodEnd = formatStripeDate(Math.floor(endDate.getTime() / 1000))
      
      logger.info('[subscription-sync] Calculated period dates for subscription', {
        subscriptionId: subscription.id,
        currentPeriodStart,
        currentPeriodEnd,
        billingCycle,
      })
    }

    // Set cancel_at to current_period_end if cancel_at_period_end is true but cancel_at is null
    // This ensures we have a cancellation date even if Stripe hasn't set it yet
    let cancelAt: string | null = null
    if (subscription.cancel_at) {
      cancelAt = formatStripeDate(subscription.cancel_at)
    } else if (subscription.cancel_at_period_end && currentPeriodEnd) {
      // If cancel_at_period_end is true but cancel_at is null, use current_period_end
      cancelAt = currentPeriodEnd
    }
    const stripeCustomerId = extractCustomerId(subscription)

    const basePayload = {
      user_id: userId,
      billing_plan_cycle_id: planCycle.id,
      status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at: cancelAt,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      external_customer_id: stripeCustomerId,
      external_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('user_plan_subscriptions')
      .select('id, status')
      .eq('external_subscription_id', subscription.id)
      .maybeSingle()

    if (existing?.id) {
      // Update existing subscription record
      // But don't update if it's already canceled and we're trying to sync a canceled subscription
      // This prevents race conditions where a canceled subscription gets re-activated
      if (existing.status === 'canceled' && status === 'canceled') {
        // Subscription is already canceled, don't update it
        logger.info('[subscription-sync] Skipping update - subscription already canceled', {
          subscriptionId: subscription.id,
          userId,
        })
        return
      }
      
      await supabase.from('user_plan_subscriptions').update(basePayload).eq('id', existing.id)
    } else {
      // Check if subscription with this external_subscription_id already exists
      // This prevents duplicate inserts from concurrent webhook calls
      const { data: existingByExternalId } = await supabase
        .from('user_plan_subscriptions')
        .select('id, status')
        .eq('external_subscription_id', subscription.id)
        .maybeSingle()

      if (existingByExternalId) {
        // Subscription already exists in database, just update it
        logger.info('[subscription-sync] Subscription already exists, updating instead of inserting', {
          subscriptionId: subscription.id,
          userId,
          existingId: existingByExternalId.id,
        })
        
        await supabase
          .from('user_plan_subscriptions')
          .update(basePayload)
          .eq('id', existingByExternalId.id)
        return
      }

      // Only cancel other active/trialing subscriptions if the new one is active/trialing
      // Don't cancel existing subscriptions if the new one is incomplete (payment might be pending)
      // Also don't cancel if the new subscription is already canceled (might be a cleanup)
      if (status === 'active' || status === 'trialing') {
        // Cancel other active/trialing subscriptions for this user
        // But exclude the current subscription ID to avoid canceling itself
        // This ensures only one active subscription per user
        await supabase
          .from('user_plan_subscriptions')
          .update({
            status: 'canceled',
            cancel_at: currentPeriodStart,
            cancel_at_period_end: false, // Cancel immediately, not at period end
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .in('status', ['active', 'trialing'])
          .neq('external_subscription_id', subscription.id) // Don't cancel the subscription we're syncing
      }

      // Insert new subscription record
      // Use upsert with external_subscription_id as unique constraint to prevent duplicates
      const { error: insertError } = await supabase
        .from('user_plan_subscriptions')
        .insert({
          ...basePayload,
          created_at: new Date().toISOString(),
        })

      // If insert fails due to unique constraint violation, another request already inserted it
      if (insertError) {
        if (insertError.code === '23505') { // Unique violation
          logger.info('[subscription-sync] Subscription already inserted by concurrent request', {
            subscriptionId: subscription.id,
            userId,
          })
          // Subscription was already inserted, that's fine
          return
        }
        // Other errors should be thrown
        throw insertError
      }
    }

    for (const metric of METRICS) {
      const allocation =
        metric === 'api_credits' ? planCycle.apiCreditLimit : planCycle.integrationActionLimit
      const { error } = await supabase.rpc('reset_usage_cycle', {
        p_user_id: userId,
        p_metric: metric,
        p_cycle_start: currentPeriodStart,
        p_cycle_end: currentPeriodEnd,
        p_allocation: allocation,
        p_reference: {
          reason: 'subscription_sync',
          billing_plan_cycle_id: planCycle.id,
          stripe_subscription_id: subscription.id,
        },
      })

      if (error) {
        logger.error('[subscription-sync] Failed to reset usage cycle', {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          userId,
          metric,
        })
      }
    }

    logger.info('[subscription-sync] Subscription synced successfully', {
      userId,
      subscriptionId: subscription.id,
      status,
    })
  } catch (error) {
    logger.error('[subscription-sync] Failed to sync subscription snapshot', error as Error, {
      userId,
      subscriptionId: subscription.id,
    })
    throw error
  }
}

