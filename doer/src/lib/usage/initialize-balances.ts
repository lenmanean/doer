import { getActiveSubscriptionFromStripe } from '@/lib/stripe/subscriptions'
import { getPlanCycleBySlugAndCycle } from '@/lib/billing/plans'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import type { UsageMetric } from '@/lib/billing/plans'
import { logger } from '@/lib/logger'

/**
 * Initialize usage balances for a user based on their active Stripe subscription
 * This should be called when a subscription starts or when usage tracking is first needed
 */
export async function initializeUsageBalances(userId: string): Promise<void> {
  const supabase = getServiceRoleClient()
  
  // Get active subscription from Stripe
  const subscription = await getActiveSubscriptionFromStripe(userId)
  
  if (!subscription) {
    logger.debug('No active subscription for user, skipping initialization', { userId })
    return
  }

  // Get plan cycle details
  const planCycle = await getPlanCycleBySlugAndCycle(
    subscription.planSlug,
    subscription.billingCycle
  )

  const metrics: UsageMetric[] = ['api_credits', 'integration_actions']
  const limits = {
    api_credits: subscription.planDetails.apiCreditLimit,
    integration_actions: subscription.planDetails.integrationActionLimit,
  }

  // Initialize balances for each metric
  for (const metric of metrics) {
    const allocation = limits[metric]
    
    // Skip balance initialization for unlimited credits (-1)
    if (allocation === -1) {
      logger.debug('Skipping balance initialization for unlimited metric', {
        userId,
        metric,
        allocation,
      })
      continue
    }
    
    // Check if balance already exists for this cycle
    const { data: existing } = await supabase.rpc('current_usage_balance', {
      p_user_id: userId,
      p_metric: metric,
    })

    if (existing) {
      logger.debug('Balance already exists, skipping', { userId, metric })
      continue
    }

    // Initialize the balance
    const { error } = await supabase.rpc('reset_usage_cycle', {
      p_user_id: userId,
      p_metric: metric,
      p_cycle_start: subscription.currentPeriodStart,
      p_cycle_end: subscription.currentPeriodEnd,
      p_allocation: allocation,
      p_reference: {
        reason: 'subscription_initialization',
        subscription_id: subscription.id,
        plan_slug: subscription.planSlug,
        billing_cycle: subscription.billingCycle,
        billing_plan_cycle_id: planCycle.id,
      },
    })

    if (error) {
      logger.error(`Failed to initialize ${metric} balance`, {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId,
        metric,
      })
      throw new Error(`Failed to initialize usage balance for ${metric}: ${error.message}`)
    }

    logger.info(`Initialized ${metric} balance`, {
      userId,
      metric,
      allocation: limits[metric],
      cycleStart: subscription.currentPeriodStart,
      cycleEnd: subscription.currentPeriodEnd,
    })
  }
}

