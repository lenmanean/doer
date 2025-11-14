-- Improve privacy preferences structure and add defaults
-- This migration:
-- 1. Moves improve_model_enabled to privacy object (if stored at root level)
-- 2. Adds privacy defaults to new users
-- 3. Backfills existing users with privacy defaults

-- Update the default preferences to include privacy object
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
  "privacy": {
    "improve_model_enabled": false,
    "analytics_enabled": false
  },
  "auto_reschedule": {
    "enabled": true, 
    "reschedule_window_days": 3, 
    "priority_spacing": "moderate", 
    "buffer_minutes": 15
  }
}'::jsonb;

-- Migrate existing improve_model_enabled from root to privacy object
-- This handles legacy preferences that stored improve_model_enabled at root level
UPDATE "public"."user_settings" 
SET "preferences" = jsonb_set(
    -- Remove improve_model_enabled from root if it exists
    "preferences" - 'improve_model_enabled',
    '{privacy}',
    COALESCE(
      jsonb_build_object(
        'improve_model_enabled', 
        COALESCE(
          "preferences"->'privacy'->>'improve_model_enabled',
          "preferences"->>'improve_model_enabled',
          'false'
        )::boolean,
        'analytics_enabled',
        COALESCE(
          ("preferences"->'privacy'->>'analytics_enabled')::boolean,
          false
        )
      ),
      "preferences"->'privacy'
    ),
    true
  )
WHERE 
  -- Only update if privacy object doesn't exist or improve_model_enabled is at root
  (
    "preferences"->'privacy' IS NULL 
    OR "preferences"->'privacy'->>'improve_model_enabled' IS NULL
  )
  AND "preferences"->>'improve_model_enabled' IS NOT NULL;

-- Add privacy defaults to users who don't have it
UPDATE "public"."user_settings" 
SET "preferences" = jsonb_set(
    COALESCE("preferences", '{}'::jsonb),
    '{privacy}',
    jsonb_build_object(
      'improve_model_enabled',
      COALESCE(
        ("preferences"->'privacy'->>'improve_model_enabled')::boolean,
        ("preferences"->>'improve_model_enabled')::boolean,
        false
      ),
      'analytics_enabled',
      COALESCE(
        ("preferences"->'privacy'->>'analytics_enabled')::boolean,
        false
      )
    ),
    true
  )
WHERE "preferences"->'privacy' IS NULL;

-- Update the comment to reflect privacy preferences structure
COMMENT ON COLUMN "public"."user_settings"."preferences" IS 'JSONB containing user preferences: workday hours, time format, smart scheduling preferences, week start day (0=Sunday, 1=Monday, etc.), theme (dark/light), accent_color (orange/blue/etc.), privacy settings (improve_model_enabled, analytics_enabled), and other user settings. Display name and avatar_url are stored in separate columns. Privacy preferences default to false (opt-in).';












