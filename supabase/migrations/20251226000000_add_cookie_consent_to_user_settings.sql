-- Add cookie_consent column to user_settings table
-- This stores user consent preferences for cookie categories

ALTER TABLE "public"."user_settings"
ADD COLUMN IF NOT EXISTS "cookie_consent" jsonb;

COMMENT ON COLUMN "public"."user_settings"."cookie_consent" IS 'Stores user consent preferences for cookie categories (essential, analytics, marketing, functional) with timestamp';

