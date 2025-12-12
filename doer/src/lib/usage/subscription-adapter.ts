import { getActiveSubscriptionFromStripe, type StripeSubscription } from '@/lib/stripe/subscriptions'
import { getPlanCycleBySlugAndCycle } from '@/lib/billing/plans'
import type { UserPlanSubscription } from '@/lib/billing/plans'
import { autoAssignBasicPlan } from '@/lib/stripe/auto-assign-basic'
import { logger } from '@/lib/logger'

/**
 * Converts StripeSubscription to UserPlanSubscription format
 * This adapter allows CreditService to work with Stripe-based subscriptions
 * Automatically assigns Basic plan if user has no subscription
 */
export async function getSubscriptionForUsage(userId: string): Promise<UserPlanSubscription | null> {
  let stripeSubscription = await getActiveSubscriptionFromStripe(userId)
  
  // If no subscription found, automatically assign Basic plan
  if (!stripeSubscription) {
    try {
      await autoAssignBasicPlan(userId)
      // Try to get subscription again after assignment
      stripeSubscription = await getActiveSubscriptionFromStripe(userId)
    } catch (error) {
      logger.error('Failed to auto-assign Basic plan', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId,
      })
      // Re-throw error instead of silently continuing
      // This ensures callers know that subscription assignment failed
      throw new Error(`Failed to auto-assign Basic plan for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  if (!stripeSubscription) {
    // This should not happen if auto-assignment succeeded, but handle gracefully
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

