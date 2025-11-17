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
  const metadataSlug = subscription.metadata?.planSlug as PlanSlug | undefined
  const metadataCycle = subscription.metadata?.billingCycle as BillingCycle | undefined
  if (metadataSlug && metadataCycle) {
    return { planSlug: metadataSlug, billingCycle: metadataCycle }
  }

  const priceId = subscription.items?.data?.[0]?.price?.id
  if (priceId && priceMap[priceId]) {
    return priceMap[priceId]
  }

  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval
  const billingCycle: BillingCycle = interval === 'year' ? 'annual' : 'monthly'
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

    const status = mapStripeStatus(subscription.status)
    const currentPeriodStart = formatStripeDate((subscription as any).current_period_start)
    const currentPeriodEnd = formatStripeDate((subscription as any).current_period_end)
    const cancelAt = subscription.cancel_at ? formatStripeDate(subscription.cancel_at) : null
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
      .select('id')
      .eq('external_subscription_id', subscription.id)
      .maybeSingle()

    if (existing?.id) {
      // Update existing subscription record
      await supabase.from('user_plan_subscriptions').update(basePayload).eq('id', existing.id)
    } else {
      // Only cancel other active/trialing subscriptions if the new one is active/trialing
      // Don't cancel existing subscriptions if the new one is incomplete (payment might be pending)
      if (status === 'active' || status === 'trialing') {
        await supabase
          .from('user_plan_subscriptions')
          .update({
            status: 'canceled',
            cancel_at: currentPeriodStart,
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .in('status', ['active', 'trialing'])
      }

      // Insert new subscription record
      await supabase
        .from('user_plan_subscriptions')
        .insert({
          ...basePayload,
          created_at: new Date().toISOString(),
        })
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
        logger.error('[subscription-sync] Failed to reset usage cycle', error as Error, {
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

