-- Update basic plan API credits limit to 5/month for both monthly and annual cycles
-- This migration updates the api_credit_limit for all basic plan cycles

UPDATE billing_plan_cycles
SET api_credit_limit = 5
WHERE billing_plan_id = (
  SELECT id FROM billing_plans WHERE slug = 'basic'
)
AND api_credit_limit != 5;

-- Verify the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM billing_plan_cycles
  WHERE billing_plan_id = (SELECT id FROM billing_plans WHERE slug = 'basic')
    AND api_credit_limit = 5;
  
  RAISE NOTICE 'Updated % basic plan cycle(s) to 5 API credits/month', updated_count;
END $$;

