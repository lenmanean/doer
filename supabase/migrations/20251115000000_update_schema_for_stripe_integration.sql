-- Migration: Update schema for Stripe-based subscription integration
-- Since Stripe is now the source of truth, we update functions to not depend on user_plan_subscriptions

-- Update reset_usage_cycle to get billing_plan_cycle_id from reference parameter
-- instead of looking it up from user_plan_subscriptions table
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

  -- Get billing_plan_cycle_id from reference (passed from Stripe subscription)
  -- Fallback to looking up from user_plan_subscriptions for backward compatibility
  v_billing_plan_cycle_id := (p_reference->>'billing_plan_cycle_id')::uuid;
  
  IF v_billing_plan_cycle_id IS NULL THEN
    -- Fallback: try to get from user_plan_subscriptions (for backward compatibility)
    SELECT billing_plan_cycle_id
    INTO v_billing_plan_cycle_id
    FROM public.user_plan_subscriptions
    WHERE user_id = p_user_id
    ORDER BY current_period_end DESC
    LIMIT 1;
  END IF;

  -- If still null, we can't proceed - this should not happen with Stripe integration
  IF v_billing_plan_cycle_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'BILLING_PLAN_CYCLE_ID_MISSING', 
      DETAIL = 'billing_plan_cycle_id must be provided in reference or exist in user_plan_subscriptions.';
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
  'Reset (or initialize) a user''s usage balance for a new billing cycle. 
   Now gets billing_plan_cycle_id from reference parameter (Stripe-based) or falls back to user_plan_subscriptions for backward compatibility.';

-- Add comment to user_plan_subscriptions table indicating it's deprecated
COMMENT ON TABLE public.user_plan_subscriptions IS
  'DEPRECATED: This table is no longer the source of truth for subscriptions. 
   Stripe is now the source of truth. This table may be removed in a future migration.
   Subscription data is queried directly from Stripe via the API.';

-- Ensure stripe_customer_id column exists in user_settings (should already exist from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_settings' 
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.user_settings
    ADD COLUMN stripe_customer_id text;
    
    COMMENT ON COLUMN public.user_settings.stripe_customer_id IS
      'Stripe customer ID used to query subscriptions from Stripe API';
  END IF;
END $$;

-- Create index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_stripe_customer_id
  ON public.user_settings (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON INDEX idx_user_settings_stripe_customer_id IS
  'Index for looking up users by Stripe customer ID';

