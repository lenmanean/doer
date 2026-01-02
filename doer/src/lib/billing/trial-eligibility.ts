import { getServiceRoleClient } from '@/lib/supabase/service-role'
import Stripe from 'stripe'
import { logger } from '@/lib/logger'

/**
 * Checks if a user is eligible for a Pro trial by checking:
 * 1. Current user's subscription history
 * 2. Account deletion audit for same email (prevents deletion/recreation abuse)
 * 3. Stripe customers with same email that have been deleted
 * 
 * Returns true if user is eligible for trial (has never had Pro before)
 */
export async function checkTrialEligibility(
  userId: string,
  userEmail: string | null | undefined,
  stripe: Stripe | null
): Promise<{ eligible: boolean; reason?: string }> {
  const supabase = getServiceRoleClient()

  // Step 1: Check current user's subscription history (existing logic)
  const { data: subscriptions, error } = await supabase
    .from('user_plan_subscriptions')
    .select(`
      id,
      billing_plan_cycles!inner (
        billing_plan:billing_plans!inner (
          slug
        )
      )
    `)
    .eq('user_id', userId)

  if (error) {
    logger.warn('[checkTrialEligibility] Error querying subscriptions, allowing trial', {
      userId,
      error: error.message,
    })
    // Fail open - allow trial on error to avoid blocking legitimate users
  } else {
    const hasHadProBefore = (subscriptions as any)?.some((sub: any) => 
      sub.billing_plan_cycles?.billing_plan?.slug === 'pro'
    ) || false

    if (hasHadProBefore) {
      return { eligible: false, reason: 'User has had Pro subscription before' }
    }
  }

  // Step 2: Check account deletion audit for same email
  // This prevents users from deleting and recreating accounts to get multiple trials
  if (userEmail) {
    const { data: deletionRecords, error: deletionError } = await supabase
      .from('account_deletion_audit')
      .select('id, email, deletion_initiated_at, stripe_customer_id')
      .eq('email', userEmail.toLowerCase().trim())
      .order('deletion_initiated_at', { ascending: false })
      .limit(10)

    if (deletionError) {
      logger.warn('[checkTrialEligibility] Error querying deletion audit, allowing trial', {
        userId,
        email: userEmail,
        error: deletionError.message,
      })
      // Fail open - allow trial on error
    } else if (deletionRecords && deletionRecords.length > 0) {
      // User has deleted an account with this email before
      // Check if any of those accounts had Pro subscriptions via Stripe
      if (stripe) {
        for (const record of deletionRecords) {
          if (record.stripe_customer_id) {
            try {
              // Check if this deleted customer had any Pro subscriptions
              // Note: Stripe retains subscription history even for deleted customers
              const subscriptions = await stripe.subscriptions.list({
                customer: record.stripe_customer_id,
                status: 'all',
                limit: 100,
              })

              // Check if any subscription was for Pro plan
              // We can identify Pro subscriptions by checking metadata or price
              const hadProSubscription = subscriptions.data.some(sub => {
                // Check metadata for planSlug
                if (sub.metadata?.planSlug === 'pro') {
                  return true
                }
                // Check if subscription has a price that matches Pro plan prices
                // This is a fallback if metadata is missing
                const priceId = sub.items.data[0]?.price?.id
                if (priceId) {
                  const proMonthlyPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY
                  const proAnnualPriceId = process.env.STRIPE_PRICE_PRO_ANNUAL
                  if (priceId === proMonthlyPriceId || priceId === proAnnualPriceId) {
                    return true
                  }
                }
                return false
              })

              if (hadProSubscription) {
                logger.info('[checkTrialEligibility] Found previous Pro subscription for deleted account', {
                  userId,
                  email: userEmail,
                  deletedCustomerId: record.stripe_customer_id,
                  deletionDate: record.deletion_initiated_at,
                })
                return { 
                  eligible: false, 
                  reason: 'Previous account with this email had Pro subscription' 
                }
              }
            } catch (stripeError) {
              logger.warn('[checkTrialEligibility] Error checking Stripe customer history', {
                userId,
                email: userEmail,
                stripeCustomerId: record.stripe_customer_id,
                error: stripeError instanceof Error ? stripeError.message : String(stripeError),
              })
              // Continue checking other records
            }
          }
        }
      }

      // If we found deletion records but couldn't verify Pro subscription via Stripe,
      // check if deletion was recent (within 30 days) - if so, block trial to prevent abuse
      // If deletion was older, allow trial (might be legitimate re-signup after long time)
      const mostRecentDeletion = deletionRecords[0]?.deletion_initiated_at
      if (mostRecentDeletion) {
        const deletionDate = new Date(mostRecentDeletion)
        const daysSinceDeletion = (Date.now() - deletionDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysSinceDeletion <= 30) {
          // Recent deletion - block trial to prevent abuse
          logger.info('[checkTrialEligibility] Found recent account deletion for email, blocking trial', {
            userId,
            email: userEmail,
            deletionCount: deletionRecords.length,
            daysSinceDeletion: Math.round(daysSinceDeletion),
            mostRecentDeletion,
          })
          return { 
            eligible: false, 
            reason: 'Recent account deletion detected (within 30 days)' 
          }
        } else {
          // Old deletion - might be legitimate re-signup, allow trial but log it
          logger.info('[checkTrialEligibility] Found old account deletion for email, allowing trial', {
            userId,
            email: userEmail,
            deletionCount: deletionRecords.length,
            daysSinceDeletion: Math.round(daysSinceDeletion),
            mostRecentDeletion,
          })
        }
      }
    }
  }

  // Step 3: Check Stripe for deleted customers with same email
  // This catches cases where email might have changed or audit record is missing
  if (stripe && userEmail) {
    try {
      // Search for customers with this email (including deleted ones)
      const customers = await stripe.customers.list({
        email: userEmail.toLowerCase().trim(),
        limit: 100,
      })

      for (const customer of customers.data) {
        // Check if customer is deleted
        if (customer.deleted) {
          // Check if this deleted customer had Pro subscriptions
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              status: 'all',
              limit: 100,
            })

            const hadProSubscription = subscriptions.data.some(sub => {
              if (sub.metadata?.planSlug === 'pro') {
                return true
              }
              const priceId = sub.items.data[0]?.price?.id
              if (priceId) {
                const proMonthlyPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY
                const proAnnualPriceId = process.env.STRIPE_PRICE_PRO_ANNUAL
                if (priceId === proMonthlyPriceId || priceId === proAnnualPriceId) {
                  return true
                }
              }
              return false
            })

            if (hadProSubscription) {
              logger.info('[checkTrialEligibility] Found deleted Stripe customer with Pro subscription', {
                userId,
                email: userEmail,
                deletedCustomerId: customer.id,
              })
              return { 
                eligible: false, 
                reason: 'Deleted Stripe customer with this email had Pro subscription' 
              }
            }
          } catch (subError) {
            logger.warn('[checkTrialEligibility] Error checking subscriptions for deleted customer', {
              userId,
              email: userEmail,
              customerId: customer.id,
              error: subError instanceof Error ? subError.message : String(subError),
            })
            // Continue checking other customers
          }
        }
      }
    } catch (stripeError) {
      logger.warn('[checkTrialEligibility] Error searching Stripe customers, allowing trial', {
        userId,
        email: userEmail,
        error: stripeError instanceof Error ? stripeError.message : String(stripeError),
      })
      // Fail open - allow trial on error
    }
  }

  // All checks passed - user is eligible for trial
  return { eligible: true }
}

