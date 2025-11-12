-- Add task-level auto-rescheduling support
-- This migration adds status tracking, reschedule metadata, and database functions
-- for detecting and rescheduling overdue tasks

-- ============================================================================
-- 1. Add status tracking and rescheduling metadata to task_schedule table
-- ============================================================================

ALTER TABLE "public"."task_schedule"
ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'scheduled' 
  CHECK ("status" IN ('scheduled', 'overdue', 'rescheduling', 'rescheduled')),
ADD COLUMN IF NOT EXISTS "reschedule_count" integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS "last_rescheduled_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "reschedule_reason" jsonb;

-- Add comment explaining status field
COMMENT ON COLUMN "public"."task_schedule"."status" IS 'Task scheduling status: scheduled (normal), overdue (passed end_time), rescheduling (in process), rescheduled (completed rescheduling)';
COMMENT ON COLUMN "public"."task_schedule"."reschedule_count" IS 'Number of times this task has been auto-rescheduled';
COMMENT ON COLUMN "public"."task_schedule"."last_rescheduled_at" IS 'Timestamp of last auto-rescheduling action';
COMMENT ON COLUMN "public"."task_schedule"."reschedule_reason" IS 'JSONB metadata about rescheduling: reason, old_time, new_time, context_score, etc.';

-- ============================================================================
-- 2. Update user_settings defaults for auto-reschedule preferences
-- ============================================================================

-- Function to initialize default auto-reschedule preferences
CREATE OR REPLACE FUNCTION "public"."init_auto_reschedule_preferences"()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update existing user_settings to include auto-reschedule defaults
  UPDATE "public"."user_settings"
  SET preferences = jsonb_set(
    COALESCE(preferences, '{}'::jsonb),
    '{auto_reschedule}',
    jsonb_build_object(
      'enabled', true,
      'reschedule_window_days', 3,
      'priority_spacing', 'moderate',
      'buffer_minutes', 15
    )
  )
  WHERE NOT (preferences ? 'auto_reschedule');
END;
$$;

-- Run the initialization
SELECT "public"."init_auto_reschedule_preferences"();

-- Drop the initialization function as it's no longer needed
DROP FUNCTION IF EXISTS "public"."init_auto_reschedule_preferences";

-- Update default JSONB for new user_settings records
ALTER TABLE "public"."user_settings"
ALTER COLUMN "preferences" SET DEFAULT '{"time_format": "12h", "lunch_end_hour": 13, "lunch_start_hour": 12, "workday_end_hour": 17, "workday_start_hour": 9, "auto_reschedule": {"enabled": true, "reschedule_window_days": 3, "priority_spacing": "moderate", "buffer_minutes": 15}}'::jsonb;

-- ============================================================================
-- 3. Create function to detect overdue tasks by time
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."detect_overdue_tasks_by_time"(
  p_user_id uuid,
  p_plan_id uuid,
  p_check_time timestamp with time zone DEFAULT now()
)
RETURNS TABLE(
  task_id uuid,
  schedule_id uuid,
  task_name text,
  scheduled_date date,
  start_time time without time zone,
  end_time time without time zone,
  duration_minutes integer,
  priority integer,
  complexity_score integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_check_date date;
  v_check_time_only time without time zone;
BEGIN
  -- Extract date and time components from p_check_time
  v_check_date := DATE(p_check_time);
  v_check_time_only := (p_check_time AT TIME ZONE 'UTC')::time;
  
  RETURN QUERY
  SELECT 
    t.id AS task_id,
    ts.id AS schedule_id,
    t.name AS task_name,
    ts.date AS scheduled_date,
    ts.start_time,
    ts.end_time,
    ts.duration_minutes,
    t.priority,
    t.complexity_score,
    ts.status
  FROM "public"."tasks" t
  INNER JOIN "public"."task_schedule" ts ON ts.task_id = t.id AND ts.plan_id = t.plan_id
  LEFT JOIN "public"."task_completions" tc ON 
    tc.task_id = t.id 
    AND tc.plan_id = t.plan_id 
    AND tc.scheduled_date = ts.date
    AND tc.user_id = p_user_id
  WHERE 
    t.plan_id = p_plan_id
    AND t.user_id = p_user_id
    AND ts.date = v_check_date
    AND ts.end_time IS NOT NULL
    AND ts.end_time < v_check_time_only
    AND tc.id IS NULL  -- Not completed
    AND ts.status IN ('scheduled', 'overdue')  -- Only check tasks that haven't been rescheduled yet
  ORDER BY ts.end_time ASC;
END;
$$;

COMMENT ON FUNCTION "public"."detect_overdue_tasks_by_time" IS 'Detects tasks scheduled for today that have passed their end_time without completion. Returns task details for rescheduling.';

-- ============================================================================
-- 4. Create function to check auto-reschedule settings
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."is_auto_reschedule_enabled"("p_user_id" uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT COALESCE(
    (preferences->'auto_reschedule'->>'enabled')::boolean,
    true  -- Default to enabled if not set
  ) INTO v_enabled
  FROM "public"."user_settings"
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_enabled, true);
END;
$$;

COMMENT ON FUNCTION "public"."is_auto_reschedule_enabled" IS 'Checks if auto-rescheduling is enabled for a user. Defaults to true if not explicitly disabled.';

-- ============================================================================
-- 5. Grant necessary permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION "public"."detect_overdue_tasks_by_time"(uuid, uuid, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."detect_overdue_tasks_by_time"(uuid, uuid, timestamp with time zone) TO service_role;

GRANT EXECUTE ON FUNCTION "public"."is_auto_reschedule_enabled"(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."is_auto_reschedule_enabled"(uuid) TO service_role;

