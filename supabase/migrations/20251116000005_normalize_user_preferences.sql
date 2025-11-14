-- Migration: Normalize user_settings.preferences to use nested workday object

ALTER TABLE public.user_settings
  ALTER COLUMN preferences SET DEFAULT '{
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
  }'::jsonb;

UPDATE public.user_settings
SET preferences = jsonb_set(
  preferences
    - 'workday_start_hour'
    - 'workday_end_hour'
    - 'lunch_start_hour'
    - 'lunch_end_hour',
  '{workday}',
  COALESCE(preferences->'workday', '{}'::jsonb)
    || jsonb_strip_nulls(
      jsonb_build_object(
        'workday_start_hour', (preferences->>'workday_start_hour')::integer,
        'workday_end_hour', (preferences->>'workday_end_hour')::integer,
        'lunch_start_hour', (preferences->>'lunch_start_hour')::integer,
        'lunch_end_hour', (preferences->>'lunch_end_hour')::integer
      )
    ),
  true
)
WHERE preferences ?| ARRAY['workday_start_hour','workday_end_hour','lunch_start_hour','lunch_end_hour']
   OR preferences ? 'workday';

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_workday_hours_check,
  DROP CONSTRAINT IF EXISTS user_settings_lunch_hours_check;

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

