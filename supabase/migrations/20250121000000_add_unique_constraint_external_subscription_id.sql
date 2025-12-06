-- Add unique constraint on external_subscription_id to prevent duplicate subscriptions
-- This ensures that each Stripe subscription can only be synced once to the database

-- First, clean up any existing duplicates (keep the most recent one)
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  FOR duplicate_record IN
    SELECT external_subscription_id, array_agg(id ORDER BY created_at DESC) as ids
    FROM public.user_plan_subscriptions
    WHERE external_subscription_id IS NOT NULL
    GROUP BY external_subscription_id
    HAVING COUNT(*) > 1
  LOOP
    -- Delete all but the most recent record
    DELETE FROM public.user_plan_subscriptions
    WHERE external_subscription_id = duplicate_record.external_subscription_id
      AND id != duplicate_record.ids[1];
    
    RAISE NOTICE 'Cleaned up duplicate subscription: %', duplicate_record.external_subscription_id;
  END LOOP;
END $$;

-- Add unique constraint (only on non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS user_plan_subscriptions_external_subscription_id_unique
  ON public.user_plan_subscriptions (external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;

COMMENT ON INDEX user_plan_subscriptions_external_subscription_id_unique IS
  'Ensures each Stripe subscription can only be synced once to prevent duplicates';
