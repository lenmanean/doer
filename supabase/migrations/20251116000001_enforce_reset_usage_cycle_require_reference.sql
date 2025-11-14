-- Migration: Enforce billing_plan_cycle_id reference for reset_usage_cycle
CREATE OR REPLACE FUNCTION public.reset_usage_cycle(
  p_user_id uuid,
  p_metric public.usage_metric,
  p_cycle_start date,
  p_cycle_end date,
  p_allocation integer,
  p_reference jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  balance_id uuid;
  v_billing_plan_cycle_id uuid;
BEGIN
  IF p_allocation < 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'ALLOCATION_INVALID', DETAIL = 'Allocation must be zero or positive.';
  END IF;

  v_billing_plan_cycle_id := (p_reference->>'billing_plan_cycle_id')::uuid;

  IF v_billing_plan_cycle_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BILLING_PLAN_CYCLE_ID_MISSING',
      DETAIL = 'billing_plan_cycle_id must be provided in reference parameter. Stripe is the source of truth for subscriptions.';
  END IF;

  INSERT INTO public.plan_usage_balances(
    user_id,
    billing_plan_cycle_id,
    metric,
    cycle_start,
    cycle_end,
    allocation,
    used,
    reserved
  )
  VALUES (
    p_user_id,
    v_billing_plan_cycle_id,
    p_metric,
    p_cycle_start,
    p_cycle_end,
    p_allocation,
    0,
    0
  )
  ON CONFLICT (user_id, metric, cycle_start) DO UPDATE
    SET allocation = EXCLUDED.allocation,
        cycle_end = EXCLUDED.cycle_end,
        used = 0,
        reserved = 0,
        updated_at = now()
  RETURNING id INTO balance_id;

  INSERT INTO public.usage_ledger(
    user_id,
    billing_plan_cycle_id,
    metric,
    action,
    amount,
    balance_after,
    reference,
    recorded_by
  )
  VALUES (
    p_user_id,
    v_billing_plan_cycle_id,
    p_metric,
    'reset',
    p_allocation,
    p_allocation,
    COALESCE(p_reference, '{}'::jsonb),
    auth.uid()
  );

  RETURN balance_id;
END;
$$;

COMMENT ON FUNCTION public.reset_usage_cycle IS
  'Reset (or initialize) a user''s usage balance for a new billing cycle. Requires billing_plan_cycle_id in the reference payload supplied from Stripe metadata.';

