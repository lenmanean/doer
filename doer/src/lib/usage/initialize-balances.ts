import { getActiveSubscriptionFromStripe } from '@/lib/stripe/subscriptions'
import { getPlanCycleBySlugAndCycle } from '@/lib/billing/plans'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import type { UsageMetric } from '@/lib/billing/plans'

/**
 * Initialize usage balances for a user based on their active Stripe subscription
 * This should be called when a subscription starts or when usage tracking is first needed
 */
export async function initializeUsageBalances(userId: string): Promise<void> {
  const supabase = getServiceRoleClient()
  
  // Get active subscription from Stripe
  const subscription = await getActiveSubscriptionFromStripe(userId)
  
  if (!subscription) {
    console.log(`[initializeUsageBalances] No active subscription for user ${userId}, skipping initialization`)
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
    // Check if balance already exists for this cycle
    const { data: existing } = await supabase.rpc('current_usage_balance', {
      p_user_id: userId,
      p_metric: metric,
    })

    if (existing) {
      console.log(`[initializeUsageBalances] Balance already exists for ${metric}, skipping`)
      continue
    }

    // Initialize the balance
    const { error } = await supabase.rpc('reset_usage_cycle', {
      p_user_id: userId,
      p_metric: metric,
      p_cycle_start: subscription.currentPeriodStart,
      p_cycle_end: subscription.currentPeriodEnd,
      p_allocation: limits[metric],
      p_reference: {
        reason: 'subscription_initialization',
        subscription_id: subscription.id,
        plan_slug: subscription.planSlug,
        billing_cycle: subscription.billingCycle,
        billing_plan_cycle_id: planCycle.id,
      },
    })

    if (error) {
      console.error(`[initializeUsageBalances] Failed to initialize ${metric} for user ${userId}:`, error)
      throw new Error(`Failed to initialize usage balance for ${metric}: ${error.message}`)
    }

    console.log(`[initializeUsageBalances] Initialized ${metric} balance for user ${userId}:`, {
      allocation: limits[metric],
      cycleStart: subscription.currentPeriodStart,
      cycleEnd: subscription.currentPeriodEnd,
    })
  }
}

