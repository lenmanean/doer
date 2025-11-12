


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."archive_plan"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_plan_exists boolean;
  v_plan_status text;
BEGIN
  -- Verify the plan exists and belongs to the user
  SELECT EXISTS(
    SELECT 1 FROM public.plans
    WHERE id = p_plan_id AND user_id = p_user_id
  ) INTO v_plan_exists;
  
  IF NOT v_plan_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Plan not found or does not belong to user'
    );
  END IF;
  
  -- Get current plan status
  SELECT status INTO v_plan_status
  FROM public.plans
  WHERE id = p_plan_id AND user_id = p_user_id;
  
  -- Archive the plan
  UPDATE public.plans
  SET 
    status = 'archived',
    archived_at = now()
  WHERE id = p_plan_id AND user_id = p_user_id;
  
  -- Return success with info about whether it was active
  RETURN json_build_object(
    'success', true,
    'plan_id', p_plan_id,
    'was_active', v_plan_status = 'active',
    'archived_at', now()
  );
END;
$$;


ALTER FUNCTION "public"."archive_plan"("p_user_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_plan"("p_user_id" "uuid", "p_plan_id" "uuid") IS 'Archives a plan by setting status to archived and recording archived_at timestamp. Does not auto-activate another plan if archiving active plan.';



CREATE OR REPLACE FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  original_penalty numeric;
  reduction_factor numeric := 0.5; -- 50% reduction
  reduced_penalty numeric;
BEGIN
  -- Get the original penalty for this task
  SELECT 
    CASE 
      WHEN ts.rescheduled_from IS NOT NULL AND tc.is_rescheduled = true THEN
        -- Calculate original penalty based on days between original date and completion
        (tc.scheduled_date - ts.rescheduled_from) * -3
      ELSE 0
    END
  INTO original_penalty
  FROM public.task_schedule ts
  LEFT JOIN public.task_completions tc ON tc.task_id = ts.task_id 
    AND tc.plan_id = ts.plan_id
    AND tc.scheduled_date = ts.date
  WHERE ts.task_id = p_task_id 
    AND ts.plan_id = p_plan_id;
  
  -- Calculate reduced penalty
  reduced_penalty := original_penalty * reduction_factor;
  
  RETURN COALESCE(reduced_penalty, 0);
END;
$$;


ALTER FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") IS 'Calculate the penalty reduction for a rescheduled task completion.
Returns 50% of the original penalty as a positive number (reduction).';



CREATE OR REPLACE FUNCTION "public"."capture_health_snapshot"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_health_data json;
  v_snapshot_id uuid;
BEGIN
  -- Get current health metrics using existing function
  v_health_data := public.get_plan_health_now(p_user_id, p_plan_id);
  
  -- Insert snapshot (or update if already exists for today)
  INSERT INTO public.health_snapshots (
    user_id,
    plan_id,
    snapshot_date,
    health_score,
    has_scheduled_tasks,
    progress,
    consistency,
    efficiency,
    total_tasks,
    total_completions,
    days_elapsed,
    current_streak_days,
    late_completion_penalty,
    overdue_penalty,
    consistency_gap_penalty,
    progress_lag_penalty,
    ontime_completion_bonus,
    early_completion_bonus,
    streak_bonus
  )
  VALUES (
    p_user_id,
    p_plan_id,
    CURRENT_DATE,
    (v_health_data->>'health_score')::numeric,
    (v_health_data->>'has_scheduled_tasks')::boolean,
    (v_health_data->>'progress')::numeric,
    (v_health_data->>'consistency')::numeric,
    CASE 
      WHEN v_health_data->>'efficiency' IS NULL THEN NULL 
      ELSE (v_health_data->>'efficiency')::numeric 
    END,
    (v_health_data->>'total_tasks')::integer,
    (v_health_data->>'total_completions')::integer,
    (v_health_data->>'days_elapsed')::integer,
    (v_health_data->>'current_streak_days')::integer,
    (v_health_data->'penalties'->>'late_completions')::numeric,
    (v_health_data->'penalties'->>'overdue_tasks')::numeric,
    (v_health_data->'penalties'->>'consistency_gaps')::numeric,
    (v_health_data->'penalties'->>'progress_lag')::numeric,
    (v_health_data->'bonuses'->>'ontime_completions')::numeric,
    (v_health_data->'bonuses'->>'early_completions')::numeric,
    (v_health_data->'bonuses'->>'streak_bonus')::numeric
  )
  ON CONFLICT (plan_id, snapshot_date)
  DO UPDATE SET
    health_score = EXCLUDED.health_score,
    has_scheduled_tasks = EXCLUDED.has_scheduled_tasks,
    progress = EXCLUDED.progress,
    consistency = EXCLUDED.consistency,
    efficiency = EXCLUDED.efficiency,
    total_tasks = EXCLUDED.total_tasks,
    total_completions = EXCLUDED.total_completions,
    days_elapsed = EXCLUDED.days_elapsed,
    current_streak_days = EXCLUDED.current_streak_days,
    late_completion_penalty = EXCLUDED.late_completion_penalty,
    overdue_penalty = EXCLUDED.overdue_penalty,
    consistency_gap_penalty = EXCLUDED.consistency_gap_penalty,
    progress_lag_penalty = EXCLUDED.progress_lag_penalty,
    ontime_completion_bonus = EXCLUDED.ontime_completion_bonus,
    early_completion_bonus = EXCLUDED.early_completion_bonus,
    streak_bonus = EXCLUDED.streak_bonus,
    created_at = now()
  RETURNING id INTO v_snapshot_id;
  
  -- Return success result
  RETURN json_build_object(
    'success', true,
    'snapshot_id', v_snapshot_id,
    'plan_id', p_plan_id,
    'snapshot_date', CURRENT_DATE,
    'health_score', (v_health_data->>'health_score')::numeric
  );
END;
$$;


ALTER FUNCTION "public"."capture_health_snapshot"("p_user_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."capture_health_snapshot"("p_user_id" "uuid", "p_plan_id" "uuid") IS 'Captures a daily health snapshot for a plan. Uses get_plan_health_now() to fetch current metrics and stores them in health_snapshots table. Idempotent - updates existing snapshot if already captured today.';



CREATE OR REPLACE FUNCTION "public"."delete_plan_data"("target_user_id" "uuid", "target_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete in correct order
  DELETE FROM task_completions WHERE plan_id = target_plan_id AND user_id = target_user_id;
  DELETE FROM task_schedule WHERE plan_id = target_plan_id;
  DELETE FROM tasks WHERE plan_id = target_plan_id;
  DELETE FROM milestones WHERE plan_id = target_plan_id;
  DELETE FROM plans WHERE id = target_plan_id AND user_id = target_user_id;
  
  -- Notify realtime
  PERFORM pg_notify('plan_state_updated', jsonb_build_object(
    'action', 'plan_deleted',
    'plan_id', target_plan_id,
    'user_id', target_user_id,
    'timestamp', NOW()
  )::TEXT);
  
  RAISE NOTICE 'Plan % deleted successfully', target_plan_id;
END;
$$;


ALTER FUNCTION "public"."delete_plan_data"("target_user_id" "uuid", "target_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_plan_data"("target_user_id" "uuid", "target_plan_id" "uuid") IS 'Safely deletes a plan and all related data (tasks, milestones, completions, schedule) in correct order.';



CREATE OR REPLACE FUNCTION "public"."detect_missed_tasks"("p_plan_id" "uuid", "p_check_date" "date" DEFAULT (CURRENT_DATE - '1 day'::interval)) RETURNS TABLE("task_id" "uuid", "task_name" "text", "scheduled_date" "date", "days_overdue" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS task_id,
    t.name AS task_name,
    ts.date AS scheduled_date,
    (p_check_date - ts.date)::integer AS days_overdue
  FROM public.tasks t
  JOIN public.task_schedule ts ON ts.task_id = t.id AND ts.plan_id = t.plan_id
  LEFT JOIN public.task_completions tc ON tc.task_id = t.id 
    AND tc.plan_id = t.plan_id 
    AND tc.scheduled_date = ts.date
  WHERE t.plan_id = p_plan_id
    AND ts.date < p_check_date
    AND tc.id IS NULL  -- Not completed
  ORDER BY ts.date ASC;
END;
$$;


ALTER FUNCTION "public"."detect_missed_tasks"("p_plan_id" "uuid", "p_check_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detect_missed_tasks"("p_plan_id" "uuid", "p_check_date" "date") IS 'Returns all incomplete tasks scheduled before the check date (defaults to yesterday). Used by smart scheduling to identify tasks that need rescheduling.';



CREATE OR REPLACE FUNCTION "public"."get_plan_health_now"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result json;
BEGIN
  -- Get health metrics from the view
  SELECT json_build_object(
    'health_score', COALESCE(vph.health_score, 100),
    'has_scheduled_tasks', COALESCE(vph.has_scheduled_tasks, false),
    'progress', COALESCE(vph.progress, 0),
    'consistency', COALESCE(vph.consistency, 0),
    'efficiency', vph.efficiency,  -- Can be NULL
    'total_tasks', COALESCE(vph.total_tasks, 0),
    'total_completions', COALESCE(vph.total_completions, 0),
    'tasks_scheduled_so_far', COALESCE(vph.tasks_scheduled_so_far, 0),
    'days_elapsed', COALESCE(vph.days_elapsed, 0),
    'current_streak_days', COALESCE(vph.current_streak_days, 0),
    -- Penalty breakdown (for debugging/insights)
    'penalties', json_build_object(
      'late_completions', COALESCE(vph.late_completion_penalty, 0),
      'overdue_tasks', COALESCE(vph.overdue_penalty, 0),
      'consistency_gaps', COALESCE(vph.consistency_gap_penalty, 0),
      'progress_lag', COALESCE(vph.progress_lag_penalty, 0)
    ),
    -- Bonus breakdown (for debugging/insights)
    'bonuses', json_build_object(
      'ontime_completions', COALESCE(vph.ontime_completion_bonus, 0),
      'early_completions', COALESCE(vph.early_completion_bonus, 0),
      'streak_bonus', COALESCE(vph.current_streak_days, 0)
    )
  )
  INTO result
  FROM public.v_plan_health vph
  WHERE vph.user_id = p_user_id
    AND vph.plan_id = p_plan_id;
  
  -- If no result, return default values (new plan, no tasks yet)
  IF result IS NULL THEN
    result := json_build_object(
      'health_score', 100,
      'has_scheduled_tasks', false,
      'progress', 0,
      'consistency', 0,
      'efficiency', NULL,
      'total_tasks', 0,
      'total_completions', 0,
      'tasks_scheduled_so_far', 0,
      'days_elapsed', 0,
      'current_streak_days', 0,
      'penalties', json_build_object(
        'late_completions', 0,
        'overdue_tasks', 0,
        'consistency_gaps', 0,
        'progress_lag', 0
      ),
      'bonuses', json_build_object(
        'ontime_completions', 0,
        'early_completions', 0,
        'streak_bonus', 0
      )
    );
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_plan_health_now"("p_user_id" "uuid", "p_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_plan_health_now"("p_user_id" "uuid", "p_plan_id" "uuid") IS 'Returns degrading health model metrics. Plans start at 100% health, degrade with poor habits, recover with good habits. Updated 2025-10-11.';



CREATE OR REPLACE FUNCTION "public"."get_rescheduling_stats"("p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  result json;
  total_adjustments integer;
  total_days_extended integer;
  total_tasks_rescheduled integer;
  last_adjustment_date date;
BEGIN
  -- Get rescheduling statistics
  SELECT 
    COUNT(*),
    COALESCE(SUM(days_extended), 0),
    COALESCE(SUM(tasks_rescheduled), 0),
    MAX(adjustment_date)
  INTO 
    total_adjustments,
    total_days_extended,
    total_tasks_rescheduled,
    last_adjustment_date
  FROM public.scheduling_history
  WHERE plan_id = p_plan_id;
  
  -- Build result JSON
  result := json_build_object(
    'total_adjustments', total_adjustments,
    'total_days_extended', total_days_extended,
    'total_tasks_rescheduled', total_tasks_rescheduled,
    'last_adjustment_date', last_adjustment_date,
    'has_been_adjusted', total_adjustments > 0
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_rescheduling_stats"("p_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_rescheduling_stats"("p_plan_id" "uuid") IS 'Get rescheduling statistics for a plan including total adjustments, days extended, and tasks rescheduled.';



CREATE OR REPLACE FUNCTION "public"."get_smart_scheduling_settings"("p_user_id" "uuid") RETURNS TABLE("enabled" boolean, "auto_reschedule" boolean, "penalty_reduction" boolean, "notification_threshold" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE((preferences->'smart_scheduling'->>'enabled')::boolean, true) as enabled,
        COALESCE((preferences->'smart_scheduling'->>'auto_reschedule')::boolean, true) as auto_reschedule,
        COALESCE((preferences->'smart_scheduling'->>'penalty_reduction')::boolean, true) as penalty_reduction,
        COALESCE((preferences->'smart_scheduling'->>'notification_threshold')::integer, 24) as notification_threshold
    FROM public.user_settings
    WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_smart_scheduling_settings"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_plans"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_plans json;
BEGIN
  -- Get all plans for the user with summary data
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'user_id', p.user_id,
      'goal_text', p.goal_text,
      'status', p.status,
      'start_date', p.start_date,
      'end_date', p.end_date,
      'summary_data', p.summary_data,
      'created_at', p.created_at,
      'archived_at', p.archived_at,
      'task_count', (
        SELECT COUNT(*) 
        FROM public.tasks t 
        WHERE t.plan_id = p.id
      )
    )
    ORDER BY 
      CASE p.status 
        WHEN 'active' THEN 1 
        WHEN 'paused' THEN 2 
        WHEN 'completed' THEN 3 
        WHEN 'archived' THEN 4 
        ELSE 5 
      END,
      p.created_at DESC
  )
  INTO v_plans
  FROM public.plans p
  WHERE p.user_id = p_user_id;

  -- Return plans or empty array if none exist
  RETURN COALESCE(v_plans, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."get_user_plans"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_plans"("p_user_id" "uuid") IS 'Returns all plans for a user with summary data, sorted by status (active first) and creation date. Includes task counts only (milestones removed).';



CREATE OR REPLACE FUNCTION "public"."get_user_setting"("p_user_id" "uuid", "p_setting_path" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_value JSONB;
BEGIN
    -- Get setting value from user_settings table
    SELECT preferences #> string_to_array(p_setting_path, '.')
    INTO v_value
    FROM public.user_settings
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(v_value, 'null'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_user_setting"("p_user_id" "uuid", "p_setting_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tables"() RETURNS TABLE("table_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT c.table_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name = 'user_id'
    -- Future: Add exclusions here if needed
    -- AND c.table_name NOT IN ('excluded_table_name')
  ORDER BY 
    -- Order by foreign key dependencies (most dependent first)
    CASE c.table_name
      WHEN 'task_completions' THEN 1
      WHEN 'user_progress' THEN 2
      WHEN 'analytics_snapshots' THEN 3
      WHEN 'task_schedule' THEN 4
      WHEN 'tasks' THEN 5
      WHEN 'milestones' THEN 6
      WHEN 'onboarding_responses' THEN 7
      WHEN 'plans' THEN 8
      ELSE 99  -- New tables go last by default
    END;
END;
$$;


ALTER FUNCTION "public"."get_user_tables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workday_settings"("p_user_id" "uuid") RETURNS TABLE("workday_start_hour" integer, "workday_end_hour" integer, "lunch_start_hour" integer, "lunch_end_hour" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE((preferences->>'workday_start_hour')::integer, 9) as workday_start_hour,
        COALESCE((preferences->>'workday_end_hour')::integer, 17) as workday_end_hour,
        COALESCE((preferences->>'lunch_start_hour')::integer, 12) as lunch_start_hour,
        COALESCE((preferences->>'lunch_end_hour')::integer, 13) as lunch_end_hour
    FROM public.user_settings
    WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_workday_settings"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_plan"("p_user_id" "uuid", "p_goal_title" "text", "p_plan_summary" "text", "p_end_date" "date", "p_timeline_days" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    plan_id UUID;
BEGIN
    INSERT INTO plans (user_id, goal_text, summary_data, end_date, timeline_days)
    VALUES (p_user_id, p_goal_title, jsonb_build_object('plan_summary', p_plan_summary), p_end_date, p_timeline_days)
    RETURNING id INTO plan_id;
    
    RETURN plan_id;
END;
$$;


ALTER FUNCTION "public"."insert_plan"("p_user_id" "uuid", "p_goal_title" "text", "p_plan_summary" "text", "p_end_date" "date", "p_timeline_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN COALESCE(
        (SELECT (preferences->'smart_scheduling'->>'enabled')::boolean 
         FROM public.user_settings 
         WHERE user_id = p_user_id), 
        true
    );
END;
$$;


ALTER FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") IS 'Check if smart scheduling is enabled for a user. Defaults to TRUE if not explicitly disabled.';



CREATE OR REPLACE FUNCTION "public"."is_task_completed"("p_user_id" "uuid", "p_task_id" "uuid", "p_scheduled_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_completed boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.task_completions
    WHERE user_id = p_user_id
      AND task_id = p_task_id
      AND scheduled_date = p_scheduled_date
  ) INTO v_completed;
  
  RETURN v_completed;
END;
$$;


ALTER FUNCTION "public"."is_task_completed"("p_user_id" "uuid", "p_task_id" "uuid", "p_scheduled_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_task_complete"("p_user_id" "uuid", "p_task_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    task_exists BOOLEAN;
    plan_id UUID;
BEGIN
    -- Check if task exists and belongs to user
    SELECT EXISTS(
        SELECT 1 FROM tasks 
        WHERE id = p_task_id AND user_id = p_user_id
    ) INTO task_exists;
    
    IF NOT task_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Get plan_id for the task
    SELECT plan_id INTO plan_id FROM tasks WHERE id = p_task_id;
    
    -- Insert completion record
    INSERT INTO task_completions (user_id, task_id, plan_id)
    VALUES (p_user_id, p_task_id, plan_id)
    ON CONFLICT DO NOTHING;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."mark_task_complete"("p_user_id" "uuid", "p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_task_incomplete"("p_user_id" "uuid", "p_task_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    task_exists BOOLEAN;
BEGIN
    -- Check if task exists and belongs to user
    SELECT EXISTS(
        SELECT 1 FROM tasks 
        WHERE id = p_task_id AND user_id = p_user_id
    ) INTO task_exists;
    
    IF NOT task_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Delete completion record
    DELETE FROM task_completions 
    WHERE user_id = p_user_id AND task_id = p_task_id;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."mark_task_incomplete"("p_user_id" "uuid", "p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM pg_notify(
    'plan_update',
    jsonb_build_object(
      'action', 'manual_refresh',
      'plan_id', p_plan_id,
      'timestamp', NOW()
    )::TEXT
  );
END;
$$;


ALTER FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") IS 'Manually trigger a plan state refresh notification on the unified plan_update channel';



CREATE OR REPLACE FUNCTION "public"."reset_user_data"("target_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  plan_ids uuid[];
  deleted_counts json;
  temp_count int;
BEGIN
  -- Verify the calling user matches the target user (security check)
  IF auth.uid() IS NULL OR auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only reset your own data';
  END IF;

  -- Get all plan IDs for this user
  SELECT array_agg(id) INTO plan_ids
  FROM plans
  WHERE user_id = target_user_id;

  -- Initialize counts object
  deleted_counts := '{}'::json;

  -- Delete task_completions
  DELETE FROM task_completions WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{task_completions}', to_jsonb(temp_count))::json;

  -- Delete user_progress
  DELETE FROM user_progress WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{user_progress}', to_jsonb(temp_count))::json;

  -- Delete analytics_snapshots by plan_id AND user_id to ensure we get everything
  IF plan_ids IS NOT NULL AND array_length(plan_ids, 1) > 0 THEN
    DELETE FROM analytics_snapshots WHERE plan_id = ANY(plan_ids);
  END IF;
  DELETE FROM analytics_snapshots WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{analytics_snapshots}', to_jsonb(temp_count))::json;

  -- Delete task_schedule
  DELETE FROM task_schedule WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{task_schedule}', to_jsonb(temp_count))::json;

  -- Delete tasks
  DELETE FROM tasks WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{tasks}', to_jsonb(temp_count))::json;

  -- Delete milestones
  DELETE FROM milestones WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{milestones}', to_jsonb(temp_count))::json;

  -- Delete onboarding_responses
  DELETE FROM onboarding_responses WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{onboarding_responses}', to_jsonb(temp_count))::json;

  -- Delete plans (should work now since all dependencies are gone)
  DELETE FROM plans WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{plans}', to_jsonb(temp_count))::json;

  RETURN deleted_counts;
END;
$$;


ALTER FUNCTION "public"."reset_user_data"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reset_user_data"("target_user_id" "uuid") IS 'Deletes all user data (except auth) for the specified user. Can only be called by the user themselves. Bypasses RLS for thorough cleanup.';



CREATE OR REPLACE FUNCTION "public"."switch_active_plan"("p_user_id" "uuid", "p_new_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_active_plan_id uuid;
  v_new_plan_exists boolean;
BEGIN
  -- Verify the new plan exists and belongs to the user
  SELECT EXISTS(
    SELECT 1 FROM public.plans
    WHERE id = p_new_plan_id AND user_id = p_user_id
  ) INTO v_new_plan_exists;
  
  IF NOT v_new_plan_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Plan not found or does not belong to user'
    );
  END IF;
  
  -- Get current active plan ID
  SELECT id INTO v_current_active_plan_id
  FROM public.plans
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;
  
  -- Set current active plan to 'paused' (if exists)
  IF v_current_active_plan_id IS NOT NULL THEN
    UPDATE public.plans
    SET status = 'paused'
    WHERE id = v_current_active_plan_id AND user_id = p_user_id;
  END IF;
  
  -- Set new plan to 'active'
  UPDATE public.plans
  SET status = 'active'
  WHERE id = p_new_plan_id AND user_id = p_user_id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'previous_active_plan_id', v_current_active_plan_id,
    'new_active_plan_id', p_new_plan_id
  );
END;
$$;


ALTER FUNCTION "public"."switch_active_plan"("p_user_id" "uuid", "p_new_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."switch_active_plan"("p_user_id" "uuid", "p_new_plan_id" "uuid") IS 'Switches the active plan for a user. Sets current active plan to paused and new plan to active. Validates plan ownership.';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_setting"("p_user_id" "uuid", "p_setting_path" "text", "p_value" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update setting in user_settings table
    UPDATE public.user_settings
    SET preferences = jsonb_set(
        COALESCE(preferences, '{}'::jsonb),
        string_to_array(p_setting_path, '.'),
        p_value,
        true
    ),
    updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_user_setting"("p_user_id" "uuid", "p_setting_path" "text", "p_value" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."health_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "health_score" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "snapshot_date" "date" DEFAULT CURRENT_DATE,
    "has_scheduled_tasks" boolean DEFAULT false,
    "progress" numeric(5,2) DEFAULT 0,
    "consistency" numeric(5,2) DEFAULT 0,
    "efficiency" numeric(5,2),
    "total_tasks" integer DEFAULT 0,
    "total_completions" integer DEFAULT 0,
    "days_elapsed" integer DEFAULT 0,
    "current_streak_days" integer DEFAULT 0,
    "late_completion_penalty" numeric(5,2) DEFAULT 0,
    "overdue_penalty" numeric(5,2) DEFAULT 0,
    "consistency_gap_penalty" numeric(5,2) DEFAULT 0,
    "progress_lag_penalty" numeric(5,2) DEFAULT 0,
    "ontime_completion_bonus" numeric(5,2) DEFAULT 0,
    "early_completion_bonus" numeric(5,2) DEFAULT 0,
    "streak_bonus" numeric(5,2) DEFAULT 0
);


ALTER TABLE "public"."health_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."health_snapshots" IS 'Daily health snapshots for plans with time-block scheduling metrics';



COMMENT ON COLUMN "public"."health_snapshots"."snapshot_date" IS 'Date of the health snapshot';



COMMENT ON COLUMN "public"."health_snapshots"."has_scheduled_tasks" IS 'Whether the plan has tasks scheduled for this day';



COMMENT ON COLUMN "public"."health_snapshots"."progress" IS 'Overall progress percentage (0-100)';



COMMENT ON COLUMN "public"."health_snapshots"."consistency" IS 'Consistency score (0-100)';



COMMENT ON COLUMN "public"."health_snapshots"."efficiency" IS 'Efficiency score (0-100, can be NULL)';



COMMENT ON COLUMN "public"."health_snapshots"."total_tasks" IS 'Total number of tasks in the plan';



COMMENT ON COLUMN "public"."health_snapshots"."total_completions" IS 'Total number of completed tasks';



COMMENT ON COLUMN "public"."health_snapshots"."days_elapsed" IS 'Number of days since plan start';



COMMENT ON COLUMN "public"."health_snapshots"."current_streak_days" IS 'Current completion streak in days';



COMMENT ON COLUMN "public"."health_snapshots"."late_completion_penalty" IS 'Penalty for late task completions';



COMMENT ON COLUMN "public"."health_snapshots"."overdue_penalty" IS 'Penalty for overdue tasks';



COMMENT ON COLUMN "public"."health_snapshots"."consistency_gap_penalty" IS 'Penalty for consistency gaps';



COMMENT ON COLUMN "public"."health_snapshots"."progress_lag_penalty" IS 'Penalty for progress lag';



COMMENT ON COLUMN "public"."health_snapshots"."ontime_completion_bonus" IS 'Bonus for on-time completions';



COMMENT ON COLUMN "public"."health_snapshots"."early_completion_bonus" IS 'Bonus for early completions';



COMMENT ON COLUMN "public"."health_snapshots"."streak_bonus" IS 'Bonus for completion streaks';



CREATE TABLE IF NOT EXISTS "public"."onboarding_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "responses" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "plan_id" "uuid"
);


ALTER TABLE "public"."onboarding_responses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."onboarding_responses"."plan_id" IS 'Foreign key reference to the plan associated with these onboarding responses';



CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "goal_text" "text" NOT NULL,
    "clarifications" "jsonb",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "timeline_days" integer,
    "summary_data" "jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone,
    "plan_type" "text" DEFAULT 'ai'::"text" NOT NULL,
    "original_end_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "plans_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['ai'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduling_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "adjustment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "old_end_date" "date",
    "new_end_date" "date",
    "days_extended" integer DEFAULT 0,
    "tasks_rescheduled" integer DEFAULT 0,
    "task_adjustments" "jsonb" NOT NULL,
    "reason" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scheduling_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."scheduling_history" IS 'Tracks automatic rescheduling adjustments for plans';



CREATE TABLE IF NOT EXISTS "public"."task_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "scheduled_date" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."task_completions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."task_completions"."scheduled_date" IS 'Date when the task was scheduled to be completed (required for time-block scheduling)';



CREATE TABLE IF NOT EXISTS "public"."task_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "day_index" integer NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "duration_minutes" integer,
    "rescheduled_from" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "idx" integer NOT NULL,
    "name" "text" NOT NULL,
    "details" "text",
    "estimated_duration_minutes" integer DEFAULT 60 NOT NULL,
    "complexity_score" integer DEFAULT 5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tasks_complexity_score_check" CHECK ((("complexity_score" >= 1) AND ("complexity_score" <= 10)))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tasks"."idx" IS 'Sequential order index for tasks within a plan';



CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "preferences" "jsonb" DEFAULT '{"time_format": "12h", "lunch_end_hour": 13, "lunch_start_hour": 12, "workday_end_hour": 17, "workday_start_hour": 9}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "display_name" "text",
    "avatar_url" "text"
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_settings" IS 'Consolidated user preferences, settings, and profile information';



COMMENT ON COLUMN "public"."user_settings"."preferences" IS 'JSONB containing workday hours, time format, smart scheduling preferences, and other user settings';



COMMENT ON COLUMN "public"."user_settings"."display_name" IS 'User display name (migrated from user_profiles)';



COMMENT ON COLUMN "public"."user_settings"."avatar_url" IS 'User avatar URL (migrated from user_profiles)';



CREATE OR REPLACE VIEW "public"."v_plan_health" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "plan_id",
    "p"."user_id",
    "p"."goal_text",
    "p"."end_date",
    "p"."timeline_days",
    COALESCE("health"."health_score", 100.0) AS "health_score",
    COALESCE("health"."has_scheduled_tasks", false) AS "has_scheduled_tasks",
    COALESCE("health"."progress", 0.0) AS "progress",
    COALESCE("health"."consistency", 0.0) AS "consistency",
    "health"."efficiency",
    COALESCE("health"."total_tasks", 0) AS "total_tasks",
    COALESCE("health"."total_completions", 0) AS "total_completions",
    COALESCE("health"."days_elapsed", 0) AS "days_elapsed",
    COALESCE("health"."current_streak_days", 0) AS "current_streak_days",
    COALESCE("health"."late_completion_penalty", (0)::numeric) AS "late_completion_penalty",
    COALESCE("health"."overdue_penalty", (0)::numeric) AS "overdue_penalty",
    COALESCE("health"."consistency_gap_penalty", (0)::numeric) AS "consistency_gap_penalty",
    COALESCE("health"."progress_lag_penalty", (0)::numeric) AS "progress_lag_penalty",
    COALESCE("health"."ontime_completion_bonus", (0)::numeric) AS "ontime_completion_bonus",
    COALESCE("health"."early_completion_bonus", (0)::numeric) AS "early_completion_bonus",
    COALESCE("health"."streak_bonus", (0)::numeric) AS "streak_bonus",
    COALESCE("health"."last_activity_date", "p"."created_at") AS "last_activity_date"
   FROM ("public"."plans" "p"
     LEFT JOIN ( SELECT "ranked_health"."plan_id",
            "ranked_health"."health_score",
            "ranked_health"."has_scheduled_tasks",
            "ranked_health"."progress",
            "ranked_health"."consistency",
            "ranked_health"."efficiency",
            "ranked_health"."total_tasks",
            "ranked_health"."total_completions",
            "ranked_health"."days_elapsed",
            "ranked_health"."current_streak_days",
            "ranked_health"."late_completion_penalty",
            "ranked_health"."overdue_penalty",
            "ranked_health"."consistency_gap_penalty",
            "ranked_health"."progress_lag_penalty",
            "ranked_health"."ontime_completion_bonus",
            "ranked_health"."early_completion_bonus",
            "ranked_health"."streak_bonus",
            "ranked_health"."last_activity_date"
           FROM ( SELECT "health_snapshots"."plan_id",
                    "health_snapshots"."health_score",
                    "health_snapshots"."has_scheduled_tasks",
                    "health_snapshots"."progress",
                    "health_snapshots"."consistency",
                    "health_snapshots"."efficiency",
                    "health_snapshots"."total_tasks",
                    "health_snapshots"."total_completions",
                    "health_snapshots"."days_elapsed",
                    "health_snapshots"."current_streak_days",
                    "health_snapshots"."late_completion_penalty",
                    "health_snapshots"."overdue_penalty",
                    "health_snapshots"."consistency_gap_penalty",
                    "health_snapshots"."progress_lag_penalty",
                    "health_snapshots"."ontime_completion_bonus",
                    "health_snapshots"."early_completion_bonus",
                    "health_snapshots"."streak_bonus",
                    "health_snapshots"."created_at" AS "last_activity_date",
                    "row_number"() OVER (PARTITION BY "health_snapshots"."plan_id" ORDER BY "health_snapshots"."created_at" DESC) AS "rn"
                   FROM "public"."health_snapshots") "ranked_health"
          WHERE ("ranked_health"."rn" = 1)) "health" ON (("p"."id" = "health"."plan_id")));


ALTER VIEW "public"."v_plan_health" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_plan_health" IS 'Plan health metrics view with time-block scheduling system. Security is inherited from underlying tables (plans and health_snapshots).';



ALTER TABLE ONLY "public"."health_snapshots"
    ADD CONSTRAINT "health_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_responses"
    ADD CONSTRAINT "onboarding_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduling_history"
    ADD CONSTRAINT "scheduling_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_schedule"
    ADD CONSTRAINT "task_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_health_snapshots_created_at" ON "public"."health_snapshots" USING "btree" ("created_at");



CREATE INDEX "idx_health_snapshots_plan_id" ON "public"."health_snapshots" USING "btree" ("plan_id");



CREATE INDEX "idx_health_snapshots_user_id" ON "public"."health_snapshots" USING "btree" ("user_id");



CREATE INDEX "idx_onboarding_responses_plan_id" ON "public"."onboarding_responses" USING "btree" ("plan_id");



CREATE INDEX "idx_plans_end_date" ON "public"."plans" USING "btree" ("end_date");



CREATE INDEX "idx_plans_user_id" ON "public"."plans" USING "btree" ("user_id");



CREATE INDEX "idx_scheduling_history_adjustment_date" ON "public"."scheduling_history" USING "btree" ("adjustment_date");



CREATE INDEX "idx_task_completions_plan_id" ON "public"."task_completions" USING "btree" ("plan_id");



CREATE INDEX "idx_task_completions_scheduled_date" ON "public"."task_completions" USING "btree" ("scheduled_date");



COMMENT ON INDEX "public"."idx_task_completions_scheduled_date" IS 'Index on scheduled_date for performance optimization';



CREATE INDEX "idx_task_completions_task_id" ON "public"."task_completions" USING "btree" ("task_id");



CREATE INDEX "idx_task_completions_task_scheduled" ON "public"."task_completions" USING "btree" ("task_id", "scheduled_date");



COMMENT ON INDEX "public"."idx_task_completions_task_scheduled" IS 'Composite index on task_id and scheduled_date for common queries';



CREATE INDEX "idx_task_completions_user_id" ON "public"."task_completions" USING "btree" ("user_id");



CREATE INDEX "idx_task_schedule_date" ON "public"."task_schedule" USING "btree" ("date");



CREATE INDEX "idx_task_schedule_plan_id" ON "public"."task_schedule" USING "btree" ("plan_id");



CREATE INDEX "idx_task_schedule_start_time" ON "public"."task_schedule" USING "btree" ("start_time");



CREATE INDEX "idx_task_schedule_user_id" ON "public"."task_schedule" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_complexity" ON "public"."tasks" USING "btree" ("complexity_score");



CREATE INDEX "idx_tasks_duration" ON "public"."tasks" USING "btree" ("estimated_duration_minutes");



CREATE INDEX "idx_tasks_plan_id" ON "public"."tasks" USING "btree" ("plan_id");



CREATE INDEX "idx_tasks_user_id" ON "public"."tasks" USING "btree" ("user_id");



CREATE INDEX "idx_user_settings_avatar_url" ON "public"."user_settings" USING "btree" ("avatar_url") WHERE ("avatar_url" IS NOT NULL);



CREATE INDEX "idx_user_settings_display_name" ON "public"."user_settings" USING "btree" ("display_name");



CREATE OR REPLACE TRIGGER "update_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_schedule_updated_at" BEFORE UPDATE ON "public"."task_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."health_snapshots"
    ADD CONSTRAINT "health_snapshots_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_snapshots"
    ADD CONSTRAINT "health_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_responses"
    ADD CONSTRAINT "onboarding_responses_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_responses"
    ADD CONSTRAINT "onboarding_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduling_history"
    ADD CONSTRAINT "scheduling_history_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduling_history"
    ADD CONSTRAINT "scheduling_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_schedule"
    ADD CONSTRAINT "task_schedule_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_schedule"
    ADD CONSTRAINT "task_schedule_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_schedule"
    ADD CONSTRAINT "task_schedule_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete their own health snapshots" ON "public"."health_snapshots" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own onboarding responses" ON "public"."onboarding_responses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own plans" ON "public"."plans" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own settings" ON "public"."user_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own task completions" ON "public"."task_completions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own task schedules" ON "public"."task_schedule" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own tasks" ON "public"."tasks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own health snapshots" ON "public"."health_snapshots" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own onboarding responses" ON "public"."onboarding_responses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own plans" ON "public"."plans" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own task completions" ON "public"."task_completions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own task schedules" ON "public"."task_schedule" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their scheduling history" ON "public"."scheduling_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own health snapshots" ON "public"."health_snapshots" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own onboarding responses" ON "public"."onboarding_responses" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own plans" ON "public"."plans" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own task completions" ON "public"."task_completions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own task schedules" ON "public"."task_schedule" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tasks" ON "public"."tasks" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own health snapshots" ON "public"."health_snapshots" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own onboarding responses" ON "public"."onboarding_responses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own plans" ON "public"."plans" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own task completions" ON "public"."task_completions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own task schedules" ON "public"."task_schedule" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tasks" ON "public"."tasks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their scheduling history" ON "public"."scheduling_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."health_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduling_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_completions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."archive_plan"("p_user_id" "uuid", "p_plan_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_plan_data"("target_user_id" "uuid", "target_plan_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."detect_missed_tasks"("p_plan_id" "uuid", "p_check_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_missed_tasks"("p_plan_id" "uuid", "p_check_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rescheduling_stats"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rescheduling_stats"("p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_plans"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_user_setting"("p_user_id" "uuid", "p_setting_path" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_user_tables"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_task_completed"("p_user_id" "uuid", "p_task_id" "uuid", "p_scheduled_date" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."reset_user_data"("target_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."switch_active_plan"("p_user_id" "uuid", "p_new_plan_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_user_setting"("p_user_id" "uuid", "p_setting_path" "text", "p_value" "jsonb") TO "authenticated";
























GRANT ALL ON TABLE "public"."health_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."health_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."health_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_responses" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_responses" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."scheduling_history" TO "anon";
GRANT ALL ON TABLE "public"."scheduling_history" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduling_history" TO "service_role";



GRANT ALL ON TABLE "public"."task_completions" TO "anon";
GRANT ALL ON TABLE "public"."task_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."task_completions" TO "service_role";



GRANT ALL ON TABLE "public"."task_schedule" TO "anon";
GRANT ALL ON TABLE "public"."task_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."task_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."v_plan_health" TO "anon";
GRANT ALL ON TABLE "public"."v_plan_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_plan_health" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























RESET ALL;
