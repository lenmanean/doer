/**
 * Account deletion scheduling helpers
 * Calculates when accounts should be deleted based on subscription period end
 */

import { getActiveSubscriptionFromStripe } from '@/lib/stripe/subscriptions'
import { logger } from '@/lib/logger'

/**
 * Calculate the date when an account should be deleted
 * Uses trial_end if subscription is trialing, otherwise current_period_end
 * Falls back to 7 days from now if no subscription exists
 * 
 * @param userId - User ID to check subscription for
 * @returns Date object representing when account should be deleted
 */
export async function calculateDeletionDate(userId: string): Promise<Date> {
  try {
    // Get active subscription from Stripe
    const subscription = await getActiveSubscriptionFromStripe(userId)
    
    if (subscription) {
      // Use trial_end if trialing, otherwise use current_period_end
      const periodEnd = subscription.trialEnd || subscription.currentPeriodEnd
      
      if (periodEnd) {
        const deletionDate = new Date(periodEnd)
        logger.info('Calculated deletion date from subscription', {
          userId,
          periodEnd,
          trialEnd: subscription.trialEnd,
          currentPeriodEnd: subscription.currentPeriodEnd,
          deletionDate: deletionDate.toISOString(),
        })
        return deletionDate
      }
    }
    
    // No subscription or no period end - use 7 day default grace period
    const defaultGracePeriod = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    logger.info('Using default grace period for deletion date', {
      userId,
      hasSubscription: !!subscription,
      defaultGracePeriod: defaultGracePeriod.toISOString(),
    })
    return defaultGracePeriod
  } catch (error) {
    // On error, use 7 day default grace period
    logger.warn('Error calculating deletion date, using default grace period', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
}

