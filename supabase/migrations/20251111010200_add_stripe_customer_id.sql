-- Add Stripe customer id to user settings for checkout integrations

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

COMMENT ON COLUMN public.user_settings.stripe_customer_id IS 'Stripe customer identifier associated with this user (nullable).';








