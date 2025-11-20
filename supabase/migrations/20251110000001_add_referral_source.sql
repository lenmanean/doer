-- Add referral_source field to user_settings table
-- This migration adds a field to track how users heard about the platform

-- Add referral_source column
ALTER TABLE "public"."user_settings"
ADD COLUMN IF NOT EXISTS "referral_source" text;

-- Add comment
COMMENT ON COLUMN "public"."user_settings"."referral_source" IS 'How the user heard about the platform (e.g., search, social, friend, blog, youtube, podcast, ad, other)';










