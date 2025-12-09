-- Fix user_settings constraints to use nested workday structure
-- This ensures constraints match the normalized preferences structure
-- This is a safety migration to ensure constraints are correct even if previous migration had issues

-- Drop old constraints if they exist (using old structure)
ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_workday_hours_check,
  DROP CONSTRAINT IF EXISTS user_settings_lunch_hours_check;

-- Add constraints with correct nested structure
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_workday_hours_check
  CHECK (
    (preferences->'workday'->>'workday_start_hour')::integer IS NULL OR
    (preferences->'workday'->>'workday_end_hour')::integer IS NULL OR
    (
      (preferences->'workday'->>'workday_start_hour')::integer BETWEEN 0 AND 23 AND
      (preferences->'workday'->>'workday_end_hour')::integer BETWEEN 1 AND 24 AND
      (preferences->'workday'->>'workday_start_hour')::integer <
        (preferences->'workday'->>'workday_end_hour')::integer
    )
  );

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_lunch_hours_check
  CHECK (
    (preferences->'workday'->>'lunch_start_hour')::integer IS NULL OR
    (preferences->'workday'->>'lunch_end_hour')::integer IS NULL OR
    (
      (preferences->'workday'->>'lunch_start_hour')::integer BETWEEN 0 AND 23 AND
      (preferences->'workday'->>'lunch_end_hour')::integer BETWEEN 1 AND 24 AND
      (preferences->'workday'->>'lunch_start_hour')::integer <
        (preferences->'workday'->>'lunch_end_hour')::integer
    )
  );

-- Ensure get_workday_settings function uses correct structure
CREATE OR REPLACE FUNCTION public.get_workday_settings(
  p_user_id uuid
) RETURNS TABLE(
  workday_start_hour integer,
  workday_end_hour integer,
  lunch_start_hour integer,
  lunch_end_hour integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((preferences->'workday'->>'workday_start_hour')::integer, 9),
    COALESCE((preferences->'workday'->>'workday_end_hour')::integer, 17),
    COALESCE((preferences->'workday'->>'lunch_start_hour')::integer, 12),
    COALESCE((preferences->'workday'->>'lunch_end_hour')::integer, 13)
  FROM public.user_settings
  WHERE user_id = p_user_id;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_workday_settings(uuid) IS 
  'Returns workday settings (start/end hours, lunch hours) from user preferences.workday object. Uses nested structure after migration 20251116000005_normalize_user_preferences.';
