-- Fix detect_overdue_tasks_by_time to not select complexity_score (column doesn't exist)

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
    NULL::integer AS complexity_score,  -- complexity_score column removed, return NULL
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
    AND ts.date = v_check_date
    AND ts.end_time IS NOT NULL
    AND ts.end_time < v_check_time_only
    AND tc.id IS NULL  -- Not completed
    AND ts.status IN ('scheduled', 'overdue')  -- Only check tasks that haven't been rescheduled yet
  ORDER BY ts.end_time ASC;
END;
$$;

COMMENT ON FUNCTION "public"."detect_overdue_tasks_by_time" IS 'Detects tasks scheduled for today that have passed their end_time without completion. Works for both plan-based tasks (p_plan_id provided) and free-mode tasks (p_plan_id = null).';




















