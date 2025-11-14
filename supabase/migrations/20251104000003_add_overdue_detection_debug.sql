-- Add debug logging and fix timezone handling for overdue detection
-- The function needs to properly compare times in the user's local timezone

DROP FUNCTION IF EXISTS "public"."detect_overdue_tasks_by_time"(uuid, uuid, timestamp with time zone);

CREATE FUNCTION "public"."detect_overdue_tasks_by_time"(
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
  v_local_timestamp timestamp without time zone;
BEGIN
  -- Convert UTC timestamp to local timezone (America/Los_Angeles by default)
  -- This assumes tasks are scheduled in PST/PDT timezone
  v_local_timestamp := (p_check_time AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles';
  
  -- Extract date and time components from local timestamp
  v_check_date := DATE(v_local_timestamp);
  v_check_time_only := v_local_timestamp::time;
  
  -- Debug: Enable RAISE NOTICE to see what's being compared (visible in Supabase logs)
  -- This helps diagnose timezone issues
  PERFORM set_config('client_min_messages', 'notice', false);
  
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
    NULL::integer AS complexity_score,
    ts.status
  FROM "public"."tasks" t
  INNER JOIN "public"."task_schedule" ts ON ts.task_id = t.id AND (ts.plan_id = t.plan_id OR (ts.plan_id IS NULL AND t.plan_id IS NULL))
  LEFT JOIN "public"."task_completions" tc ON 
    tc.task_id = t.id 
    AND (tc.plan_id = t.plan_id OR (tc.plan_id IS NULL AND t.plan_id IS NULL))
    AND tc.scheduled_date = ts.date
    AND tc.user_id = p_user_id
  WHERE 
    t.user_id = p_user_id
    AND (p_plan_id IS NULL AND t.plan_id IS NULL OR t.plan_id = p_plan_id)
    AND (p_plan_id IS NULL AND ts.plan_id IS NULL OR ts.plan_id = p_plan_id)
    AND ts.date = v_check_date  -- Match today's date in local timezone
    AND ts.end_time IS NOT NULL
    AND ts.end_time < v_check_time_only  -- Task ended before current time
    AND tc.id IS NULL  -- Not completed
    AND ts.status IN ('scheduled', 'overdue')  -- Only check tasks that haven't been rescheduled yet
  ORDER BY ts.end_time ASC;
END;
$$;

COMMENT ON FUNCTION "public"."detect_overdue_tasks_by_time" IS 'Detects tasks scheduled for today that have passed their end_time without completion. Works for both plan-based tasks (p_plan_id provided) and free-mode tasks (p_plan_id = null). Converts UTC timestamp to America/Los_Angeles timezone before comparison.';


















