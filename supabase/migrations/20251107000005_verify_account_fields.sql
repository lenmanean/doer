-- Verify and ensure account fields exist in user_settings table
-- This migration ensures all profile fields are present, even if they were added in a previous migration

-- Add new columns if they don't exist (idempotent)
DO $$ 
BEGIN
    -- Add first_name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'first_name'
    ) THEN
        ALTER TABLE "public"."user_settings" ADD COLUMN "first_name" text;
    END IF;

    -- Add last_name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'last_name'
    ) THEN
        ALTER TABLE "public"."user_settings" ADD COLUMN "last_name" text;
    END IF;

    -- Add date_of_birth if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'date_of_birth'
    ) THEN
        ALTER TABLE "public"."user_settings" ADD COLUMN "date_of_birth" date;
    END IF;

    -- Add phone_number if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE "public"."user_settings" ADD COLUMN "phone_number" text;
    END IF;

    -- Add phone_verified if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'phone_verified'
    ) THEN
        ALTER TABLE "public"."user_settings" ADD COLUMN "phone_verified" boolean DEFAULT false NOT NULL;
    END IF;

    -- Add bio if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'bio'
    ) THEN
        ALTER TABLE "public"."user_settings" ADD COLUMN "bio" text;
    END IF;

    -- Add timezone if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'timezone'
    ) THEN
        ALTER TABLE "public"."user_settings" ADD COLUMN "timezone" text DEFAULT 'UTC';
    END IF;

    -- Add locale if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings' 
        AND column_name = 'locale'
    ) THEN
        ALTER TABLE "public"."user_settings" ADD COLUMN "locale" text DEFAULT 'en-US';
    END IF;
END $$;

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








