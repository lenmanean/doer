import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { formatDateForDB } from '@/lib/date-utils'

export type BillingCycle = 'monthly' | 'annual'
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled'
export type UsageMetric = 'api_credits' | 'integration_actions'
export type ApiTokenScope =
  | 'plans.generate'
  | 'plans.read'
  | 'plans.schedule'
  | 'clarify'
  | 'reschedules'
  | 'integrations'
  | 'admin'

export interface BillingPlan {
  id: string
  slug: string
  name: string
  description?: string | null
  metadata?: Record<string, unknown>
}

export interface BillingPlanCycle {
  id: string
  cycle: BillingCycle
  apiCreditLimit: number
  integrationActionLimit: number
  priceCents: number | null
  metadata?: Record<string, unknown>
  plan: BillingPlan
}

export interface UserPlanSubscription {
  id: string
  userId: string
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  billingPlanCycleId: string
  planCycle: BillingPlanCycle
}

const DEFAULT_PLAN_SLUG = 'basic'
const DEFAULT_BILLING_CYCLE: BillingCycle = 'monthly'

type PlanCycleRow = {
  id: string
  cycle: BillingCycle
  api_credit_limit: number
  integration_action_limit: number
  price_cents: number | null
  metadata?: Record<string, unknown> | null
  billing_plan: {
    id: string
    slug: string
    name: string
    description?: string | null
    metadata?: Record<string, unknown> | null
  }
}

type SubscriptionRow = {
  id: string
  user_id: string
  status: SubscriptionStatus
  billing_plan_cycle_id: string
  current_period_start: string
  current_period_end: string
  external_customer_id?: string | null
  external_subscription_id?: string | null
  billing_plan_cycles: PlanCycleRow
}

const SUBSCRIPTION_SELECT = `
        id,
        user_id,
        status,
        billing_plan_cycle_id,
        current_period_start,
        current_period_end,
        external_customer_id,
        external_subscription_id,
        billing_plan_cycles!inner (
          id,
          cycle,
          api_credit_limit,
          integration_action_limit,
          price_cents,
          metadata,
          billing_plan:billing_plans (
            id,
            slug,
            name,
            description,
            metadata
          )
        )
      `

function mapPlanCycle(row: PlanCycleRow): BillingPlanCycle {
  return {
    id: row.id,
    cycle: row.cycle,
    apiCreditLimit: row.api_credit_limit,
    integrationActionLimit: row.integration_action_limit,
    priceCents: row.price_cents,
    metadata: row.metadata ?? undefined,
    plan: {
      id: row.billing_plan.id,
      slug: row.billing_plan.slug,
      name: row.billing_plan.name,
      description: row.billing_plan.description,
      metadata: row.billing_plan.metadata ?? undefined,
    },
  }
}

function mapSubscription(row: SubscriptionRow): UserPlanSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    billingPlanCycleId: row.billing_plan_cycle_id,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    planCycle: mapPlanCycle(row.billing_plan_cycles),
  }
}

function calculateCycleBounds(cycle: BillingCycle, referenceDate = new Date()) {
  const utc = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  )

  if (cycle === 'annual') {
    const start = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
    const end = new Date(Date.UTC(utc.getUTCFullYear() + 1, 0, 1))
    end.setUTCDate(end.getUTCDate() - 1)
    return {
      start: formatDateForDB(start),
      end: formatDateForDB(end),
    }
  }

  const start = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), 1))
  const end = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 1))
  end.setUTCDate(end.getUTCDate() - 1)
  return {
    start: formatDateForDB(start),
    end: formatDateForDB(end),
  }
}

async function fetchPlanBySlug(slug: string) {
  const supabase = getServiceRoleClient()
  
  const { data, error } = await supabase
    .from('billing_plans')
    .select('id, slug, name, description, metadata')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch billing plan for slug "${slug}": ${error.message}`)
  }
  
  if (!data) {
    // Plan not found - list available plans for error message
    const { data: allPlans, error: listError } = await supabase
      .from('billing_plans')
      .select('slug, name')
      .limit(10)
    
    const availablePlans = listError ? 'Unable to list plans' : (allPlans?.map(p => p.slug).join(', ') || 'none')
    
    throw new Error(
      `Billing plan with slug "${slug}" not found. Available plans: ${availablePlans}`
    )
  }
  
  return data
}

export async function getPlanCycleById(id: string): Promise<BillingPlanCycle | null> {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('billing_plan_cycles')
    .select(
      `
        id,
        cycle,
        api_credit_limit,
        integration_action_limit,
        price_cents,
        metadata,
        billing_plan:billing_plans (
          id,
          slug,
          name,
          description,
          metadata
        )
      `
    )
    .eq('id', id)
    .limit(1)
    .maybeSingle<PlanCycleRow>()

  if (error) {
    throw new Error(`Failed to load billing plan cycle ${id}: ${error.message}`)
  }

  return data ? mapPlanCycle(data) : null
}

export async function getPlanCycleBySlugAndCycle(
  planSlug: string,
  cycle: BillingCycle
): Promise<BillingPlanCycle> {
  // Validate and normalize cycle to ensure it's a valid BillingCycle enum value
  // This prevents enum errors from invalid values like "month" instead of "monthly"
  // At runtime, cycle might be invalid even though TypeScript says it's BillingCycle
  let normalizedCycle: BillingCycle = cycle
  
  // Runtime type guard - check if cycle is actually a valid BillingCycle
  if (cycle !== 'monthly' && cycle !== 'annual') {
    // Invalid billing cycle value detected, normalizing
    // Convert invalid values to valid enum
    const cycleStr = String(cycle || '').toLowerCase().trim()
    if (cycleStr === 'month' || cycleStr.includes('month')) {
      normalizedCycle = 'monthly'
    } else if (cycleStr === 'year' || cycleStr.includes('year') || cycleStr.includes('annual')) {
      normalizedCycle = 'annual'
    } else {
      normalizedCycle = 'monthly' // Default fallback
    }
  }
  
  const supabase = getServiceRoleClient()
  const plan = await fetchPlanBySlug(planSlug)

  // Log for debugging
  console.log('[getPlanCycleBySlugAndCycle] Querying for:', {
    planSlug,
    normalizedCycle,
    planId: plan.id,
  })

  const { data, error } = await supabase
    .from('billing_plan_cycles')
    .select(
      `
        id,
        cycle,
        api_credit_limit,
        integration_action_limit,
        price_cents,
        metadata,
        billing_plan:billing_plans (
          id,
          slug,
          name,
          description,
          metadata
        )
      `
    )
    .eq('billing_plan_id', plan.id)
    .eq('cycle', normalizedCycle)
    .limit(1)
    .maybeSingle<PlanCycleRow>()

  if (error) {
    console.error('[getPlanCycleBySlugAndCycle] Database error:', {
      planSlug,
      normalizedCycle,
      planId: plan.id,
      error: error.message,
      errorCode: error.code,
    })
    throw new Error(
      `Failed to load billing plan cycle "${planSlug}" (${normalizedCycle}): ${error.message}`
    )
  }
  if (!data) {
    // Log available cycles for debugging
    const { data: allCycles } = await supabase
      .from('billing_plan_cycles')
      .select('cycle, billing_plan_id')
      .eq('billing_plan_id', plan.id)
    
    console.error('[getPlanCycleBySlugAndCycle] Plan cycle not found:', {
      planSlug,
      normalizedCycle,
      planId: plan.id,
      availableCycles: allCycles?.map(c => c.cycle) || [],
    })
    
    throw new Error(
      `Billing plan cycle "${planSlug}" (${normalizedCycle}) not found. Available cycles for this plan: ${allCycles?.map(c => c.cycle).join(', ') || 'none'}`
    )
  }

  console.log('[getPlanCycleBySlugAndCycle] Found plan cycle:', {
    planSlug,
    cycle: data.cycle,
    id: data.id,
  })

  return mapPlanCycle(data)
}

/**
 * @deprecated This function is no longer used. Subscriptions are now queried directly from Stripe.
 * This function has been removed as part of the migration away from user_plan_subscriptions table.
 */

export function getUsageLimits(planCycle: BillingPlanCycle): Record<UsageMetric, number> {
  return {
    api_credits: planCycle.apiCreditLimit,
    integration_actions: planCycle.integrationActionLimit,
  }
}

/**
 * @deprecated This function writes to the deprecated user_plan_subscriptions table.
 * It is only kept for the mock webhook endpoint. In production, subscriptions should be
 * created directly in Stripe and queried via getActiveSubscriptionFromStripe.
 * 
 * TODO: Remove this function once mock webhook is no longer needed.
 */
export async function assignSubscription(
  userId: string,
  planSlug: string,
  cycle: BillingCycle,
  options?: {
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    status?: SubscriptionStatus
    currentPeriodStart?: string
    currentPeriodEnd?: string
  }
): Promise<UserPlanSubscription> {
  const planCycle = await getPlanCycleBySlugAndCycle(planSlug, cycle)
  const { start, end } = calculateCycleBounds(planCycle.cycle)
  const supabase = getServiceRoleClient()

  // Use provided dates or calculate from cycle
  const periodStart = options?.currentPeriodStart || start
  const periodEnd = options?.currentPeriodEnd || end
  const status = options?.status || 'active'

  // Check if subscription with this Stripe ID already exists (idempotency)
  if (options?.stripeSubscriptionId) {
    const { data: existingByStripeId } = await supabase
      .from('user_plan_subscriptions')
      .select(SUBSCRIPTION_SELECT)
      .eq('external_subscription_id', options.stripeSubscriptionId)
      .maybeSingle<SubscriptionRow>()

    if (existingByStripeId) {
      // Subscription with Stripe ID already exists, updating
      
      // Update existing subscription
      const { data: updated, error: updateError } = await supabase
        .from('user_plan_subscriptions')
        .update({
          user_id: userId,
          billing_plan_cycle_id: planCycle.id,
          status: status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          external_customer_id: options.stripeCustomerId || existingByStripeId.external_customer_id,
          external_subscription_id: options.stripeSubscriptionId,
          updated_at: new Date().toISOString(),
        })
        .eq('external_subscription_id', options.stripeSubscriptionId)
        .select(SUBSCRIPTION_SELECT)
        .maybeSingle<SubscriptionRow>()

      if (updateError) {
        throw new Error(`Failed to update existing subscription: ${updateError.message}`)
      }

      if (updated) {
        // Cancel other active subscriptions for this user
        await supabase
          .from('user_plan_subscriptions')
          .update({
            status: 'canceled',
            cancel_at: periodEnd,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .in('status', ['active', 'trialing'])
          .neq('external_subscription_id', options.stripeSubscriptionId)

        // Update usage balances
        const metrics: Array<{ metric: UsageMetric; allocation: number }> = [
          { metric: 'api_credits', allocation: planCycle.apiCreditLimit },
          { metric: 'integration_actions', allocation: planCycle.integrationActionLimit },
        ]

        for (const { metric, allocation } of metrics) {
          const { error } = await supabase.rpc('reset_usage_cycle', {
            p_user_id: userId,
            p_metric: metric,
            p_cycle_start: periodStart,
            p_cycle_end: periodEnd,
            p_allocation: allocation,
            p_reference: {
              reason: 'assignment',
              billing_plan_cycle_id: planCycle.id,
              stripe_subscription_id: options.stripeSubscriptionId,
            },
          })

          if (error) {
            // Don't throw - usage reset is not critical for subscription assignment
          }
        }

        return mapSubscription(updated)
      }
    }
  }

  // Cancel existing active subscriptions for this user
  const cancelResult = await supabase
    .from('user_plan_subscriptions')
    .update({
      status: 'canceled',
      cancel_at: periodEnd,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])

  if (cancelResult.error) {
    throw new Error(`Failed to cancel existing subscriptions: ${cancelResult.error.message}`)
  }

  // Insert new subscription
  const inserted = await supabase
    .from('user_plan_subscriptions')
    .insert({
      user_id: userId,
      billing_plan_cycle_id: planCycle.id,
      status: status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      external_customer_id: options?.stripeCustomerId || null,
      external_subscription_id: options?.stripeSubscriptionId || null,
    })
    .select(SUBSCRIPTION_SELECT)
    .maybeSingle<SubscriptionRow>()

  let subscriptionRow: SubscriptionRow | null = inserted.data ?? null

  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('user_plan_subscriptions')
        .select(SUBSCRIPTION_SELECT)
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle<SubscriptionRow>()

      if (fetchError) {
        throw new Error(`Failed to fetch existing subscription after duplicate: ${fetchError.message}`)
      }

      subscriptionRow = existing ?? null
    } else {
      throw new Error(`Failed to assign subscription: ${inserted.error.message}`)
    }
  }

  if (!subscriptionRow) {
    throw new Error('Unable to determine assigned subscription record')
  }

  // If Stripe IDs were provided but not stored, update the record
  if ((options?.stripeCustomerId || options?.stripeSubscriptionId) && subscriptionRow) {
    const updateData: Partial<SubscriptionRow> = {}
    if (options.stripeCustomerId && !subscriptionRow.external_customer_id) {
      updateData.external_customer_id = options.stripeCustomerId
    }
    if (options.stripeSubscriptionId && !subscriptionRow.external_subscription_id) {
      updateData.external_subscription_id = options.stripeSubscriptionId
    }

    if (Object.keys(updateData).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('user_plan_subscriptions')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionRow.id)
        .select(SUBSCRIPTION_SELECT)
        .maybeSingle<SubscriptionRow>()

      if (!updateError && updated) {
        subscriptionRow = updated
      }
    }
  }

  const metrics: Array<{ metric: UsageMetric; allocation: number }> = [
    { metric: 'api_credits', allocation: planCycle.apiCreditLimit },
    { metric: 'integration_actions', allocation: planCycle.integrationActionLimit },
  ]

  for (const { metric, allocation } of metrics) {
    const { error } = await supabase.rpc('reset_usage_cycle', {
      p_user_id: userId,
      p_metric: metric,
      p_cycle_start: periodStart,
      p_cycle_end: periodEnd,
      p_allocation: allocation,
      p_reference: {
        reason: 'assignment',
        billing_plan_cycle_id: planCycle.id,
        stripe_subscription_id: options?.stripeSubscriptionId || null,
      },
    })

    if (error) {
      console.error(`Failed to reset ${metric} usage:`, error)
      // Don't throw - usage reset is not critical for subscription assignment
    }
  }

  return mapSubscription(subscriptionRow)
}


