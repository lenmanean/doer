import type { BillingCycle } from '../billing/plans'

type PlanSlug = 'basic' | 'pro'

export function getPriceIdForPlan(planSlug?: string | null, billingCycle?: string | null): string | undefined {
  if (!planSlug) return undefined

  const normalizedPlan = planSlug.toLowerCase() as PlanSlug
  const normalizedCycle = (billingCycle || 'monthly').toLowerCase() as BillingCycle | 'monthly'

  if (normalizedPlan === 'basic') {
    return process.env.STRIPE_PRICE_BASIC
  }

  if (normalizedPlan === 'pro') {
    if (normalizedCycle === 'annual') {
      return process.env.STRIPE_PRICE_PRO_ANNUAL
    }
    return process.env.STRIPE_PRICE_PRO_MONTHLY
  }

  return undefined
}

export function requirePriceId(planSlug: string, billingCycle: string): string {
  const priceId = getPriceIdForPlan(planSlug, billingCycle)
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for plan ${planSlug} (${billingCycle})`)
  }
  return priceId
}

