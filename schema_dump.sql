


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






CREATE TYPE "public"."api_token_scope" AS ENUM (
    'plans.generate',
    'plans.read',
    'plans.schedule',
    'clarify',
    'reschedules',
    'integrations',
    'admin'
);


ALTER TYPE "public"."api_token_scope" OWNER TO "postgres";


CREATE TYPE "public"."billing_cycle" AS ENUM (
    'monthly',
    'annual'
);


ALTER TYPE "public"."billing_cycle" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'trialing',
    'past_due',
    'canceled'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."usage_ledger_action" AS ENUM (
    'reserve',
    'commit',
    'release',
    'adjust',
    'reset'
);


ALTER TYPE "public"."usage_ledger_action" OWNER TO "postgres";


CREATE TYPE "public"."usage_metric" AS ENUM (
    'api_credits',
    'integration_actions'
);


ALTER TYPE "public"."usage_metric" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_plan"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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



CREATE OR REPLACE FUNCTION "public"."batch_insert_schedules"("p_plan_id" "uuid", "p_user_id" "uuid", "p_schedules" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_schedule record;
  v_schedule_ids jsonb := '[]'::jsonb;
  v_new_schedule_id uuid;
  v_schedules_inserted integer := 0;
BEGIN
  -- Validate inputs
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_id cannot be null';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;
  
  IF p_schedules IS NULL OR jsonb_array_length(p_schedules) = 0 THEN
    RAISE EXCEPTION 'schedules array cannot be empty';
  END IF;
  
  -- Verify plan exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.plans 
    WHERE id = p_plan_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Plan not found or does not belong to user';
  END IF;
  
  -- Insert schedules in batch
  FOR v_schedule IN SELECT * FROM jsonb_array_elements(p_schedules)
  LOOP
    -- Verify task exists
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE id = (v_schedule.value->>'task_id')::uuid 
        AND plan_id = p_plan_id
        AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Task % not found in plan', v_schedule.value->>'task_id';
    END IF;
    
    INSERT INTO public.task_schedule (
      plan_id,
      user_id,
      task_id,
      day_index,
      date,
      start_time,
      end_time,
      duration_minutes,
      status
    )
    VALUES (
      p_plan_id,
      p_user_id,
      (v_schedule.value->>'task_id')::uuid,
      (v_schedule.value->>'day_index')::integer,
      (v_schedule.value->>'date')::date,
      (v_schedule.value->>'start_time')::time,
      (v_schedule.value->>'end_time')::time,
      (v_schedule.value->>'duration_minutes')::integer,
      COALESCE(v_schedule.value->>'status', 'scheduled')
    )
    RETURNING id INTO v_new_schedule_id;
    
    v_schedule_ids := v_schedule_ids || to_jsonb(v_new_schedule_id);
    v_schedules_inserted := v_schedules_inserted + 1;
  END LOOP;
  
  -- Return created schedule IDs
  RETURN jsonb_build_object(
    'success', true,
    'schedule_ids', v_schedule_ids,
    'schedules_inserted', v_schedules_inserted
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$$;


ALTER FUNCTION "public"."batch_insert_schedules"("p_plan_id" "uuid", "p_user_id" "uuid", "p_schedules" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."batch_insert_schedules"("p_plan_id" "uuid", "p_user_id" "uuid", "p_schedules" "jsonb") IS 'Batch inserts multiple schedule entries in a single operation. Reduces database round trips from N to 1 where N is number of schedules. Validates task IDs before insertion.';



CREATE OR REPLACE FUNCTION "public"."batch_insert_tasks"("p_plan_id" "uuid", "p_user_id" "uuid", "p_tasks" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_task record;
  v_task_ids jsonb := '[]'::jsonb;
  v_new_task_id uuid;
  v_tasks_inserted integer := 0;
BEGIN
  -- Validate inputs
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_id cannot be null';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;
  
  IF p_tasks IS NULL OR jsonb_array_length(p_tasks) = 0 THEN
    RAISE EXCEPTION 'tasks array cannot be empty';
  END IF;
  
  -- Verify plan exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.plans 
    WHERE id = p_plan_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Plan not found or does not belong to user';
  END IF;
  
  -- Insert tasks in batch
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
  LOOP
    INSERT INTO public.tasks (
      plan_id,
      user_id,
      idx,
      name,
      details,
      estimated_duration_minutes,
      priority,
      assigned_to_plan
    )
    VALUES (
      p_plan_id,
      p_user_id,
      (v_task.value->>'idx')::integer,
      v_task.value->>'name',
      v_task.value->>'details',
      (v_task.value->>'estimated_duration_minutes')::integer,
      (v_task.value->>'priority')::integer,
      COALESCE((v_task.value->>'assigned_to_plan')::boolean, true)
    )
    RETURNING id INTO v_new_task_id;
    
    v_task_ids := v_task_ids || to_jsonb(v_new_task_id);
    v_tasks_inserted := v_tasks_inserted + 1;
  END LOOP;
  
  -- Return created task IDs
  RETURN jsonb_build_object(
    'success', true,
    'task_ids', v_task_ids,
    'tasks_inserted', v_tasks_inserted
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$$;


ALTER FUNCTION "public"."batch_insert_tasks"("p_plan_id" "uuid", "p_user_id" "uuid", "p_tasks" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."batch_insert_tasks"("p_plan_id" "uuid", "p_user_id" "uuid", "p_tasks" "jsonb") IS 'Batch inserts multiple tasks in a single operation. Reduces database round trips from N to 1 where N is number of tasks. Returns array of created task IDs in order.';



CREATE OR REPLACE FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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



CREATE OR REPLACE FUNCTION "public"."cleanup_orphaned_plan_data"("p_plan_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_tasks_deleted integer := 0;
  v_schedules_deleted integer := 0;
  v_plan_deleted boolean := false;
BEGIN
  -- Validate inputs
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_id cannot be null';
  END IF;
  
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;
  
  -- Delete schedules first (foreign key constraint)
  DELETE FROM public.task_schedule
  WHERE plan_id = p_plan_id AND user_id = p_user_id;
  
  GET DIAGNOSTICS v_schedules_deleted = ROW_COUNT;
  
  -- Delete tasks
  DELETE FROM public.tasks
  WHERE plan_id = p_plan_id AND user_id = p_user_id;
  
  GET DIAGNOSTICS v_tasks_deleted = ROW_COUNT;
  
  -- Delete plan if it exists
  DELETE FROM public.plans
  WHERE id = p_plan_id AND user_id = p_user_id;
  
  -- Check if plan was deleted
  v_plan_deleted := FOUND;
  
  -- Return cleanup summary
  RETURN jsonb_build_object(
    'success', true,
    'plan_deleted', v_plan_deleted,
    'tasks_deleted', v_tasks_deleted,
    'schedules_deleted', v_schedules_deleted,
    'message', 'Cleanup completed successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$$;


ALTER FUNCTION "public"."cleanup_orphaned_plan_data"("p_plan_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_orphaned_plan_data"("p_plan_id" "uuid", "p_user_id" "uuid") IS 'Removes orphaned plan data (tasks, schedules, plan) when generation fails. Used for error recovery to maintain database consistency. Safe to call even if data is already deleted.';



CREATE OR REPLACE FUNCTION "public"."commit_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb" DEFAULT '{}'::"jsonb", "p_token_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  usage_row public.plan_usage_balances;
  new_available integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'COMMIT_AMOUNT_INVALID', DETAIL = 'Commit amount must be greater than zero.';
  END IF;

  SELECT *
    INTO usage_row
  FROM public.plan_usage_balances
  WHERE user_id = p_user_id
    AND metric = p_metric
    AND CURRENT_DATE BETWEEN cycle_start AND cycle_end
  FOR UPDATE;

  IF usage_row.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'USAGE_BALANCE_NOT_FOUND', DETAIL = 'No active usage balance for metric.';
  END IF;

  IF usage_row.reserved < p_amount THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVED_BALANCE_LOW', DETAIL = 'Reserved balance is lower than commit amount.';
  END IF;

  UPDATE public.plan_usage_balances
    SET reserved = reserved - p_amount,
        used = used + p_amount,
        updated_at = now()
    WHERE id = usage_row.id
    RETURNING allocation - used - reserved INTO new_available;

  INSERT INTO public.usage_ledger(
    user_id,
    billing_plan_cycle_id,
    metric,
    action,
    amount,
    balance_after,
    reference,
    token_id,
    recorded_by
  )
  VALUES (
    p_user_id,
    usage_row.billing_plan_cycle_id,
    p_metric,
    'commit',
    p_amount,
    new_available,
    COALESCE(p_reference, '{}'::jsonb),
    p_token_id,
    auth.uid()
  );

  RETURN new_available;
END;
$$;


ALTER FUNCTION "public"."commit_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."commit_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") IS 'Finalize previously reserved usage credits, reducing available balance and increasing used total.';



CREATE OR REPLACE FUNCTION "public"."create_plan_with_tasks_transactional"("p_user_id" "uuid", "p_goal_text" "text", "p_start_date" "date", "p_end_date" "date", "p_summary_data" "jsonb", "p_tasks" "jsonb", "p_schedules" "jsonb", "p_onboarding_response_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_plan_id uuid;
  v_task record;
  v_task_id_map jsonb := '{}'::jsonb;
  v_schedule record;
  v_tasks_created integer := 0;
  v_schedules_created integer := 0;
  v_error_context text;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;
  
  IF p_goal_text IS NULL OR trim(p_goal_text) = '' THEN
    RAISE EXCEPTION 'goal_text cannot be empty';
  END IF;
  
  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'start_date cannot be null';
  END IF;
  
  IF p_end_date IS NULL THEN
    RAISE EXCEPTION 'end_date cannot be null';
  END IF;
  
  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'start_date cannot be after end_date';
  END IF;

  -- Start transaction (implicit in function, but explicit for clarity)
  BEGIN
    -- 1. Pause any existing active plans
    UPDATE public.plans
    SET status = 'paused'
    WHERE user_id = p_user_id
      AND status = 'active';
    
    -- 2. Insert plan record
    INSERT INTO public.plans (
      user_id,
      goal_text,
      start_date,
      end_date,
      status,
      plan_type,
      summary_data
    )
    VALUES (
      p_user_id,
      p_goal_text,
      p_start_date,
      p_end_date,
      'active',
      'ai',
      p_summary_data
    )
    RETURNING id INTO v_plan_id;
    
    v_error_context := 'plan created: ' || v_plan_id::text;
    
    -- 3. Batch insert tasks
    FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
    LOOP
      DECLARE
        v_new_task_id uuid;
        v_task_idx integer;
      BEGIN
        v_task_idx := (v_task.value->>'idx')::integer;
        
        INSERT INTO public.tasks (
          plan_id,
          user_id,
          idx,
          name,
          details,
          estimated_duration_minutes,
          priority,
          assigned_to_plan
        )
        VALUES (
          v_plan_id,
          p_user_id,
          v_task_idx,
          v_task.value->>'name',
          v_task.value->>'details',
          (v_task.value->>'estimated_duration_minutes')::integer,
          (v_task.value->>'priority')::integer,
          true
        )
        RETURNING id INTO v_new_task_id;
        
        -- Build task ID mapping (original_id -> new_id)
        v_task_id_map := jsonb_set(
          v_task_id_map,
          array[v_task.value->>'original_id'],
          to_jsonb(v_new_task_id)
        );
        
        v_tasks_created := v_tasks_created + 1;
      END;
    END LOOP;
    
    v_error_context := v_error_context || ', tasks created: ' || v_tasks_created::text;
    
    -- 4. Batch insert schedules (using mapped task IDs)
    FOR v_schedule IN SELECT * FROM jsonb_array_elements(p_schedules)
    LOOP
      DECLARE
        v_original_task_id text;
        v_mapped_task_id uuid;
      BEGIN
        v_original_task_id := v_schedule.value->>'task_id';
        v_mapped_task_id := (v_task_id_map->v_original_task_id)::uuid;
        
        IF v_mapped_task_id IS NULL THEN
          RAISE EXCEPTION 'Task ID mapping not found for: %', v_original_task_id;
        END IF;
        
        INSERT INTO public.task_schedule (
          plan_id,
          user_id,
          task_id,
          day_index,
          date,
          start_time,
          end_time,
          duration_minutes
        )
        VALUES (
          v_plan_id,
          p_user_id,
          v_mapped_task_id,
          (v_schedule.value->>'day_index')::integer,
          (v_schedule.value->>'date')::date,
          (v_schedule.value->>'start_time')::time,
          (v_schedule.value->>'end_time')::time,
          (v_schedule.value->>'duration_minutes')::integer
        );
        
        v_schedules_created := v_schedules_created + 1;
      END;
    END LOOP;
    
    v_error_context := v_error_context || ', schedules created: ' || v_schedules_created::text;
    
    -- 5. Update onboarding_responses if provided
    IF p_onboarding_response_id IS NOT NULL THEN
      UPDATE public.onboarding_responses
      SET 
        plan_id = v_plan_id,
        responses = jsonb_set(
          COALESCE(responses, '{}'::jsonb),
          '{plan_id}',
          to_jsonb(v_plan_id)
        )
      WHERE id = p_onboarding_response_id
        AND user_id = p_user_id;
    END IF;
    
    -- Return success result with created IDs
    RETURN jsonb_build_object(
      'success', true,
      'plan_id', v_plan_id,
      'tasks_created', v_tasks_created,
      'schedules_created', v_schedules_created,
      'task_id_map', v_task_id_map,
      'message', 'Plan generated successfully'
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback happens automatically
      -- Return detailed error information
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE,
        'context', v_error_context,
        'message', 'Transaction rolled back due to error'
      );
  END;
END;
$$;


ALTER FUNCTION "public"."create_plan_with_tasks_transactional"("p_user_id" "uuid", "p_goal_text" "text", "p_start_date" "date", "p_end_date" "date", "p_summary_data" "jsonb", "p_tasks" "jsonb", "p_schedules" "jsonb", "p_onboarding_response_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_plan_with_tasks_transactional"("p_user_id" "uuid", "p_goal_text" "text", "p_start_date" "date", "p_end_date" "date", "p_summary_data" "jsonb", "p_tasks" "jsonb", "p_schedules" "jsonb", "p_onboarding_response_id" "uuid") IS 'Atomically creates a plan with all associated tasks and schedules. Ensures data consistency by rolling back all changes if any operation fails. Returns success status with created IDs or error details with rollback confirmation.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."plan_usage_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "billing_plan_cycle_id" "uuid",
    "metric" "public"."usage_metric" NOT NULL,
    "cycle_start" "date" NOT NULL,
    "cycle_end" "date" NOT NULL,
    "allocation" integer NOT NULL,
    "used" integer DEFAULT 0 NOT NULL,
    "reserved" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plan_usage_balances_allocation_check" CHECK (("allocation" >= 0)),
    CONSTRAINT "plan_usage_balances_reserved_check" CHECK (("reserved" >= 0)),
    CONSTRAINT "plan_usage_balances_used_check" CHECK (("used" >= 0))
);


ALTER TABLE "public"."plan_usage_balances" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_usage_balance"("p_user_id" "uuid", "p_metric" "public"."usage_metric") RETURNS "public"."plan_usage_balances"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT *
  FROM public.plan_usage_balances
  WHERE user_id = p_user_id
    AND metric = p_metric
    AND CURRENT_DATE BETWEEN cycle_start AND cycle_end
  ORDER BY cycle_end DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."current_usage_balance"("p_user_id" "uuid", "p_metric" "public"."usage_metric") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_usage_balance"("p_user_id" "uuid", "p_metric" "public"."usage_metric") IS 'Fetch the active usage balance row for a user and metric within the current cycle.';



CREATE OR REPLACE FUNCTION "public"."delete_plan_data"("target_user_id" "uuid", "target_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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



CREATE OR REPLACE FUNCTION "public"."detect_overdue_tasks_by_time"("p_user_id" "uuid", "p_plan_id" "uuid", "p_check_time" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("task_id" "uuid", "schedule_id" "uuid", "task_name" "text", "scheduled_date" "date", "start_time" time without time zone, "end_time" time without time zone, "duration_minutes" integer, "priority" integer, "complexity_score" integer, "status" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."detect_overdue_tasks_by_time"("p_user_id" "uuid", "p_plan_id" "uuid", "p_check_time" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detect_overdue_tasks_by_time"("p_user_id" "uuid", "p_plan_id" "uuid", "p_check_time" timestamp with time zone) IS 'Detects tasks scheduled for today that have passed their end_time without completion. Simplified logic with clearer NULL handling.';



CREATE OR REPLACE FUNCTION "public"."enforce_unmetered_access_default"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.unmetered_access := false;
    ELSE
      NEW.unmetered_access := COALESCE(OLD.unmetered_access, false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_unmetered_access_default"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_plan_health_now"("p_user_id" "uuid", "p_plan_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Create user_settings record with username from auth metadata
  INSERT INTO public.user_settings (
    user_id,
    username,
    timezone,
    locale,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC'),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en-US'),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Automatically creates user_settings record with username from auth metadata when a new user signs up';



CREATE OR REPLACE FUNCTION "public"."insert_plan"("p_user_id" "uuid", "p_goal_title" "text", "p_plan_summary" "text", "p_end_date" "date", "p_timeline_days" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


CREATE OR REPLACE FUNCTION "public"."is_auto_reschedule_enabled"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."is_auto_reschedule_enabled"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_auto_reschedule_enabled"("p_user_id" "uuid") IS 'Checks if auto-rescheduling is enabled for a user. Defaults to true if not explicitly disabled.';



CREATE OR REPLACE FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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


CREATE OR REPLACE FUNCTION "public"."is_username_available"("check_username" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.user_settings 
    WHERE LOWER(username) = LOWER(check_username)
  );
END;
$$;


ALTER FUNCTION "public"."is_username_available"("check_username" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_username_available"("check_username" "text") IS 'Checks if a username is available (case-insensitive check)';



CREATE OR REPLACE FUNCTION "public"."mark_task_complete"("p_user_id" "uuid", "p_task_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."mark_task_incomplete"("p_user_id" "uuid", "p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_username_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Allow setting username if it's currently NULL
  IF OLD.username IS NOT NULL AND NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'Username cannot be changed once set';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_username_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_username_change"() IS 'Prevents username changes after initial set to maintain username stability and security';



CREATE OR REPLACE FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") IS 'Manually trigger a plan state refresh notification on the unified plan_update channel';



CREATE OR REPLACE FUNCTION "public"."release_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb" DEFAULT '{}'::"jsonb", "p_token_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  usage_row public.plan_usage_balances;
  new_available integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'RELEASE_AMOUNT_INVALID', DETAIL = 'Release amount must be greater than zero.';
  END IF;

  SELECT *
    INTO usage_row
  FROM public.plan_usage_balances
  WHERE user_id = p_user_id
    AND metric = p_metric
    AND CURRENT_DATE BETWEEN cycle_start AND cycle_end
  FOR UPDATE;

  IF usage_row.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'USAGE_BALANCE_NOT_FOUND', DETAIL = 'No active usage balance for metric.';
  END IF;

  IF usage_row.reserved < p_amount THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVED_BALANCE_LOW', DETAIL = 'Reserved balance is lower than release amount.';
  END IF;

  UPDATE public.plan_usage_balances
    SET reserved = reserved - p_amount,
        updated_at = now()
    WHERE id = usage_row.id
    RETURNING allocation - used - reserved INTO new_available;

  INSERT INTO public.usage_ledger(
    user_id,
    billing_plan_cycle_id,
    metric,
    action,
    amount,
    balance_after,
    reference,
    token_id,
    recorded_by
  )
  VALUES (
    p_user_id,
    usage_row.billing_plan_cycle_id,
    p_metric,
    'release',
    p_amount,
    new_available,
    COALESCE(p_reference, '{}'::jsonb),
    p_token_id,
    auth.uid()
  );

  RETURN new_available;
END;
$$;


ALTER FUNCTION "public"."release_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."release_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") IS 'Return reserved credits back to the available pool without marking them as used.';



CREATE OR REPLACE FUNCTION "public"."reserve_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb" DEFAULT '{}'::"jsonb", "p_token_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("success" boolean, "remaining" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  usage_row public.plan_usage_balances;
  available integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'RESERVE_AMOUNT_INVALID', DETAIL = 'Reserve amount must be greater than zero.';
  END IF;

  SELECT *
    INTO usage_row
  FROM public.plan_usage_balances
  WHERE user_id = p_user_id
    AND metric = p_metric
    AND CURRENT_DATE BETWEEN cycle_start AND cycle_end
  FOR UPDATE;

  IF usage_row.id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'USAGE_BALANCE_NOT_FOUND', DETAIL = 'No active usage balance for metric.';
  END IF;

  available := usage_row.allocation - usage_row.used - usage_row.reserved;

  IF available < p_amount THEN
    RETURN QUERY SELECT false, available;
    RETURN;
  END IF;

  UPDATE public.plan_usage_balances
    SET reserved = reserved + p_amount,
        updated_at = now()
    WHERE id = usage_row.id;

  INSERT INTO public.usage_ledger(
    user_id,
    billing_plan_cycle_id,
    metric,
    action,
    amount,
    balance_after,
    reference,
    token_id,
    recorded_by
  )
  VALUES (
    p_user_id,
    usage_row.billing_plan_cycle_id,
    p_metric,
    'reserve',
    p_amount,
    (usage_row.allocation - usage_row.used - usage_row.reserved) - p_amount,
    COALESCE(p_reference, '{}'::jsonb),
    p_token_id,
    auth.uid()
  );

  RETURN QUERY SELECT true, (usage_row.allocation - usage_row.used - usage_row.reserved) - p_amount;
END;
$$;


ALTER FUNCTION "public"."reserve_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reserve_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") IS 'Atomically reserve usage credits and emit a ledger entry. Returns success flag and remaining available credits.';



CREATE OR REPLACE FUNCTION "public"."reset_usage_cycle"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_cycle_start" "date", "p_cycle_end" "date", "p_allocation" integer, "p_reference" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  balance_id uuid;
BEGIN
  IF p_allocation < 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'ALLOCATION_INVALID', DETAIL = 'Allocation must be zero or positive.';
  END IF;

  INSERT INTO public.plan_usage_balances(
    user_id,
    billing_plan_cycle_id,
    metric,
    cycle_start,
    cycle_end,
    allocation,
    used,
    reserved
  )
  VALUES (
    p_user_id,
    (
      SELECT billing_plan_cycle_id
      FROM public.user_plan_subscriptions
      WHERE user_id = p_user_id
      ORDER BY current_period_end DESC
      LIMIT 1
    ),
    p_metric,
    p_cycle_start,
    p_cycle_end,
    p_allocation,
    0,
    0
  )
  ON CONFLICT (user_id, metric, cycle_start) DO UPDATE
    SET allocation = EXCLUDED.allocation,
        cycle_end = EXCLUDED.cycle_end,
        used = 0,
        reserved = 0,
        updated_at = now()
  RETURNING id INTO balance_id;

  INSERT INTO public.usage_ledger(
    user_id,
    billing_plan_cycle_id,
    metric,
    action,
    amount,
    balance_after,
    reference,
    recorded_by
  )
  VALUES (
    p_user_id,
    (
      SELECT billing_plan_cycle_id
      FROM public.user_plan_subscriptions
      WHERE user_id = p_user_id
      ORDER BY current_period_end DESC
      LIMIT 1
    ),
    p_metric,
    'reset',
    p_allocation,
    p_allocation,
    COALESCE(p_reference, '{}'::jsonb),
    auth.uid()
  );

  RETURN balance_id;
END;
$$;


ALTER FUNCTION "public"."reset_usage_cycle"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_cycle_start" "date", "p_cycle_end" "date", "p_allocation" integer, "p_reference" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reset_usage_cycle"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_cycle_start" "date", "p_cycle_end" "date", "p_allocation" integer, "p_reference" "jsonb") IS 'Reset (or initialize) a user''s usage balance for a new billing cycle and emit a ledger entry.';



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
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."switch_active_plan"("p_user_id" "uuid", "p_new_plan_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."switch_active_plan"("p_user_id" "uuid", "p_new_plan_id" "uuid") IS 'Switches the active plan for a user. Sets current active plan to paused and new plan to active. Validates plan ownership.';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_setting"("p_user_id" "uuid", "p_setting_path" "text", "p_value" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


CREATE TABLE IF NOT EXISTS "public"."api_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "billing_plan_cycle_id" "uuid",
    "secret_salt" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "scopes" "public"."api_token_scope"[] DEFAULT ARRAY['plans.generate'::"public"."api_token_scope", 'plans.read'::"public"."api_token_scope"] NOT NULL,
    "expires_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."api_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_plan_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "billing_plan_id" "uuid" NOT NULL,
    "cycle" "public"."billing_cycle" NOT NULL,
    "api_credit_limit" integer NOT NULL,
    "integration_action_limit" integer NOT NULL,
    "price_cents" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "billing_plan_cycles_api_credit_limit_check" CHECK (("api_credit_limit" >= 0)),
    CONSTRAINT "billing_plan_cycles_integration_action_limit_check" CHECK (("integration_action_limit" >= 0)),
    CONSTRAINT "billing_plan_cycles_price_cents_check" CHECK (("price_cents" >= 0))
);


ALTER TABLE "public"."billing_plan_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_plans" OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."pending_reschedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "task_schedule_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "proposed_date" "date" NOT NULL,
    "proposed_start_time" time without time zone NOT NULL,
    "proposed_end_time" time without time zone NOT NULL,
    "proposed_day_index" integer NOT NULL,
    "original_date" "date" NOT NULL,
    "original_start_time" time without time zone,
    "original_end_time" time without time zone,
    "original_day_index" integer NOT NULL,
    "context_score" numeric,
    "priority_penalty" numeric,
    "density_penalty" numeric,
    "reason" "text" DEFAULT 'auto_reschedule_overdue'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by_user_id" "uuid",
    CONSTRAINT "pending_reschedules_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."pending_reschedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_reschedules" IS 'Stores reschedule proposals that require user approval before being applied';



COMMENT ON COLUMN "public"."pending_reschedules"."plan_id" IS 'Plan ID for plan-based tasks. NULL for free-mode tasks not associated with a plan.';



COMMENT ON COLUMN "public"."pending_reschedules"."context_score" IS 'Score indicating how well the proposed slot fits the task context';



COMMENT ON COLUMN "public"."pending_reschedules"."status" IS 'Status: pending (awaiting approval), accepted (applied), rejected (user declined)';



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
    CONSTRAINT "plans_date_order_check" CHECK (("start_date" <= "end_date")),
    CONSTRAINT "plans_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['ai'::"text", 'manual'::"text"]))),
    CONSTRAINT "plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'completed'::"text", 'archived'::"text"]))),
    CONSTRAINT "plans_timeline_days_check" CHECK ((((("summary_data" ->> 'total_duration_days'::"text"))::integer IS NULL) OR (((("summary_data" ->> 'total_duration_days'::"text"))::integer >= 1) AND ((("summary_data" ->> 'total_duration_days'::"text"))::integer <= 21)))),
    CONSTRAINT "plans_type_check" CHECK (("plan_type" = ANY (ARRAY['ai'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


COMMENT ON CONSTRAINT "plans_timeline_days_check" ON "public"."plans" IS 'Ensures timeline is between 1-21 days to maintain quality and prevent scope creep';



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
    "plan_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "day_index" integer NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "duration_minutes" integer,
    "rescheduled_from" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'scheduled'::"text",
    "reschedule_count" integer DEFAULT 0 NOT NULL,
    "last_rescheduled_at" timestamp with time zone,
    "reschedule_reason" "jsonb",
    "pending_reschedule_id" "uuid",
    CONSTRAINT "task_schedule_day_index_check" CHECK (("day_index" >= 0)),
    CONSTRAINT "task_schedule_duration_check" CHECK ((("duration_minutes" IS NULL) OR ("duration_minutes" > 0))),
    CONSTRAINT "task_schedule_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'cancelled'::"text", 'rescheduled'::"text"])))),
    CONSTRAINT "task_schedule_time_order_check" CHECK ((("start_time" IS NULL) OR ("end_time" IS NULL) OR ("start_time" < "end_time")))
);


ALTER TABLE "public"."task_schedule" OWNER TO "postgres";


COMMENT ON COLUMN "public"."task_schedule"."plan_id" IS 'Foreign key to plans table. Null for free-mode tasks not associated with a plan.';



COMMENT ON COLUMN "public"."task_schedule"."status" IS 'Task scheduling status: scheduled (normal), overdue (passed end_time), pending_reschedule (awaiting user approval), rescheduling (in process), rescheduled (completed rescheduling)';



COMMENT ON COLUMN "public"."task_schedule"."reschedule_count" IS 'Number of times this task has been auto-rescheduled';



COMMENT ON COLUMN "public"."task_schedule"."last_rescheduled_at" IS 'Timestamp of last auto-rescheduling action';



COMMENT ON COLUMN "public"."task_schedule"."reschedule_reason" IS 'JSONB metadata about rescheduling: reason, old_time, new_time, context_score, etc.';



COMMENT ON COLUMN "public"."task_schedule"."pending_reschedule_id" IS 'Reference to pending reschedule proposal awaiting user approval';



COMMENT ON CONSTRAINT "task_schedule_time_order_check" ON "public"."task_schedule" IS 'Ensures start_time is before end_time for logical time blocks';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "idx" integer,
    "name" "text" NOT NULL,
    "details" "text",
    "estimated_duration_minutes" integer DEFAULT 60 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "assigned_to_plan" boolean DEFAULT true NOT NULL,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "is_indefinite" boolean DEFAULT false NOT NULL,
    "category" "text",
    "recurrence_days" integer[],
    "recurrence_start_date" "date",
    "recurrence_end_date" "date",
    "priority" integer,
    "default_start_time" time without time zone,
    "default_end_time" time without time zone,
    CONSTRAINT "tasks_category_check" CHECK (("category" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text"]))),
    CONSTRAINT "tasks_duration_check" CHECK ((("estimated_duration_minutes" >= 5) AND ("estimated_duration_minutes" <= 360))),
    CONSTRAINT "tasks_idx_positive_check" CHECK (("idx" > 0)),
    CONSTRAINT "tasks_name_not_empty_check" CHECK ((TRIM(BOTH FROM "name") <> ''::"text")),
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY[1, 2, 3, 4])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'tasks table (cache touch 2025-10-30 12:30)';



COMMENT ON COLUMN "public"."tasks"."plan_id" IS 'Plan ID for tasks that belong to a specific plan. NULL for free mode tasks created in schedule view.';



COMMENT ON COLUMN "public"."tasks"."idx" IS 'Sequential order index for tasks within a plan. NULL for free mode tasks created in schedule view.';



COMMENT ON COLUMN "public"."tasks"."assigned_to_plan" IS 'Indicates if this task is part of a specific plan';



COMMENT ON COLUMN "public"."tasks"."is_recurring" IS 'Indicates if this task repeats weekly (all recurring tasks are weekly in weekly schedule view)';



COMMENT ON COLUMN "public"."tasks"."is_indefinite" IS 'For recurring tasks, indicates if they continue indefinitely';



COMMENT ON COLUMN "public"."tasks"."category" IS 'Priority/difficulty category: A (hard difficulty, high priority), B (medium difficulty, medium priority), C (easy difficulty, low priority). NULL for free-mode tasks not associated with a plan.';



COMMENT ON COLUMN "public"."tasks"."recurrence_days" IS 'Array of days of week (0=Sunday, 1=Monday, etc.) for recurring tasks';



COMMENT ON COLUMN "public"."tasks"."recurrence_start_date" IS 'Start date for recurring task range';



COMMENT ON COLUMN "public"."tasks"."recurrence_end_date" IS 'End date for recurring task range';



COMMENT ON COLUMN "public"."tasks"."priority" IS 'Task priority: 1=Critical (foundation/dependencies), 2=High (core functionality), 3=Medium (enhancements), 4=Low (polish/optional)';



COMMENT ON CONSTRAINT "tasks_duration_check" ON "public"."tasks" IS 'Ensures task durations are realistic: 5 min minimum, 6 hours maximum';



COMMENT ON CONSTRAINT "tasks_priority_check" ON "public"."tasks" IS 'Ensures priority is valid: 1=Critical, 2=High, 3=Medium, 4=Low';



CREATE TABLE IF NOT EXISTS "public"."usage_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "billing_plan_cycle_id" "uuid",
    "metric" "public"."usage_metric" NOT NULL,
    "action" "public"."usage_ledger_action" NOT NULL,
    "amount" integer NOT NULL,
    "balance_after" integer,
    "reference" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "token_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recorded_by" "uuid",
    "notes" "text",
    CONSTRAINT "usage_ledger_amount_check" CHECK (("amount" >= 0)),
    CONSTRAINT "usage_ledger_balance_after_check" CHECK (("balance_after" >= 0))
);


ALTER TABLE "public"."usage_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_plan_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "billing_plan_cycle_id" "uuid" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'active'::"public"."subscription_status" NOT NULL,
    "current_period_start" "date" NOT NULL,
    "current_period_end" "date" NOT NULL,
    "cancel_at" "date",
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "external_customer_id" "text",
    "external_subscription_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_plan_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "preferences" "jsonb" DEFAULT '{"theme": "dark", "privacy": {"analytics_enabled": false, "improve_model_enabled": false}, "time_format": "12h", "accent_color": "orange", "lunch_end_hour": 13, "week_start_day": 0, "auto_reschedule": {"enabled": true, "buffer_minutes": 15, "priority_spacing": "moderate", "reschedule_window_days": 3}, "lunch_start_hour": 12, "workday_end_hour": 17, "workday_start_hour": 9}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text",
    "first_name" "text",
    "last_name" "text",
    "date_of_birth" "date",
    "phone_number" "text",
    "phone_verified" boolean DEFAULT false NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text",
    "locale" "text" DEFAULT 'en-US'::"text",
    "username" "text",
    "referral_source" "text",
    "unmetered_access" boolean DEFAULT false NOT NULL,
    "stripe_customer_id" "text",
    CONSTRAINT "user_settings_lunch_hours_check" CHECK ((((("preferences" ->> 'lunch_start_hour'::"text"))::integer IS NULL) OR ((("preferences" ->> 'lunch_end_hour'::"text"))::integer IS NULL) OR (((("preferences" ->> 'lunch_start_hour'::"text"))::integer >= 0) AND ((("preferences" ->> 'lunch_start_hour'::"text"))::integer <= 23) AND ((("preferences" ->> 'lunch_end_hour'::"text"))::integer >= 1) AND ((("preferences" ->> 'lunch_end_hour'::"text"))::integer <= 24) AND ((("preferences" ->> 'lunch_start_hour'::"text"))::integer < (("preferences" ->> 'lunch_end_hour'::"text"))::integer)))),
    CONSTRAINT "user_settings_time_format_check" CHECK (((("preferences" ->> 'time_format'::"text") IS NULL) OR (("preferences" ->> 'time_format'::"text") = ANY (ARRAY['12h'::"text", '24h'::"text"])))),
    CONSTRAINT "user_settings_workday_hours_check" CHECK ((((("preferences" ->> 'workday_start_hour'::"text"))::integer IS NULL) OR ((("preferences" ->> 'workday_end_hour'::"text"))::integer IS NULL) OR (((("preferences" ->> 'workday_start_hour'::"text"))::integer >= 0) AND ((("preferences" ->> 'workday_start_hour'::"text"))::integer <= 23) AND ((("preferences" ->> 'workday_end_hour'::"text"))::integer >= 1) AND ((("preferences" ->> 'workday_end_hour'::"text"))::integer <= 24) AND ((("preferences" ->> 'workday_start_hour'::"text"))::integer < (("preferences" ->> 'workday_end_hour'::"text"))::integer)))),
    CONSTRAINT "username_format_check" CHECK (("username" ~ '^[a-zA-Z0-9_-]{3,20}$'::"text"))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_settings" IS 'User preferences and settings - uses first_name instead of display_name';



COMMENT ON COLUMN "public"."user_settings"."preferences" IS 'JSONB containing user preferences: workday hours, time format, smart scheduling preferences, week start day (0=Sunday, 1=Monday, etc.), theme (dark/light), accent_color (orange/blue/etc.), privacy settings (improve_model_enabled, analytics_enabled), and other user settings. Display name and avatar_url are stored in separate columns. Privacy preferences default to false (opt-in).';



COMMENT ON COLUMN "public"."user_settings"."avatar_url" IS 'User avatar URL (migrated from user_profiles)';



COMMENT ON COLUMN "public"."user_settings"."first_name" IS 'User first name';



COMMENT ON COLUMN "public"."user_settings"."last_name" IS 'User last name';



COMMENT ON COLUMN "public"."user_settings"."date_of_birth" IS 'User date of birth';



COMMENT ON COLUMN "public"."user_settings"."phone_number" IS 'User phone number (E.164 format recommended)';



COMMENT ON COLUMN "public"."user_settings"."phone_verified" IS 'Whether the phone number has been verified. Phone verification will be implemented in a future update.';



COMMENT ON COLUMN "public"."user_settings"."timezone" IS 'User timezone (e.g., America/Los_Angeles, UTC). Used for scheduling and time display.';



COMMENT ON COLUMN "public"."user_settings"."locale" IS 'User locale preference (e.g., en-US, en-GB). Used for date/time formatting and language.';



COMMENT ON COLUMN "public"."user_settings"."username" IS 'Unique username for login. 3-20 characters, alphanumeric with underscores and hyphens allowed. Case-insensitive for uniqueness.';



COMMENT ON COLUMN "public"."user_settings"."referral_source" IS 'How the user heard about the platform (e.g., search, social, friend, blog, youtube, podcast, ad, other)';



COMMENT ON COLUMN "public"."user_settings"."unmetered_access" IS 'When true, bypasses plan credit enforcement (admin use only).';



COMMENT ON COLUMN "public"."user_settings"."stripe_customer_id" IS 'Stripe customer identifier associated with this user (nullable).';



CREATE OR REPLACE VIEW "public"."user_usage_summary" AS
 SELECT "bub"."user_id",
    "bub"."metric",
    "bub"."cycle_start",
    "bub"."cycle_end",
    "bub"."allocation",
    "bub"."used",
    "bub"."reserved",
    (("bub"."allocation" - "bub"."used") - "bub"."reserved") AS "available",
    "bpc"."cycle" AS "billing_cycle"
   FROM ("public"."plan_usage_balances" "bub"
     JOIN "public"."billing_plan_cycles" "bpc" ON (("bpc"."id" = "bub"."billing_plan_cycle_id")));


ALTER VIEW "public"."user_usage_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_usage_summary" IS 'Aggregated view of per-user usage balances including available credits.';



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



ALTER TABLE ONLY "public"."api_tokens"
    ADD CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_tokens"
    ADD CONSTRAINT "api_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."billing_plan_cycles"
    ADD CONSTRAINT "billing_plan_cycles_billing_plan_id_cycle_key" UNIQUE ("billing_plan_id", "cycle");



ALTER TABLE ONLY "public"."billing_plan_cycles"
    ADD CONSTRAINT "billing_plan_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_plans"
    ADD CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_plans"
    ADD CONSTRAINT "billing_plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."health_snapshots"
    ADD CONSTRAINT "health_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_responses"
    ADD CONSTRAINT "onboarding_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_reschedules"
    ADD CONSTRAINT "pending_reschedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_usage_balances"
    ADD CONSTRAINT "plan_usage_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_usage_balances"
    ADD CONSTRAINT "plan_usage_balances_user_id_metric_cycle_start_key" UNIQUE ("user_id", "metric", "cycle_start");



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



ALTER TABLE ONLY "public"."usage_ledger"
    ADD CONSTRAINT "usage_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_plan_subscriptions"
    ADD CONSTRAINT "user_plan_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_health_snapshots_created_at" ON "public"."health_snapshots" USING "btree" ("created_at");



CREATE INDEX "idx_health_snapshots_plan_id" ON "public"."health_snapshots" USING "btree" ("plan_id");



CREATE INDEX "idx_health_snapshots_user_id" ON "public"."health_snapshots" USING "btree" ("user_id");



CREATE INDEX "idx_onboarding_responses_plan_id" ON "public"."onboarding_responses" USING "btree" ("plan_id");



CREATE INDEX "idx_onboarding_responses_user_id" ON "public"."onboarding_responses" USING "btree" ("user_id");



CREATE INDEX "idx_pending_reschedules_created_at" ON "public"."pending_reschedules" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pending_reschedules_plan_id" ON "public"."pending_reschedules" USING "btree" ("plan_id") WHERE ("plan_id" IS NOT NULL);



CREATE INDEX "idx_pending_reschedules_reviewed_by_user_id" ON "public"."pending_reschedules" USING "btree" ("reviewed_by_user_id") WHERE ("reviewed_by_user_id" IS NOT NULL);



CREATE INDEX "idx_pending_reschedules_status" ON "public"."pending_reschedules" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_pending_reschedules_task_id" ON "public"."pending_reschedules" USING "btree" ("task_id");



CREATE INDEX "idx_pending_reschedules_task_schedule" ON "public"."pending_reschedules" USING "btree" ("task_schedule_id");



CREATE INDEX "idx_pending_reschedules_user_free_mode" ON "public"."pending_reschedules" USING "btree" ("user_id") WHERE ("plan_id" IS NULL);



CREATE INDEX "idx_pending_reschedules_user_plan" ON "public"."pending_reschedules" USING "btree" ("user_id", "plan_id") WHERE ("plan_id" IS NOT NULL);



CREATE INDEX "idx_plans_end_date" ON "public"."plans" USING "btree" ("end_date");



CREATE INDEX "idx_plans_user_id" ON "public"."plans" USING "btree" ("user_id");



CREATE INDEX "idx_plans_user_status" ON "public"."plans" USING "btree" ("user_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_scheduling_history_adjustment_date" ON "public"."scheduling_history" USING "btree" ("adjustment_date");



CREATE INDEX "idx_scheduling_history_plan_id" ON "public"."scheduling_history" USING "btree" ("plan_id");



CREATE INDEX "idx_scheduling_history_user_id" ON "public"."scheduling_history" USING "btree" ("user_id");



CREATE INDEX "idx_task_completions_plan_id" ON "public"."task_completions" USING "btree" ("plan_id");



CREATE INDEX "idx_task_completions_scheduled_date" ON "public"."task_completions" USING "btree" ("scheduled_date");



COMMENT ON INDEX "public"."idx_task_completions_scheduled_date" IS 'Index on scheduled_date for performance optimization';



CREATE INDEX "idx_task_completions_task_id" ON "public"."task_completions" USING "btree" ("task_id");



CREATE INDEX "idx_task_completions_task_scheduled" ON "public"."task_completions" USING "btree" ("task_id", "scheduled_date");



COMMENT ON INDEX "public"."idx_task_completions_task_scheduled" IS 'Composite index on task_id and scheduled_date for common queries';



CREATE INDEX "idx_task_completions_user_id" ON "public"."task_completions" USING "btree" ("user_id");



CREATE INDEX "idx_task_schedule_date" ON "public"."task_schedule" USING "btree" ("date");



CREATE INDEX "idx_task_schedule_date_range" ON "public"."task_schedule" USING "btree" ("user_id", "date");



CREATE INDEX "idx_task_schedule_pending_reschedule" ON "public"."task_schedule" USING "btree" ("pending_reschedule_id") WHERE ("pending_reschedule_id" IS NOT NULL);



CREATE INDEX "idx_task_schedule_plan_id" ON "public"."task_schedule" USING "btree" ("plan_id");



CREATE INDEX "idx_task_schedule_start_time" ON "public"."task_schedule" USING "btree" ("start_time");



CREATE INDEX "idx_task_schedule_status" ON "public"."task_schedule" USING "btree" ("user_id", "status") WHERE ("status" = 'scheduled'::"text");



CREATE INDEX "idx_task_schedule_task_id" ON "public"."task_schedule" USING "btree" ("task_id");



CREATE INDEX "idx_task_schedule_user_id" ON "public"."task_schedule" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_duration" ON "public"."tasks" USING "btree" ("estimated_duration_minutes");



CREATE INDEX "idx_tasks_plan_id" ON "public"."tasks" USING "btree" ("plan_id");



CREATE INDEX "idx_tasks_priority" ON "public"."tasks" USING "btree" ("plan_id", "priority");



CREATE INDEX "idx_tasks_user_id" ON "public"."tasks" USING "btree" ("user_id");



CREATE INDEX "idx_user_settings_avatar_url" ON "public"."user_settings" USING "btree" ("avatar_url") WHERE ("avatar_url" IS NOT NULL);



CREATE INDEX "idx_user_settings_phone_number" ON "public"."user_settings" USING "btree" ("phone_number") WHERE ("phone_number" IS NOT NULL);



CREATE UNIQUE INDEX "idx_user_settings_username_lower" ON "public"."user_settings" USING "btree" ("lower"("username"));



CREATE INDEX "plan_usage_balances_user_idx" ON "public"."plan_usage_balances" USING "btree" ("user_id", "metric");



CREATE INDEX "tasks_is_indefinite_idx" ON "public"."tasks" USING "btree" ("is_indefinite");



CREATE INDEX "usage_ledger_user_idx" ON "public"."usage_ledger" USING "btree" ("user_id", "metric", "created_at");



CREATE UNIQUE INDEX "user_plan_subscriptions_active_idx" ON "public"."user_plan_subscriptions" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['active'::"public"."subscription_status", 'trialing'::"public"."subscription_status"]));



CREATE INDEX "user_plan_subscriptions_user_idx" ON "public"."user_plan_subscriptions" USING "btree" ("user_id", "status");



CREATE OR REPLACE TRIGGER "enforce_unmetered_access_default" BEFORE INSERT OR UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_unmetered_access_default"();



CREATE OR REPLACE TRIGGER "trigger_prevent_username_change" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_username_change"();



CREATE OR REPLACE TRIGGER "update_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_schedule_updated_at" BEFORE UPDATE ON "public"."task_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."api_tokens"
    ADD CONSTRAINT "api_tokens_billing_plan_cycle_id_fkey" FOREIGN KEY ("billing_plan_cycle_id") REFERENCES "public"."billing_plan_cycles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_tokens"
    ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_plan_cycles"
    ADD CONSTRAINT "billing_plan_cycles_billing_plan_id_fkey" FOREIGN KEY ("billing_plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_snapshots"
    ADD CONSTRAINT "health_snapshots_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_snapshots"
    ADD CONSTRAINT "health_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_responses"
    ADD CONSTRAINT "onboarding_responses_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_responses"
    ADD CONSTRAINT "onboarding_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_reschedules"
    ADD CONSTRAINT "pending_reschedules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_reschedules"
    ADD CONSTRAINT "pending_reschedules_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_reschedules"
    ADD CONSTRAINT "pending_reschedules_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_reschedules"
    ADD CONSTRAINT "pending_reschedules_task_schedule_id_fkey" FOREIGN KEY ("task_schedule_id") REFERENCES "public"."task_schedule"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_reschedules"
    ADD CONSTRAINT "pending_reschedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_usage_balances"
    ADD CONSTRAINT "plan_usage_balances_billing_plan_cycle_id_fkey" FOREIGN KEY ("billing_plan_cycle_id") REFERENCES "public"."billing_plan_cycles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plan_usage_balances"
    ADD CONSTRAINT "plan_usage_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "task_schedule_pending_reschedule_id_fkey" FOREIGN KEY ("pending_reschedule_id") REFERENCES "public"."pending_reschedules"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."usage_ledger"
    ADD CONSTRAINT "usage_ledger_billing_plan_cycle_id_fkey" FOREIGN KEY ("billing_plan_cycle_id") REFERENCES "public"."billing_plan_cycles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_ledger"
    ADD CONSTRAINT "usage_ledger_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_ledger"
    ADD CONSTRAINT "usage_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_plan_subscriptions"
    ADD CONSTRAINT "user_plan_subscriptions_billing_plan_cycle_id_fkey" FOREIGN KEY ("billing_plan_cycle_id") REFERENCES "public"."billing_plan_cycles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_plan_subscriptions"
    ADD CONSTRAINT "user_plan_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Service role manages usage balances" ON "public"."plan_usage_balances" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages usage ledger" ON "public"."usage_ledger" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can delete their own health snapshots" ON "public"."health_snapshots" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own onboarding responses" ON "public"."onboarding_responses" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own pending reschedules" ON "public"."pending_reschedules" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own plans" ON "public"."plans" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own settings" ON "public"."user_settings" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own task completions" ON "public"."task_completions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own task schedules" ON "public"."task_schedule" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own tasks" ON "public"."tasks" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own health snapshots" ON "public"."health_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own onboarding responses" ON "public"."onboarding_responses" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own pending reschedules" ON "public"."pending_reschedules" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own plans" ON "public"."plans" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own settings" ON "public"."user_settings" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own task completions" ON "public"."task_completions" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own task schedules" ON "public"."task_schedule" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own tasks" ON "public"."tasks" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their scheduling history" ON "public"."scheduling_history" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own health snapshots" ON "public"."health_snapshots" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own onboarding responses" ON "public"."onboarding_responses" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own pending reschedules" ON "public"."pending_reschedules" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own plans" ON "public"."plans" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own task completions" ON "public"."task_completions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own task schedules" ON "public"."task_schedule" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own tasks" ON "public"."tasks" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own health snapshots" ON "public"."health_snapshots" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own onboarding responses" ON "public"."onboarding_responses" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own pending reschedules" ON "public"."pending_reschedules" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own plans" ON "public"."plans" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own task completions" ON "public"."task_completions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own task schedules" ON "public"."task_schedule" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own tasks" ON "public"."tasks" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their scheduling history" ON "public"."scheduling_history" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their usage balances" ON "public"."plan_usage_balances" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their usage ledger" ON "public"."usage_ledger" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own API tokens" ON "public"."api_tokens" USING ((("auth"."uid"() = "user_id") AND ("revoked_at" IS NULL))) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."api_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."health_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_reschedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_usage_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduling_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_completions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."archive_plan"("p_user_id" "uuid", "p_plan_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."batch_insert_schedules"("p_plan_id" "uuid", "p_user_id" "uuid", "p_schedules" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."batch_insert_tasks"("p_plan_id" "uuid", "p_user_id" "uuid", "p_tasks" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_rescheduling_penalty_reduction"("p_task_id" "uuid", "p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_orphaned_plan_data"("p_plan_id" "uuid", "p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."commit_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_plan_with_tasks_transactional"("p_user_id" "uuid", "p_goal_text" "text", "p_start_date" "date", "p_end_date" "date", "p_summary_data" "jsonb", "p_tasks" "jsonb", "p_schedules" "jsonb", "p_onboarding_response_id" "uuid") TO "authenticated";



GRANT ALL ON TABLE "public"."plan_usage_balances" TO "anon";
GRANT ALL ON TABLE "public"."plan_usage_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_usage_balances" TO "service_role";



GRANT ALL ON FUNCTION "public"."current_usage_balance"("p_user_id" "uuid", "p_metric" "public"."usage_metric") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_plan_data"("target_user_id" "uuid", "target_plan_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."detect_missed_tasks"("p_plan_id" "uuid", "p_check_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_missed_tasks"("p_plan_id" "uuid", "p_check_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rescheduling_stats"("p_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rescheduling_stats"("p_plan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_plans"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_user_setting"("p_user_id" "uuid", "p_setting_path" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_user_tables"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_auto_reschedule_enabled"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_auto_reschedule_enabled"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_smart_scheduling_enabled"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_task_completed"("p_user_id" "uuid", "p_task_id" "uuid", "p_scheduled_date" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_username_available"("check_username" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."refresh_plan_state"("p_plan_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."release_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_usage"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_amount" integer, "p_reference" "jsonb", "p_token_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_usage_cycle"("p_user_id" "uuid", "p_metric" "public"."usage_metric", "p_cycle_start" "date", "p_cycle_end" "date", "p_allocation" integer, "p_reference" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_user_data"("target_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."switch_active_plan"("p_user_id" "uuid", "p_new_plan_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_user_setting"("p_user_id" "uuid", "p_setting_path" "text", "p_value" "jsonb") TO "authenticated";
























GRANT ALL ON TABLE "public"."api_tokens" TO "anon";
GRANT ALL ON TABLE "public"."api_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."api_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."billing_plan_cycles" TO "anon";
GRANT ALL ON TABLE "public"."billing_plan_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_plan_cycles" TO "service_role";



GRANT ALL ON TABLE "public"."billing_plans" TO "anon";
GRANT ALL ON TABLE "public"."billing_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_plans" TO "service_role";



GRANT ALL ON TABLE "public"."health_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."health_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."health_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_responses" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_responses" TO "service_role";



GRANT ALL ON TABLE "public"."pending_reschedules" TO "anon";
GRANT ALL ON TABLE "public"."pending_reschedules" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_reschedules" TO "service_role";



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



GRANT ALL ON TABLE "public"."usage_ledger" TO "anon";
GRANT ALL ON TABLE "public"."usage_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."user_plan_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_plan_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_plan_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_usage_summary" TO "anon";
GRANT ALL ON TABLE "public"."user_usage_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."user_usage_summary" TO "service_role";



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
