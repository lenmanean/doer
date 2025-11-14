-- Add index on external_subscription_id for faster webhook lookups
-- This improves performance when looking up subscriptions by Stripe ID in webhook handlers

CREATE INDEX IF NOT EXISTS idx_user_plan_subscriptions_external_subscription_id
  ON public.user_plan_subscriptions (external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;

COMMENT ON INDEX idx_user_plan_subscriptions_external_subscription_id IS 
  'Index on external_subscription_id for fast Stripe subscription lookups in webhook handlers';


