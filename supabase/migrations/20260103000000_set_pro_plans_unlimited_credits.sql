-- Set Pro plans (monthly and annual) to unlimited credits (-1)
-- Set Basic plan to 5 credits/month
-- This migration updates the api_credit_limit and integration_action_limit for all plan cycles
-- First, update constraints to allow -1 for unlimited credits

-- Drop existing constraints
ALTER TABLE public.billing_plan_cycles
  DROP CONSTRAINT IF EXISTS billing_plan_cycles_api_credit_limit_check;

ALTER TABLE public.billing_plan_cycles
  DROP CONSTRAINT IF EXISTS billing_plan_cycles_integration_action_limit_check;

-- Add new constraints that allow -1 for unlimited credits
ALTER TABLE public.billing_plan_cycles
  ADD CONSTRAINT billing_plan_cycles_api_credit_limit_check
  CHECK (api_credit_limit >= -1);

ALTER TABLE public.billing_plan_cycles
  ADD CONSTRAINT billing_plan_cycles_integration_action_limit_check
  CHECK (integration_action_limit >= -1);

-- Update Pro plans to unlimited credits
UPDATE billing_plan_cycles
SET api_credit_limit = -1,
    integration_action_limit = -1
WHERE billing_plan_id IN (
  SELECT id FROM billing_plans WHERE slug = 'pro'
);

-- Ensure Basic plan has 5 credits
UPDATE billing_plan_cycles
SET api_credit_limit = 5
WHERE billing_plan_id IN (
  SELECT id FROM billing_plans WHERE slug = 'basic'
)
AND api_credit_limit != 5;

-- Verify the updates
DO $$
DECLARE
  pro_updated_count INTEGER;
  basic_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pro_updated_count
  FROM billing_plan_cycles
  WHERE billing_plan_id IN (SELECT id FROM billing_plans WHERE slug = 'pro')
    AND api_credit_limit = -1
    AND integration_action_limit = -1;
  
  SELECT COUNT(*) INTO basic_updated_count
  FROM billing_plan_cycles
  WHERE billing_plan_id IN (SELECT id FROM billing_plans WHERE slug = 'basic')
    AND api_credit_limit = 5;
  
  RAISE NOTICE 'Updated % Pro plan cycle(s) to unlimited credits (-1)', pro_updated_count;
  RAISE NOTICE 'Updated % Basic plan cycle(s) to 5 API credits/month', basic_updated_count;
END $$;

