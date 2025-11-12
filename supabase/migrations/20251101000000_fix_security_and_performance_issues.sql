-- Fix database linter issues
-- This migration addresses:
-- 1. Function search_path mutable security issues (22 functions)
-- 2. RLS policy performance issues (29 policies)
-- 3. Unindexed foreign keys (4 foreign keys)

-- ============================================================================
-- 1. FIX FUNCTION SEARCH_PATH MUTABLE ISSUES
-- ============================================================================
-- Add SET search_path = '' to all SECURITY DEFINER functions to prevent search path injection

CREATE OR REPLACE FUNCTION "public"."archive_plan"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."capture_health_snapshot"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."delete_plan_data"("target_user_id" "uuid", "target_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."detect_missed_tasks"("p_plan_id" "uuid", "p_check_date" "date" DEFAULT (CURRENT_DATE - '1 day'::interval)) RETURNS TABLE("task_id" "uuid", "task_name" "text", "scheduled_date" "date", "days_overdue" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."get_plan_health_now"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."get_rescheduling_stats"("p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."get_smart_scheduling_settings"("p_user_id" "uuid") RETURNS TABLE("enabled" boolean, "auto_reschedule" boolean, "penalty_reduction" boolean, "notification_threshold" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."get_user_plans"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."get_user_setting"("p_user_id" "uuid", "p_setting_path" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."get_user_tables"() RETURNS TABLE("table_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."get_workday_settings"("p_user_id" "uuid") RETURNS TABLE("workday_start_hour" integer, "workday_end_hour" integer, "lunch_start_hour" integer, "lunch_end_hour" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."insert_plan"("p_user_id" "uuid", "p_goal_title" "text", "p_plan_summary" "text", "p_end_date" "date", "p_timeline_days" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."is_task_completed"("p_user_id" "uuid", "p_task_id" "uuid", "p_scheduled_date" "date") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."mark_task_complete"("p_user_id" "uuid", "p_task_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

CREATE OR REPLACE FUNCTION "public"."mark_task_incomplete"("p_user_id" "uuid", "p_task_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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
    
    -- Delete completion record
    DELETE FROM task_completions 
    WHERE user_id = p_user_id 
      AND task_id = p_task_id
      AND plan_id = plan_id;
    
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
    AS $$
BEGIN
  PERFORM pg_notify(
    'plan_update',
    jsonb_build_object(
      'action', 'state_refresh',
      'plan_id', p_plan_id,
      'timestamp', NOW()
    )::TEXT
  );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."switch_active_plan"("p_user_id" "uuid", "p_new_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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
  
  -- Get current active plan
  SELECT id INTO v_current_active_plan_id
  FROM public.plans
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;
  
  -- Deactivate current active plan (if exists)
  IF v_current_active_plan_id IS NOT NULL AND v_current_active_plan_id != p_new_plan_id THEN
    UPDATE public.plans
    SET status = 'paused'
    WHERE id = v_current_active_plan_id;
  END IF;
  
  -- Activate new plan
  UPDATE public.plans
  SET status = 'active'
  WHERE id = p_new_plan_id AND user_id = p_user_id;
  
  -- Return success result
  RETURN json_build_object(
    'success', true,
    'new_active_plan_id', p_new_plan_id,
    'previous_active_plan_id', v_current_active_plan_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET search_path = ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_user_setting"("p_user_id" "uuid", "p_setting_path" "text", "p_value" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = ''
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

-- ============================================================================
-- 2. FIX RLS POLICY PERFORMANCE ISSUES
-- ============================================================================
-- Replace auth.uid() with (select auth.uid()) to prevent re-evaluation for each row

-- Plans table policies
DROP POLICY IF EXISTS "Users can delete their own plans" ON "public"."plans";
CREATE POLICY "Users can delete their own plans" ON "public"."plans" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own plans" ON "public"."plans";
CREATE POLICY "Users can insert their own plans" ON "public"."plans" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update their own plans" ON "public"."plans";
CREATE POLICY "Users can update their own plans" ON "public"."plans" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their own plans" ON "public"."plans";
CREATE POLICY "Users can view their own plans" ON "public"."plans" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- Tasks table policies
DROP POLICY IF EXISTS "Users can delete their own tasks" ON "public"."tasks";
CREATE POLICY "Users can delete their own tasks" ON "public"."tasks" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own tasks" ON "public"."tasks";
CREATE POLICY "Users can insert their own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update their own tasks" ON "public"."tasks";
CREATE POLICY "Users can update their own tasks" ON "public"."tasks" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their own tasks" ON "public"."tasks";
CREATE POLICY "Users can view their own tasks" ON "public"."tasks" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- Task schedule table policies
DROP POLICY IF EXISTS "Users can delete their own task schedules" ON "public"."task_schedule";
CREATE POLICY "Users can delete their own task schedules" ON "public"."task_schedule" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own task schedules" ON "public"."task_schedule";
CREATE POLICY "Users can insert their own task schedules" ON "public"."task_schedule" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update their own task schedules" ON "public"."task_schedule";
CREATE POLICY "Users can update their own task schedules" ON "public"."task_schedule" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their own task schedules" ON "public"."task_schedule";
CREATE POLICY "Users can view their own task schedules" ON "public"."task_schedule" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- Task completions table policies
DROP POLICY IF EXISTS "Users can delete their own task completions" ON "public"."task_completions";
CREATE POLICY "Users can delete their own task completions" ON "public"."task_completions" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own task completions" ON "public"."task_completions";
CREATE POLICY "Users can insert their own task completions" ON "public"."task_completions" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update their own task completions" ON "public"."task_completions";
CREATE POLICY "Users can update their own task completions" ON "public"."task_completions" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their own task completions" ON "public"."task_completions";
CREATE POLICY "Users can view their own task completions" ON "public"."task_completions" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- Health snapshots table policies
DROP POLICY IF EXISTS "Users can delete their own health snapshots" ON "public"."health_snapshots";
CREATE POLICY "Users can delete their own health snapshots" ON "public"."health_snapshots" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own health snapshots" ON "public"."health_snapshots";
CREATE POLICY "Users can insert their own health snapshots" ON "public"."health_snapshots" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update their own health snapshots" ON "public"."health_snapshots";
CREATE POLICY "Users can update their own health snapshots" ON "public"."health_snapshots" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their own health snapshots" ON "public"."health_snapshots";
CREATE POLICY "Users can view their own health snapshots" ON "public"."health_snapshots" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- Onboarding responses table policies
DROP POLICY IF EXISTS "Users can delete their own onboarding responses" ON "public"."onboarding_responses";
CREATE POLICY "Users can delete their own onboarding responses" ON "public"."onboarding_responses" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own onboarding responses" ON "public"."onboarding_responses";
CREATE POLICY "Users can insert their own onboarding responses" ON "public"."onboarding_responses" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update their own onboarding responses" ON "public"."onboarding_responses";
CREATE POLICY "Users can update their own onboarding responses" ON "public"."onboarding_responses" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their own onboarding responses" ON "public"."onboarding_responses";
CREATE POLICY "Users can view their own onboarding responses" ON "public"."onboarding_responses" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- User settings table policies
DROP POLICY IF EXISTS "Users can delete their own settings" ON "public"."user_settings";
CREATE POLICY "Users can delete their own settings" ON "public"."user_settings" FOR DELETE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own settings" ON "public"."user_settings";
CREATE POLICY "Users can insert their own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can update their own settings" ON "public"."user_settings";
CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE USING (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their own settings" ON "public"."user_settings";
CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- Scheduling history table policies
DROP POLICY IF EXISTS "Users can insert their scheduling history" ON "public"."scheduling_history";
CREATE POLICY "Users can insert their scheduling history" ON "public"."scheduling_history" FOR INSERT WITH CHECK (((select auth.uid()) = "user_id"));

DROP POLICY IF EXISTS "Users can view their scheduling history" ON "public"."scheduling_history";
CREATE POLICY "Users can view their scheduling history" ON "public"."scheduling_history" FOR SELECT USING (((select auth.uid()) = "user_id"));

-- ============================================================================
-- 3. ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================================================

-- Index for onboarding_responses.user_id foreign key
CREATE INDEX IF NOT EXISTS "idx_onboarding_responses_user_id" ON "public"."onboarding_responses" ("user_id");

-- Index for scheduling_history.plan_id foreign key
CREATE INDEX IF NOT EXISTS "idx_scheduling_history_plan_id" ON "public"."scheduling_history" ("plan_id");

-- Index for scheduling_history.user_id foreign key
CREATE INDEX IF NOT EXISTS "idx_scheduling_history_user_id" ON "public"."scheduling_history" ("user_id");

-- Index for task_schedule.task_id foreign key
CREATE INDEX IF NOT EXISTS "idx_task_schedule_task_id" ON "public"."task_schedule" ("task_id");

