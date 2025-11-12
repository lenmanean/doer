import type { PostgrestError } from '@supabase/supabase-js'

import {
  ensureActiveSubscription,
  getUsageLimits,
  type UsageMetric,
  type UserPlanSubscription,
} from '@/lib/billing/plans'
import { getServiceRoleClient } from '@/lib/supabase/service-role'

const PLAN_ENFORCEMENT_ENABLED = (process.env.PLAN_ENFORCEMENT_ENABLED || '').toLowerCase() === 'true'

export interface ReservationResult {
  remaining: number
}

export type UsageReference = Record<string, unknown>

export class UsageLimitExceeded extends Error {
  public readonly metric: UsageMetric
  public readonly remaining: number

  constructor(metric: UsageMetric, remaining: number) {
    super(`Insufficient ${metric.replace('_', ' ')} credits (${remaining} remaining)`)
    this.metric = metric
    this.remaining = remaining
  }
}

export class CreditService {
  private readonly supabase = getServiceRoleClient()
  private readonly subscriptionPromise: Promise<UserPlanSubscription>
  private unmeteredAccessPromise?: Promise<boolean>

  constructor(
    private readonly userId: string,
    private readonly tokenId?: string
  ) {
    this.subscriptionPromise = CreditService.isEnforcementEnabled()
      ? ensureActiveSubscription(userId)
      : Promise.resolve(null as unknown as UserPlanSubscription)
  }

  private static isEnforcementEnabled(): boolean {
    return PLAN_ENFORCEMENT_ENABLED
  }

  async getSubscription(): Promise<UserPlanSubscription> {
    return this.subscriptionPromise
  }

  private async shouldBypassCredits(): Promise<boolean> {
    if (!CreditService.isEnforcementEnabled()) {
      return true
    }

    if (await this.hasUnmeteredAccess()) {
      return true
    }

    return false
  }

  private async hasUnmeteredAccess(): Promise<boolean> {
    if (this.unmeteredAccessPromise) {
      return this.unmeteredAccessPromise
    }

    const fetchPromise = (async () => {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('unmetered_access')
        .eq('user_id', this.userId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to load user settings for admin override: ${error.message}`)
      }

      return data?.unmetered_access === true
    })()

    this.unmeteredAccessPromise = fetchPromise
    return fetchPromise
  }

  private async ensureBalance(metric: UsageMetric) {
    if (await this.shouldBypassCredits()) {
      return null
    }

    const subscription = await this.getSubscription()
    const limits = getUsageLimits(subscription.planCycle)

    const { data, error } = await this.supabase.rpc('current_usage_balance', {
      p_user_id: this.userId,
      p_metric: metric,
    })

    if (error) {
      throw new Error(`Failed to read usage balance: ${error.message}`)
    }

    if (data) {
      return data
    }

    const allocation = limits[metric]
    const { error: resetError } = await this.supabase.rpc('reset_usage_cycle', {
      p_user_id: this.userId,
      p_metric: metric,
      p_cycle_start: subscription.currentPeriodStart,
      p_cycle_end: subscription.currentPeriodEnd,
      p_allocation: allocation,
      p_reference: {
        reason: 'initialization',
        billing_plan_cycle_id: subscription.billingPlanCycleId,
      },
    })

    if (resetError) {
      throw new Error(`Failed to initialize usage balance: ${resetError.message}`)
    }
  }

  private getErrorCode(error: PostgrestError | null): string | null {
    if (!error) return null
    if (error.code) return error.code
    if (error.message) return error.message
    return null
  }

  private async reserveInternal(
    metric: UsageMetric,
    amount: number,
    reference?: UsageReference
  ): Promise<ReservationResult> {
    const { data, error } = await this.supabase.rpc('reserve_usage', {
      p_user_id: this.userId,
      p_metric: metric,
      p_amount: amount,
      p_reference: reference ?? {},
      p_token_id: this.tokenId ?? null,
    })

    if (error) {
      const code = this.getErrorCode(error)
      if (code === 'USAGE_BALANCE_NOT_FOUND') {
        return { remaining: -1 }
      }
      throw new Error(`Failed to reserve ${metric}: ${error.message}`)
    }

    const result = Array.isArray(data) ? data[0] : data

    if (!result?.success) {
      throw new UsageLimitExceeded(metric, result?.remaining ?? 0)
    }

    return { remaining: result.remaining ?? 0 }
  }

  async reserve(
    metric: UsageMetric,
    amount: number,
    reference?: UsageReference
  ): Promise<ReservationResult> {
    if (await this.shouldBypassCredits()) {
      return { remaining: Number.POSITIVE_INFINITY }
    }

    await this.ensureBalance(metric)

    const result = await this.reserveInternal(metric, amount, reference)
    if (result.remaining === -1) {
      await this.ensureBalance(metric)
      const retryResult = await this.reserveInternal(metric, amount, reference)
      if (retryResult.remaining === -1) {
        throw new Error(`Unable to establish usage balance for ${metric}`)
      }
      return retryResult
    }

    return result
  }

  async commit(metric: UsageMetric, amount: number, reference?: UsageReference): Promise<number> {
    if (await this.shouldBypassCredits()) {
      return Number.POSITIVE_INFINITY
    }

    const { data, error } = await this.supabase.rpc('commit_usage', {
      p_user_id: this.userId,
      p_metric: metric,
      p_amount: amount,
      p_reference: reference ?? {},
      p_token_id: this.tokenId ?? null,
    })

    if (error) {
      throw new Error(`Failed to commit ${metric}: ${error.message}`)
    }

    return data ?? 0
  }

  async release(metric: UsageMetric, amount: number, reference?: UsageReference): Promise<number> {
    if (await this.shouldBypassCredits()) {
      return Number.POSITIVE_INFINITY
    }

    const { data, error } = await this.supabase.rpc('release_usage', {
      p_user_id: this.userId,
      p_metric: metric,
      p_amount: amount,
      p_reference: reference ?? {},
      p_token_id: this.tokenId ?? null,
    })

    if (error) {
      throw new Error(`Failed to release ${metric}: ${error.message}`)
    }

    return data ?? 0
  }
}


