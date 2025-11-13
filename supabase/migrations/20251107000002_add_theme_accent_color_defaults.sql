-- Add theme and accent_color to default preferences
-- These preferences are saved to the JSONB column but weren't in the defaults
-- This ensures new users get sensible defaults for UI preferences

-- Update the default preferences to include theme and accent_color
ALTER TABLE "public"."user_settings" 
ALTER COLUMN "preferences" 
SET DEFAULT '{
  "time_format": "12h", 
  "lunch_end_hour": 13, 
  "lunch_start_hour": 12, 
  "workday_end_hour": 17, 
  "workday_start_hour": 9, 
  "week_start_day": 0,
  "theme": "dark",
  "accent_color": "orange",
  "auto_reschedule": {
    "enabled": true, 
    "reschedule_window_days": 3, 
    "priority_spacing": "moderate", 
    "buffer_minutes": 15
  }
}'::jsonb;

-- Update existing user settings to include theme and accent_color if not present
-- Only update if they don't already have these preferences set
UPDATE "public"."user_settings" 
SET "preferences" = jsonb_set(
    jsonb_set(
      COALESCE("preferences", '{}'::jsonb),
      '{theme}',
      '"dark"'
    ),
    '{accent_color}',
    '"orange"'
  )
WHERE 
  "preferences"->>'theme' IS NULL 
  OR "preferences"->>'accent_color' IS NULL;

-- Update the comment to reflect all stored preferences
COMMENT ON COLUMN "public"."user_settings"."preferences" IS 'JSONB containing user preferences: workday hours, time format, smart scheduling preferences, week start day (0=Sunday, 1=Monday, etc.), theme (dark/light), accent_color (orange/blue/etc.), and other user settings. Display name and avatar_url are stored in separate columns.';










