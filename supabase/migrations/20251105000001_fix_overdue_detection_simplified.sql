-- Simplify and fix overdue detection - remove complex subquery and use simpler logic

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
  v_task_count integer;
BEGIN
  -- Convert UTC timestamp to local timezone (America/Los_Angeles by default)
  v_local_timestamp := (p_check_time AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles';
  
  -- Extract date and time components from local timestamp
  v_check_date := v_local_timestamp::date;
  v_check_time_only := v_local_timestamp::time;
  
  -- Debug: Count all tasks for today for this user (before any filtering)
  SELECT COUNT(*) INTO v_task_count
  FROM "public"."task_schedule" ts
  INNER JOIN "public"."tasks" t ON t.id = ts.task_id
  WHERE 
    t.user_id = p_user_id
    AND ts.date::date = v_check_date;
  
  -- Log debug info
  RAISE NOTICE 'detect_overdue_tasks_by_time: p_check_time=%, v_local_timestamp=%, v_check_date=%, v_check_time_only=%, p_plan_id=%, all_tasks_today=%', 
    p_check_time, v_local_timestamp, v_check_date, v_check_time_only, p_plan_id, v_task_count;
  
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
  INNER JOIN "public"."task_schedule" ts ON ts.task_id = t.id
  LEFT JOIN "public"."task_completions" tc ON 
    tc.task_id = t.id 
    AND tc.scheduled_date = ts.date
    AND tc.user_id = p_user_id
    AND (
      -- Match plan_id: both NULL or both equal
      (t.plan_id IS NULL AND tc.plan_id IS NULL)
      OR
      (t.plan_id IS NOT NULL AND tc.plan_id = t.plan_id)
    )
  WHERE 
    t.user_id = p_user_id
    -- Plan ID filtering: handle NULL explicitly
    AND (
      (p_plan_id IS NULL AND t.plan_id IS NULL AND ts.plan_id IS NULL)
      OR
      (p_plan_id IS NOT NULL AND t.plan_id = p_plan_id AND ts.plan_id = p_plan_id)
    )
    -- Date and time filtering
    AND ts.date::date = v_check_date
    AND ts.end_time IS NOT NULL
    AND ts.end_time < v_check_time_only
    -- Not completed
    AND tc.id IS NULL
    -- Status filtering
    AND ts.status IN ('scheduled', 'overdue')
  ORDER BY ts.end_time ASC;
END;
$$;

COMMENT ON FUNCTION "public"."detect_overdue_tasks_by_time" IS 'Detects tasks scheduled for today that have passed their end_time without completion. Simplified logic with clearer NULL handling.';





















