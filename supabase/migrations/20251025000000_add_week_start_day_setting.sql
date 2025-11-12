-- Add week_start_day setting to user_settings preferences
-- This migration adds the week_start_day preference to the default preferences JSONB

-- Update the default preferences to include week_start_day
ALTER TABLE "public"."user_settings" 
ALTER COLUMN "preferences" 
SET DEFAULT '{"time_format": "12h", "lunch_end_hour": 13, "lunch_start_hour": 12, "workday_end_hour": 17, "workday_start_hour": 9, "week_start_day": 0}'::jsonb;

-- Update existing user settings to include week_start_day if not present
UPDATE "public"."user_settings" 
SET "preferences" = jsonb_set(
    COALESCE("preferences", '{}'::jsonb),
    '{week_start_day}',
    '0'::jsonb
)
WHERE "preferences"->>'week_start_day' IS NULL;

-- Add comment for the new setting
COMMENT ON COLUMN "public"."user_settings"."preferences" IS 'JSONB containing workday hours, time format, smart scheduling preferences, week start day (0=Sunday, 1=Monday, etc.), and other user settings';
