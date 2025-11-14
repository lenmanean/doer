import { getActiveSubscriptionFromStripe, type StripeSubscription } from '@/lib/stripe/subscriptions'
import { getPlanCycleBySlugAndCycle } from '@/lib/billing/plans'
import type { UserPlanSubscription } from '@/lib/billing/plans'

/**
 * Converts StripeSubscription to UserPlanSubscription format
 * This adapter allows CreditService to work with Stripe-based subscriptions
 */
export async function getSubscriptionForUsage(userId: string): Promise<UserPlanSubscription | null> {
  const stripeSubscription = await getActiveSubscriptionFromStripe(userId)
  
  if (!stripeSubscription) {
    return null
  }

  // Get the billing plan cycle from database (needed for billing_plan_cycle_id)
  const planCycle = await getPlanCycleBySlugAndCycle(
    stripeSubscription.planSlug,
    stripeSubscription.billingCycle
  )

  // Convert to UserPlanSubscription format
  return {
    id: stripeSubscription.id, // Use Stripe subscription ID as temporary ID
    userId,
    status: stripeSubscription.status,
    currentPeriodStart: stripeSubscription.currentPeriodStart,
    currentPeriodEnd: stripeSubscription.currentPeriodEnd,
    billingPlanCycleId: planCycle.id,
    planCycle: {
      id: planCycle.id,
      cycle: planCycle.cycle,
      apiCreditLimit: stripeSubscription.planDetails.apiCreditLimit,
      integrationActionLimit: stripeSubscription.planDetails.integrationActionLimit,
      priceCents: stripeSubscription.planDetails.priceCents,
      metadata: planCycle.metadata,
      plan: planCycle.plan,
    },
  }
}

