import Stripe from 'stripe'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { getPlanCycleBySlugAndCycle } from '@/lib/billing/plans'
import { initializeUsageBalances } from '@/lib/usage/initialize-balances'
import { logger } from '@/lib/logger'
import { stripeWithRetry } from '@/lib/stripe/retry'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * Automatically assign Basic plan to a user
 * Creates a free subscription in Stripe for Basic plan users
 * This should be called when a user signs up or first uses the app
 */
export async function autoAssignBasicPlan(userId: string): Promise<void> {
  if (!stripe) {
    logger.warn('Stripe not configured, skipping Basic plan assignment', { userId })
    return
  }

  const supabase = getServiceRoleClient()

  // Check if user already has a Stripe customer ID
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)

  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('stripe_customer_id, first_name, last_name, email')
    .eq('user_id', userId)
    .maybeSingle()

  let stripeCustomerId = userSettings?.stripe_customer_id

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

  // Create Stripe customer if doesn't exist
  if (!stripeCustomerId) {
    const customer = await stripeWithRetry(() =>
      stripe.customers.create({
        email,
        name: firstName && lastName ? `${firstName} ${lastName}` : firstName,
        metadata: {
          userId,
        },
      })
    )

    stripeCustomerId = customer.id

    // Save Stripe customer ID
    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
      }, {
        onConflict: 'user_id',
      })

    logger.info('Created Stripe customer', { userId, stripeCustomerId })
  } else {
    try {
      await stripeWithRetry(() =>
        stripe!.customers.update(stripeCustomerId!, {
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

  // Check if user already has an active subscription (with retry logic)
  const subscriptions = await stripeWithRetry(() =>
    stripe.subscriptions.list({
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

  // Get Basic plan price ID
  const basicPriceId = process.env.STRIPE_PRICE_BASIC
  if (!basicPriceId) {
    logger.warn('STRIPE_PRICE_BASIC not configured, cannot assign Basic plan', { userId })
    return
  }

  // Create free Basic plan subscription in Stripe (with retry logic)
  try {
    const subscription = await stripeWithRetry(() =>
      stripe.subscriptions.create({
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
      })
    )

    logger.info('Created Basic plan subscription', { userId, subscriptionId: subscription.id })

    // Initialize usage balances
    try {
      await initializeUsageBalances(userId)
      logger.info('Initialized usage balances for Basic plan', { userId })
    } catch (error) {
      logger.error('Failed to initialize usage balances', error as Error, { userId })
      // Don't fail - balances will be initialized on first use
    }
  } catch (error) {
    logger.error('Failed to create Basic plan subscription', error as Error, { userId, stripeCustomerId })
    throw error
  }
}

