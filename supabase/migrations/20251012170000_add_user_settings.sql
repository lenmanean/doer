-- =====================================================
-- USER SETTINGS EXTENSION
-- =====================================================
-- Adds a flexible settings JSONB column to user_profiles
-- to store all user preferences and settings

-- Add settings column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- Add helpful comment
COMMENT ON COLUMN public.user_profiles.settings IS 'User preferences and settings stored as JSONB for flexibility';

-- Create index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_settings ON public.user_profiles USING gin(settings);

-- =====================================================
-- DEFAULT SETTINGS STRUCTURE (for reference)
-- =====================================================
-- {
--   "notifications": {
--     "email": true,
--     "task_reminders": true,
--     "milestone_alerts": true,
--     "weekly_digest": false
--   },
--   "privacy": {
--     "profile_visibility": "public",
--     "show_progress": true
--   },
--   "preferences": {
--     "theme": "dark",
--     "language": "en",
--     "time_format": "12h",
--     "start_of_week": "monday"
--   },
--   "advanced": {
--     "ai_suggestions": true,
--     "auto_schedule": false
--   }
-- }

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get user setting by path
CREATE OR REPLACE FUNCTION public.get_user_setting(
  p_user_id uuid,
  p_setting_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT settings #> string_to_array(p_setting_path, '.')
  INTO v_value
  FROM public.user_profiles
  WHERE user_id = p_user_id;
  
  RETURN v_value;
END;
$$;

-- Function to update user setting by path
CREATE OR REPLACE FUNCTION public.update_user_setting(
  p_user_id uuid,
  p_setting_path text,
  p_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
  SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    string_to_array(p_setting_path, '.'),
    p_value,
    true
  )
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- =====================================================
-- INITIALIZE DEFAULT SETTINGS FOR EXISTING USERS
-- =====================================================

-- Set default settings for users who don't have any
UPDATE public.user_profiles
SET settings = '{
  "notifications": {
    "email": true,
    "task_reminders": true,
    "milestone_alerts": true,
    "weekly_digest": false
  },
  "privacy": {
    "profile_visibility": "public",
    "show_progress": true
  },
  "preferences": {
    "theme": "dark",
    "language": "en",
    "time_format": "12h",
    "start_of_week": "monday"
  },
  "advanced": {
    "ai_suggestions": true,
    "auto_schedule": false
  }
}'::jsonb
WHERE settings IS NULL OR settings = '{}'::jsonb;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.get_user_setting TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_setting TO authenticated;







