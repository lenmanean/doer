import Stripe from 'stripe'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { getPlanCycleBySlugAndCycle, type BillingCycle } from '@/lib/billing/plans'
import { logger } from '@/lib/logger'
import { subscriptionCache } from '@/lib/cache/subscription-cache'
import { stripeWithRetry } from '@/lib/stripe/retry'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

export interface StripeSubscription {
  id: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled'
  planSlug: 'basic' | 'pro'
  billingCycle: BillingCycle
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string
  planDetails: {
    name: string
    apiCreditLimit: number
    integrationActionLimit: number
    priceCents: number | null
  }
}

/**
 * Get Stripe customer ID for a user
 */
async function getStripeCustomerId(userId: string): Promise<string | null> {
  const supabase = getServiceRoleClient()
  const { data } = await supabase
    .from('user_settings')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  
  return data?.stripe_customer_id || null
}

/**
 * Infer plan slug and billing cycle from Stripe subscription
 * Uses the same priority order as inferPlanFromSubscription in subscription-sync.ts:
 * 1. Metadata (most reliable)
 * 2. Price ID from environment variables
 * 3. Interval-based fallback (least reliable)
 */
function inferPlanFromStripeSubscription(subscription: Stripe.Subscription): {
  planSlug: 'basic' | 'pro'
  billingCycle: BillingCycle
} {
  const subscriptionId = subscription.id
  
  // Priority 1: Check metadata (most reliable source)
  const metadata = subscription.metadata || {}
  if (metadata.planSlug && metadata.billingCycle) {
    logger.info('[subscriptions] Inferred plan from metadata', {
      subscriptionId,
      planSlug: metadata.planSlug,
      billingCycle: metadata.billingCycle,
      method: 'metadata',
    })
    return {
      planSlug: metadata.planSlug as 'basic' | 'pro',
      billingCycle: metadata.billingCycle as BillingCycle,
    }
  }

  // Priority 2: Check price ID against environment variables
  const priceId = subscription.items.data[0]?.price?.id
  if (priceId) {
    if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
      logger.info('[subscriptions] Inferred plan from env var (Pro Monthly)', {
        subscriptionId,
        priceId,
        method: 'env_var',
      })
      return { planSlug: 'pro', billingCycle: 'monthly' }
    }
    if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
      logger.info('[subscriptions] Inferred plan from env var (Pro Annual)', {
        subscriptionId,
        priceId,
        method: 'env_var',
      })
      return { planSlug: 'pro', billingCycle: 'annual' }
    }
    if (priceId === process.env.STRIPE_PRICE_BASIC) {
      logger.info('[subscriptions] Inferred plan from env var (Basic)', {
        subscriptionId,
        priceId,
        method: 'env_var',
      })
      return { planSlug: 'basic', billingCycle: 'monthly' }
    }
  }

  // Priority 3: Fallback to interval-based detection (least reliable)
  const interval = subscription.items.data[0]?.price?.recurring?.interval
  const billingCycle: BillingCycle = interval === 'year' ? 'annual' : 'monthly'
  
  logger.warn('[subscriptions] Inferred plan from interval fallback (metadata and price lookup failed)', {
    subscriptionId,
    priceId: priceId || 'missing',
    interval: interval || 'missing',
    planSlug: 'pro',
    billingCycle,
    method: 'interval_fallback',
    metadata: subscription.metadata || {},
  })
  
  // Default to pro if we can't determine
  return { planSlug: 'pro', billingCycle }
}

/**
 * Map Stripe subscription status to our status
 */
function mapStripeStatus(stripeStatus: string): 'active' | 'trialing' | 'past_due' | 'canceled' {
  const normalized = stripeStatus.toLowerCase().trim()
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

/**
 * Format Stripe timestamp to date string (YYYY-MM-DD)
 */
function formatStripeDate(timestamp: number | null | undefined): string | undefined {
  if (!timestamp) return undefined
  const date = new Date(timestamp * 1000)
  return date.toISOString().split('T')[0]
}

/**
 * Fetch active subscription directly from Stripe
 * This is the source of truth - no database sync needed
 */
export async function getActiveSubscriptionFromStripe(
  userId: string
): Promise<StripeSubscription | null> {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }

  // Check cache first
  const cacheKey = `subscription:${userId}`
  const cached = subscriptionCache.get<StripeSubscription | null>(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  // Get Stripe customer ID
  const stripeCustomerId = await getStripeCustomerId(userId)
  if (!stripeCustomerId) {
    // Cache null result for shorter TTL (1 minute) to avoid repeated lookups
    subscriptionCache.set(cacheKey, null, 60 * 1000)
    return null
  }

  // Fetch active subscriptions from Stripe (with retry logic)
  const subscriptions = await stripeWithRetry(() =>
    stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10,
    })
  )

  // Find the most recent active or trialing subscription
  // Also check incomplete subscriptions - if payment succeeded, they might become active soon
  let activeSubscription = subscriptions.data
    .filter(sub => ['active', 'trialing'].includes(sub.status))
    .sort((a, b) => (b.created || 0) - (a.created || 0))[0]

  // If no active subscription, check for incomplete ones with successful payments
  // This handles the case where payment succeeded but subscription status hasn't updated yet
  if (!activeSubscription) {
    const incompleteSubscriptions = subscriptions.data
      .filter(sub => sub.status === 'incomplete')
      .sort((a, b) => (b.created || 0) - (a.created || 0))

    // Check if any incomplete subscription has a successful payment
    for (const incompleteSub of incompleteSubscriptions) {
      try {
        // Retrieve the subscription with invoice to check payment status
        const subWithInvoice = await stripeWithRetry(() =>
          stripe.subscriptions.retrieve(incompleteSub.id, {
            expand: ['latest_invoice', 'latest_invoice.payment_intent'],
          })
        )

        const invoice = subWithInvoice.latest_invoice
        if (invoice) {
          let invoiceObj: Stripe.Invoice | null = null
          if (typeof invoice === 'string') {
            invoiceObj = await stripeWithRetry(() => stripe.invoices.retrieve(invoice))
          } else if (invoice && typeof invoice === 'object') {
            invoiceObj = invoice as Stripe.Invoice
          }

          if (invoiceObj) {
            const paymentIntent = (invoiceObj as any).payment_intent
            let paymentIntentObj: Stripe.PaymentIntent | null = null

            if (typeof paymentIntent === 'string') {
              paymentIntentObj = await stripeWithRetry(() => stripe.paymentIntents.retrieve(paymentIntent))
            } else if (paymentIntent && typeof paymentIntent === 'object') {
              paymentIntentObj = paymentIntent as Stripe.PaymentIntent
            }

            // If payment succeeded, treat this subscription as effectively active
            // Stripe will update the status shortly, but we can show it now
            if (paymentIntentObj?.status === 'succeeded') {
              logger.info('Found incomplete subscription with succeeded payment, treating as active', {
                subscriptionId: incompleteSub.id,
                userId,
              })
              activeSubscription = incompleteSub
              break
            }
          }
        }
      } catch (checkError) {
        logger.warn('Error checking incomplete subscription payment status', {
          error: checkError instanceof Error ? checkError.message : String(checkError),
          subscriptionId: incompleteSub.id,
        })
        // Continue checking other subscriptions
      }
    }
  }

  if (!activeSubscription) {
    // Cache null result for shorter TTL (1 minute) to avoid repeated lookups
    subscriptionCache.set(cacheKey, null, 60 * 1000)
    return null
  }

  // Infer plan details
  const { planSlug, billingCycle } = inferPlanFromStripeSubscription(activeSubscription)

  // Determine subscription status
  // If subscription is incomplete but payment succeeded, treat it as active
  let subscriptionStatus = mapStripeStatus(activeSubscription.status)
  if (activeSubscription.status === 'incomplete') {
    // We already checked payment status above, so if we're using this subscription,
    // it means payment succeeded - treat as active
    subscriptionStatus = 'active'
  }

  // Get plan details from our database (for limits and pricing)
  let planDetails
  try {
    const planCycle = await getPlanCycleBySlugAndCycle(planSlug, billingCycle)
    planDetails = {
      name: planCycle.plan.name,
      apiCreditLimit: planCycle.apiCreditLimit,
      integrationActionLimit: planCycle.integrationActionLimit,
      priceCents: planCycle.priceCents,
    }
  } catch (error) {
    logger.error('Error fetching plan details', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId,
      planSlug,
      billingCycle,
    })
    // Fallback to default values
    planDetails = {
      name: planSlug === 'pro' ? 'Pro' : 'Basic',
      apiCreditLimit: planSlug === 'pro' ? (billingCycle === 'annual' ? 150 : 100) : 10,
      integrationActionLimit: planSlug === 'pro' ? (billingCycle === 'annual' ? 4000 : 3000) : 100,
      priceCents: null,
    }
  }

  const result: StripeSubscription = {
    id: activeSubscription.id,
    status: subscriptionStatus,
    planSlug,
    billingCycle,
    currentPeriodStart: formatStripeDate((activeSubscription as any).current_period_start) || '',
    currentPeriodEnd: formatStripeDate((activeSubscription as any).current_period_end) || '',
    cancelAtPeriodEnd: activeSubscription.cancel_at_period_end || false,
    stripeCustomerId,
    planDetails,
  }

  // Cache the result
  subscriptionCache.set(cacheKey, result)
  return result
}

/**
 * Get all subscriptions for a user (for history/management)
 */
export async function getAllSubscriptionsFromStripe(
  userId: string
): Promise<StripeSubscription[]> {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }

  const stripeCustomerId = await getStripeCustomerId(userId)
  if (!stripeCustomerId) {
    return []
  }

  const subscriptions = await stripeWithRetry(() =>
    stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 100,
    })
  )

  const results: StripeSubscription[] = []

  for (const subscription of subscriptions.data) {
    const { planSlug, billingCycle } = inferPlanFromStripeSubscription(subscription)

    let planDetails
    try {
      const planCycle = await getPlanCycleBySlugAndCycle(planSlug, billingCycle)
      planDetails = {
        name: planCycle.plan.name,
        apiCreditLimit: planCycle.apiCreditLimit,
        integrationActionLimit: planCycle.integrationActionLimit,
        priceCents: planCycle.priceCents,
      }
    } catch (error) {
      logger.error('Error fetching plan details', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId,
        planSlug,
        billingCycle,
      })
      planDetails = {
        name: planSlug === 'pro' ? 'Pro' : 'Basic',
        apiCreditLimit: planSlug === 'pro' ? (billingCycle === 'annual' ? 150 : 100) : 10,
        integrationActionLimit: planSlug === 'pro' ? (billingCycle === 'annual' ? 4000 : 3000) : 100,
        priceCents: null,
      }
    }

    results.push({
      id: subscription.id,
      status: mapStripeStatus(subscription.status),
      planSlug,
      billingCycle,
      currentPeriodStart: formatStripeDate((subscription as any).current_period_start) || '',
      currentPeriodEnd: formatStripeDate((subscription as any).current_period_end) || '',
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      stripeCustomerId,
      planDetails,
    })
  }

  return results.sort((a, b) => 
    new Date(b.currentPeriodEnd).getTime() - new Date(a.currentPeriodEnd).getTime()
  )
}

