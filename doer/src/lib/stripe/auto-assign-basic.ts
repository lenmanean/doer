import Stripe from 'stripe'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'
import { stripeWithRetry } from '@/lib/stripe/retry'
import { syncSubscriptionSnapshot } from '@/lib/billing/subscription-sync'
import { ensureStripeCustomer } from './customers'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * Automatically assign Basic plan to a user
 * Creates a free subscription in Stripe for Basic plan users
 * This should be called when a user signs up or first uses the app
 * 
 * This function is idempotent - multiple concurrent calls will not create duplicate subscriptions.
 */
export async function autoAssignBasicPlan(userId: string): Promise<void> {
  if (!stripe) {
    logger.warn('Stripe not configured, skipping Basic plan assignment', { userId })
    return
  }

  const supabase = getServiceRoleClient()

  // Get user info for customer creation
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('stripe_customer_id, first_name, last_name, email')
    .eq('user_id', userId)
    .maybeSingle()

  const email =
    userSettings?.email ||
    authUser?.user?.email ||
    (authUser?.user?.user_metadata as any)?.email ||
    undefined

  const firstName =
    userSettings?.first_name ||
    (authUser?.user?.user_metadata as any)?.first_name ||
    authUser?.user?.email?.split('@')[0] ||
    undefined

  const lastName =
    userSettings?.last_name ||
    (authUser?.user?.user_metadata as any)?.last_name ||
    undefined

  // Use ensureStripeCustomer to prevent duplicate customer creation
  // This handles race conditions and ensures only one customer per user
  const stripeCustomerId = await ensureStripeCustomer({
    supabase,
    stripe,
    userId,
    email,
    metadata: {
      autoAssigned: 'true',
    },
  })

  // Update customer profile if we have name info
  if (firstName || lastName) {
    try {
      await stripeWithRetry(() =>
        stripe!.customers.update(stripeCustomerId, {
          email,
          name: firstName && lastName ? `${firstName} ${lastName}` : firstName,
        })
      )
    } catch (updateError) {
      logger.warn('Failed to update existing Stripe customer profile', {
        userId,
        stripeCustomerId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      })
    }
  }

  // Check if user already has an active subscription
  // Use retry logic and check both Stripe and database to prevent duplicates
  const subscriptions = await stripeWithRetry(() =>
    stripe!.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10,
    })
  )

  const hasActiveSubscription = subscriptions.data.some(
    sub => ['active', 'trialing'].includes(sub.status)
  )

  if (hasActiveSubscription) {
    logger.debug('User already has an active subscription, skipping', { userId, stripeCustomerId })
    return
  }

  // Double-check in database to prevent race conditions
  // Another request might have created a subscription between our Stripe check and now
  const { data: dbSubscriptions } = await supabase
    .from('user_plan_subscriptions')
    .select('id, status, external_subscription_id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])

  if (dbSubscriptions && dbSubscriptions.length > 0) {
    logger.debug('User already has active subscription in database, skipping', {
      userId,
      stripeCustomerId,
      subscriptionCount: dbSubscriptions.length,
    })
    return
  }

  // Get Basic plan price ID
  const basicPriceId = process.env.STRIPE_PRICE_BASIC
  if (!basicPriceId) {
    logger.warn('STRIPE_PRICE_BASIC not configured, cannot assign Basic plan', { userId })
    return
  }

  // Create free Basic plan subscription in Stripe with idempotency key
  // Use userId + timestamp (rounded to minute) as idempotency key to prevent duplicates
  // This ensures that multiple concurrent calls within the same minute will create only one subscription
  const idempotencyKey = `basic-subscription-${userId}-${Math.floor(Date.now() / 60000)}`

  try {
    let subscription: Stripe.Subscription
    
    try {
      subscription = await stripeWithRetry(() =>
        stripe!.subscriptions.create(
          {
            customer: stripeCustomerId,
            items: [
              {
                price: basicPriceId,
              },
            ],
            metadata: {
              userId,
              planSlug: 'basic',
              billingCycle: 'monthly',
              autoAssigned: 'true',
            },
          },
          {
            idempotencyKey,
          }
        )
      )
    } catch (createError: any) {
      // If idempotency key collision, subscription was already created
      // Check for existing subscription with our metadata
      if (createError?.code === 'idempotency_key_in_use' || createError?.message?.includes('already been used')) {
        logger.info('Subscription creation idempotency key collision, checking for existing subscription', {
          userId,
          stripeCustomerId,
        })
        
        // Re-check subscriptions - one might have been created by another request
        const recheckSubscriptions = await stripeWithRetry(() =>
          stripe!.subscriptions.list({
            customer: stripeCustomerId,
            status: 'all',
            limit: 10,
          })
        )
        
        const existingSubscription = recheckSubscriptions.data.find(
          sub => 
            sub.metadata?.userId === userId &&
            sub.metadata?.autoAssigned === 'true' &&
            ['active', 'trialing', 'incomplete'].includes(sub.status)
        )
        
        if (existingSubscription) {
          logger.info('Found existing auto-assigned subscription', {
            userId,
            subscriptionId: existingSubscription.id,
          })
          subscription = existingSubscription
        } else {
          // If we can't find it, this is a real error
          throw createError
        }
      } else {
        throw createError
      }
    }

    logger.info('Created Basic plan subscription', { userId, subscriptionId: subscription.id })

    // Sync to database
    try {
      await syncSubscriptionSnapshot(subscription, { userId })
    } catch (syncError) {
      logger.error('Failed to persist subscription snapshot', syncError as Error, {
        userId,
        subscriptionId: subscription.id,
      })
      // Don't throw - subscription exists in Stripe, webhook will sync it
    }
  } catch (error: any) {
    // If error is about duplicate subscription, that's okay - another request created it
    if (error?.message?.includes('already exists') || error?.code === 'resource_already_exists') {
      logger.info('Subscription already exists (created by concurrent request)', {
        userId,
        stripeCustomerId,
      })
      return
    }
    
    logger.error('Failed to create Basic plan subscription', error as Error, {
      userId,
      stripeCustomerId,
    })
    throw error
  }
}

