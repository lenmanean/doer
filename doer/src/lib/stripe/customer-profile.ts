import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'
import Stripe from 'stripe'
import { stripeWithRetry } from '@/lib/stripe/retry'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

interface UpdateStripeProfileParams {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

export async function updateStripeCustomerProfile(userId: string, params: UpdateStripeProfileParams) {
  if (!stripe) {
    logger.warn('[customer-profile] Stripe not configured, skipping profile sync', { userId })
    return
  }

  const supabase = getServiceRoleClient()
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  const stripeCustomerId = userSettings?.stripe_customer_id
  if (!stripeCustomerId) {
    logger.debug('[customer-profile] No Stripe customer associated with user; skipping update', { userId })
    return
  }

  const updates: Stripe.CustomerUpdateParams = {}
  if (params.email) {
    updates.email = params.email
  }

  if (params.firstName) {
    updates.name = params.lastName ? `${params.firstName} ${params.lastName || ''}`.trim() : params.firstName
  } else if (params.lastName) {
    updates.name = params.lastName
  }

  if (!Object.keys(updates).length) {
    return
  }

  try {
    await stripeWithRetry(() =>
      stripe!.customers.update(stripeCustomerId, updates)
    )
    logger.info('[customer-profile] Synced Stripe customer profile', {
      userId,
      stripeCustomerId,
    })
  } catch (error) {
    logger.error('[customer-profile] Failed to sync Stripe profile', error as Error, {
      userId,
      stripeCustomerId,
    })
  }
}

