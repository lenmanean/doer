import { describe, expect, it, beforeEach, jest } from '@jest/globals'

import type { BillingPlanCycle, UserPlanSubscription } from '../src/lib/billing/plans'
import * as billing from '../src/lib/billing/plans'

jest.mock('@/lib/supabase/service-role', () => ({
  getServiceRoleClient: jest.fn(),
}))

const { getServiceRoleClient } = jest.requireMock('@/lib/supabase/service-role') as {
  getServiceRoleClient: jest.Mock
}

describe('assignSubscription', () => {
  const planCycle: BillingPlanCycle = {
    id: 'cycle-123',
    cycle: 'monthly',
    apiCreditLimit: 100,
    integrationActionLimit: 2000,
    priceCents: 2000,
    metadata: {},
    plan: {
      id: 'plan-123',
      slug: 'pro',
      name: 'Pro',
      description: 'Pro plan',
      metadata: {},
    },
  }

  const subscriptionRow = {
    id: 'sub-1',
    user_id: 'user-1',
    status: 'active',
    billing_plan_cycle_id: planCycle.id,
    current_period_start: '2025-01-01',
    current_period_end: '2025-01-31',
    billing_plan_cycles: {
      id: planCycle.id,
      cycle: planCycle.cycle,
      api_credit_limit: planCycle.apiCreditLimit,
      integration_action_limit: planCycle.integrationActionLimit,
      price_cents: planCycle.priceCents,
      metadata: planCycle.metadata,
      billing_plan: {
        id: planCycle.plan.id,
        slug: planCycle.plan.slug,
        name: planCycle.plan.name,
        description: planCycle.plan.description,
        metadata: planCycle.plan.metadata,
      },
    },
  }

  const buildSupabaseStub = (options?: {
    insertError?: { code: string; message: string }
  }) => {
    const cancelIn = jest.fn().mockResolvedValue({ data: null, error: null })
    const cancelEq = jest.fn().mockReturnValue({ in: cancelIn })
    const update = jest.fn().mockReturnValue({ eq: cancelEq })

    const chainMaybeSingle = jest.fn().mockResolvedValue({ data: subscriptionRow, error: null })
    const chainLimit = jest.fn().mockReturnValue({ maybeSingle: chainMaybeSingle })
    const chainOrder = jest.fn().mockReturnValue({ limit: chainLimit })
    const chainIn = jest.fn(() => ({ order: chainOrder, maybeSingle: chainMaybeSingle }))
    const chainEq = jest.fn().mockReturnValue({ in: chainIn })
    const select = jest.fn().mockReturnValue({ eq: chainEq })

    const insertMaybeSingle = options?.insertError
      ? jest.fn().mockResolvedValue({ data: null, error: options.insertError })
      : jest.fn().mockResolvedValue({ data: subscriptionRow, error: null })
    const insertSelect = jest.fn().mockReturnValue({ maybeSingle: insertMaybeSingle })
    const insert = jest.fn().mockReturnValue({ select: insertSelect })

    const from = jest.fn((table: string) => {
      if (table === 'user_plan_subscriptions') {
        return {
          update,
          insert,
          select,
        }
      }
      throw new Error(`Unexpected table access: ${table}`)
    })

    const rpc = jest.fn().mockResolvedValue({ data: null, error: null })

    return {
      from,
      rpc,
      mocks: {
        update,
        insert,
        insertSelect,
        insertMaybeSingle,
        select,
        chainMaybeSingle,
        rpc,
      },
    }
  }

  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(billing, 'getPlanCycleBySlugAndCycle').mockResolvedValue(planCycle)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('assigns a subscription and seeds usage balances', async () => {
    const supabaseStub = buildSupabaseStub()
    getServiceRoleClient.mockReturnValue(supabaseStub as any)

    const result = await billing.assignSubscription('user-1', 'pro', 'monthly')

    expect(result.planCycle.id).toBe(planCycle.id)
    expect(supabaseStub.mocks.update).toHaveBeenCalled()
    expect(supabaseStub.mocks.insert).toHaveBeenCalled()
    expect(supabaseStub.rpc).toHaveBeenCalledTimes(2)
    expect(supabaseStub.rpc).toHaveBeenCalledWith('reset_usage_cycle', expect.objectContaining({
      p_user_id: 'user-1',
      p_metric: 'api_credits',
      p_allocation: planCycle.apiCreditLimit,
    }))
  })

  it('handles duplicate inserts by returning existing subscription', async () => {
    const supabaseStub = buildSupabaseStub({ insertError: { code: '23505', message: 'duplicate key value violates unique constraint' } })
    getServiceRoleClient.mockReturnValue(supabaseStub as any)

    const result = await billing.assignSubscription('user-1', 'pro', 'monthly')

    expect(result.planCycle.id).toBe(planCycle.id)
    expect(supabaseStub.rpc).toHaveBeenCalledTimes(2)
  })
})
