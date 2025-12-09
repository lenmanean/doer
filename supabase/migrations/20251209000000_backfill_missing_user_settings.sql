-- Backfill missing user_settings records for existing users
-- This migration ensures all auth.users have a corresponding user_settings record
-- This handles cases where:
-- 1. Users were created before the handle_new_user() trigger was added
-- 2. The trigger failed for some reason
-- 3. Users were created through admin tools or other means

-- Insert user_settings records for users who don't have one
INSERT INTO public.user_settings (
  user_id,
  username,
  timezone,
  locale,
  preferences,
  created_at,
  updated_at
)
SELECT 
  au.id,
  au.raw_user_meta_data->>'username',
  COALESCE(au.raw_user_meta_data->>'timezone', 'UTC'),
  COALESCE(au.raw_user_meta_data->>'locale', 'en-US'),
  '{
    "theme": "dark",
    "privacy": { "analytics_enabled": false, "improve_model_enabled": false },
    "time_format": "12h",
    "accent_color": "orange",
    "week_start_day": 0,
    "auto_reschedule": {
      "enabled": true,
      "buffer_minutes": 15,
      "priority_spacing": "moderate",
      "reschedule_window_days": 3
    },
    "workday": {
      "workday_start_hour": 9,
      "workday_end_hour": 17,
      "lunch_start_hour": 12,
      "lunch_end_hour": 13
    }
  }'::jsonb,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.user_settings us 
  WHERE us.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Log the number of records created
DO $$
DECLARE
  created_count INTEGER;
BEGIN
  GET DIAGNOSTICS created_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % missing user_settings records', created_count;
END $$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user_settings record with username from auth metadata when a new user signs up. If a user_settings record is missing, run migration 20251209000000_backfill_missing_user_settings.sql';
