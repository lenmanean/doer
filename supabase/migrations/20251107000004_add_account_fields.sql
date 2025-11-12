-- Add account fields to user_settings table
-- This migration adds first_name, last_name, date_of_birth, phone_number, phone_verified, bio, timezone, and locale

-- Add new columns
ALTER TABLE "public"."user_settings"
ADD COLUMN IF NOT EXISTS "first_name" text,
ADD COLUMN IF NOT EXISTS "last_name" text,
ADD COLUMN IF NOT EXISTS "date_of_birth" date,
ADD COLUMN IF NOT EXISTS "phone_number" text,
ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS "bio" text,
ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS "locale" text DEFAULT 'en-US';

-- Add comments
COMMENT ON COLUMN "public"."user_settings"."first_name" IS 'User first name';
COMMENT ON COLUMN "public"."user_settings"."last_name" IS 'User last name';
COMMENT ON COLUMN "public"."user_settings"."date_of_birth" IS 'User date of birth';
COMMENT ON COLUMN "public"."user_settings"."phone_number" IS 'User phone number (E.164 format recommended)';
COMMENT ON COLUMN "public"."user_settings"."phone_verified" IS 'Whether the phone number has been verified. Phone verification will be implemented in a future update.';
COMMENT ON COLUMN "public"."user_settings"."bio" IS 'User bio or about section';
COMMENT ON COLUMN "public"."user_settings"."timezone" IS 'User timezone (e.g., America/Los_Angeles, UTC). Used for scheduling and time display.';
COMMENT ON COLUMN "public"."user_settings"."locale" IS 'User locale preference (e.g., en-US, en-GB). Used for date/time formatting and language.';

-- Add index for phone number lookups (if needed in future)
CREATE INDEX IF NOT EXISTS "idx_user_settings_phone_number" 
  ON "public"."user_settings"("phone_number")
  WHERE "phone_number" IS NOT NULL;

