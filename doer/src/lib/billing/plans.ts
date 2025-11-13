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
  billing_plan_cycles: PlanCycleRow
}

const SUBSCRIPTION_SELECT = `
        id,
        user_id,
        status,
        billing_plan_cycle_id,
        current_period_start,
        current_period_end,
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
  console.error('[fetchPlanBySlug] Starting fetch for slug:', slug)
  
  const supabase = getServiceRoleClient()
  console.error('[fetchPlanBySlug] Service role client obtained:', {
    hasClient: !!supabase,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
  })
  
  // First, try to fetch the plan
  console.error('[fetchPlanBySlug] Querying billing_plans table...')
  const { data, error } = await supabase
    .from('billing_plans')
    .select('id, slug, name, description, metadata')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()

  console.error('[fetchPlanBySlug] Query result:', {
    hasData: !!data,
    hasError: !!error,
    errorCode: error?.code,
    errorMessage: error?.message,
  })

  if (error) {
    console.error('[fetchPlanBySlug] Database error:', {
      slug,
      error: error.message,
      code: error.code,
      details: error,
    })
    throw new Error(`Failed to fetch billing plan for slug "${slug}": ${error.message}`)
  }
  
  if (!data) {
    // Plan not found - list available plans for debugging
    console.error('[fetchPlanBySlug] Plan not found, listing all plans...')
    const { data: allPlans, error: listError } = await supabase
      .from('billing_plans')
      .select('slug, name')
      .limit(10)
    
    console.error('[fetchPlanBySlug] All plans query result:', {
      hasData: !!allPlans,
      hasError: !!listError,
      planCount: allPlans?.length || 0,
      listErrorCode: listError?.code,
      listErrorMessage: listError?.message,
    })
    
    const availablePlans = listError ? 'Unable to list plans' : (allPlans?.map(p => p.slug).join(', ') || 'none')
    
    console.error('[fetchPlanBySlug] Plan not found:', {
      requestedSlug: slug,
      availablePlans,
      totalPlans: allPlans?.length || 0,
      listError: listError ? {
        code: listError.code,
        message: listError.message,
        details: listError,
      } : null,
    })
    
    throw new Error(
      `Billing plan with slug "${slug}" not found. Available plans: ${availablePlans}`
    )
  }
  
  console.error('[fetchPlanBySlug] Plan found:', {
    slug: data.slug,
    name: data.name,
    id: data.id,
  })
  
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
    console.error('[getPlanCycleBySlugAndCycle] Invalid billing cycle value detected:', {
      cycle,
      planSlug,
      cycleType: typeof cycle,
    })
    // Convert invalid values to valid enum
    const cycleStr = String(cycle || '').toLowerCase().trim()
    if (cycleStr === 'month' || cycleStr.includes('month')) {
      normalizedCycle = 'monthly'
      console.log('[getPlanCycleBySlugAndCycle] Converted invalid cycle to monthly:', cycle, '->', normalizedCycle)
    } else if (cycleStr === 'year' || cycleStr.includes('year') || cycleStr.includes('annual')) {
      normalizedCycle = 'annual'
      console.log('[getPlanCycleBySlugAndCycle] Converted invalid cycle to annual:', cycle, '->', normalizedCycle)
    } else {
      normalizedCycle = 'monthly' // Default fallback
      console.log('[getPlanCycleBySlugAndCycle] Unknown cycle, defaulting to monthly:', cycle, '->', normalizedCycle)
    }
  }
  
  const supabase = getServiceRoleClient()
  const plan = await fetchPlanBySlug(planSlug)

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
    throw new Error(
      `Failed to load billing plan cycle "${planSlug}" (${normalizedCycle}): ${error.message}`
    )
  }
  if (!data) {
    throw new Error(`Billing plan cycle "${planSlug}" (${normalizedCycle}) not found`)
  }

  return mapPlanCycle(data)
}

export async function fetchActiveSubscription(userId: string): Promise<UserPlanSubscription | null> {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('user_plan_subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>()

  if (error) {
    throw new Error(`Failed to fetch active subscription for user ${userId}: ${error.message}`)
  }

  return data ? mapSubscription(data) : null
}

export async function ensureActiveSubscription(
  userId: string
): Promise<UserPlanSubscription> {
  const existing = await fetchActiveSubscription(userId)
  if (existing) return existing

  const planCycle = await getPlanCycleBySlugAndCycle(DEFAULT_PLAN_SLUG, DEFAULT_BILLING_CYCLE)
  const { start, end } = calculateCycleBounds(planCycle.cycle)

  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('user_plan_subscriptions')
    .insert({
      user_id: userId,
      billing_plan_cycle_id: planCycle.id,
      status: 'active',
      current_period_start: start,
      current_period_end: end,
    })
    .select(SUBSCRIPTION_SELECT)
    .limit(1)
    .maybeSingle<SubscriptionRow>()

  if (error) {
    if (error.code === '23505') {
      const latest = await fetchActiveSubscription(userId)
      if (latest) return latest
    }
    throw new Error(`Failed to create default subscription for user ${userId}: ${error.message}`)
  }
  if (!data) {
    const latest = await fetchActiveSubscription(userId)
    if (latest) return latest
    throw new Error(`Unable to create or fetch subscription for user ${userId}`)
  }

  return mapSubscription(data)
}

export function getUsageLimits(planCycle: BillingPlanCycle): Record<UsageMetric, number> {
  return {
    api_credits: planCycle.apiCreditLimit,
    integration_actions: planCycle.integrationActionLimit,
  }
}

export async function assignSubscription(
  userId: string,
  planSlug: string,
  cycle: BillingCycle
): Promise<UserPlanSubscription> {
  const planCycle = await getPlanCycleBySlugAndCycle(planSlug, cycle)
  const { start, end } = calculateCycleBounds(planCycle.cycle)
  const supabase = getServiceRoleClient()

  const cancelResult = await supabase
    .from('user_plan_subscriptions')
    .update({
      status: 'canceled',
      cancel_at: end,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])

  if (cancelResult.error) {
    throw new Error(`Failed to cancel existing subscriptions: ${cancelResult.error.message}`)
  }

  const inserted = await supabase
    .from('user_plan_subscriptions')
    .insert({
      user_id: userId,
      billing_plan_cycle_id: planCycle.id,
      status: 'active',
      current_period_start: start,
      current_period_end: end,
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

  const metrics: Array<{ metric: UsageMetric; allocation: number }> = [
    { metric: 'api_credits', allocation: planCycle.apiCreditLimit },
    { metric: 'integration_actions', allocation: planCycle.integrationActionLimit },
  ]

  for (const { metric, allocation } of metrics) {
    const { error } = await supabase.rpc('reset_usage_cycle', {
      p_user_id: userId,
      p_metric: metric,
      p_cycle_start: start,
      p_cycle_end: end,
      p_allocation: allocation,
      p_reference: {
        reason: 'assignment',
        billing_plan_cycle_id: planCycle.id,
      },
    })

    if (error) {
      throw new Error(`Failed to reset ${metric} usage: ${error.message}`)
    }
  }

  return mapSubscription(subscriptionRow)
}


