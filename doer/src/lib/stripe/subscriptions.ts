import Stripe from 'stripe'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { getPlanCycleBySlugAndCycle, type BillingCycle } from '@/lib/billing/plans'

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
 */
function inferPlanFromStripeSubscription(subscription: Stripe.Subscription): {
  planSlug: 'basic' | 'pro'
  billingCycle: BillingCycle
} {
  // First, try metadata
  const metadata = subscription.metadata || {}
  if (metadata.planSlug && metadata.billingCycle) {
    return {
      planSlug: metadata.planSlug as 'basic' | 'pro',
      billingCycle: metadata.billingCycle as BillingCycle,
    }
  }

  // Try to infer from price ID
  const priceId = subscription.items.data[0]?.price?.id
  if (priceId) {
    if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
      return { planSlug: 'pro', billingCycle: 'monthly' }
    }
    if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
      return { planSlug: 'pro', billingCycle: 'annual' }
    }
    if (priceId === process.env.STRIPE_PRICE_BASIC) {
      return { planSlug: 'basic', billingCycle: 'monthly' }
    }
  }

  // Try to infer from interval
  const interval = subscription.items.data[0]?.price?.recurring?.interval
  const billingCycle: BillingCycle = interval === 'year' ? 'annual' : 'monthly'
  
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

  // Get Stripe customer ID
  const stripeCustomerId = await getStripeCustomerId(userId)
  if (!stripeCustomerId) {
    return null
  }

  // Fetch active subscriptions from Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 10,
  })

  // Find the most recent active or trialing subscription
  const activeSubscription = subscriptions.data
    .filter(sub => ['active', 'trialing'].includes(sub.status))
    .sort((a, b) => (b.created || 0) - (a.created || 0))[0]

  if (!activeSubscription) {
    return null
  }

  // Infer plan details
  const { planSlug, billingCycle } = inferPlanFromStripeSubscription(activeSubscription)

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
    console.error('[getActiveSubscriptionFromStripe] Error fetching plan details:', error)
    // Fallback to default values
    planDetails = {
      name: planSlug === 'pro' ? 'Pro' : 'Basic',
      apiCreditLimit: planSlug === 'pro' ? (billingCycle === 'annual' ? 120 : 100) : 25,
      integrationActionLimit: planSlug === 'pro' ? (billingCycle === 'annual' ? 4000 : 3000) : 100,
      priceCents: null,
    }
  }

  return {
    id: activeSubscription.id,
    status: mapStripeStatus(activeSubscription.status),
    planSlug,
    billingCycle,
    currentPeriodStart: formatStripeDate((activeSubscription as any).current_period_start) || '',
    currentPeriodEnd: formatStripeDate((activeSubscription as any).current_period_end) || '',
    cancelAtPeriodEnd: activeSubscription.cancel_at_period_end || false,
    stripeCustomerId,
    planDetails,
  }
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

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 100,
  })

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
      console.error('[getAllSubscriptionsFromStripe] Error fetching plan details:', error)
      planDetails = {
        name: planSlug === 'pro' ? 'Pro' : 'Basic',
        apiCreditLimit: planSlug === 'pro' ? (billingCycle === 'annual' ? 120 : 100) : 25,
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

