-- Migration: Add atomic transaction wrapper for plan generation
-- This ensures all plan generation operations succeed or fail together
-- Prevents orphaned plans, tasks, or schedules in the database

-- ============================================================================
-- CREATE TRANSACTIONAL PLAN GENERATION FUNCTION
-- ============================================================================
-- This function handles the entire plan generation process atomically:
-- 1. Insert plan record
-- 2. Batch insert tasks
-- 3. Batch insert schedules
-- 4. Update onboarding_responses
-- All within a single transaction with proper rollback on failure

CREATE OR REPLACE FUNCTION "public"."create_plan_with_tasks_transactional"(
  p_user_id uuid,
  p_goal_text text,
  p_start_date date,
  p_end_date date,
  p_summary_data jsonb,
  p_tasks jsonb,
  p_schedules jsonb,
  p_onboarding_response_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION "public"."create_plan_with_tasks_transactional"(uuid, text, date, date, jsonb, jsonb, jsonb, uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION "public"."create_plan_with_tasks_transactional" IS 
  'Atomically creates a plan with all associated tasks and schedules. Ensures data consistency by rolling back all changes if any operation fails. Returns success status with created IDs or error details with rollback confirmation.';


-- Prevents orphaned plans, tasks, or schedules in the database

-- ============================================================================
-- CREATE TRANSACTIONAL PLAN GENERATION FUNCTION
-- ============================================================================
-- This function handles the entire plan generation process atomically:
-- 1. Insert plan record
-- 2. Batch insert tasks
-- 3. Batch insert schedules
-- 4. Update onboarding_responses
-- All within a single transaction with proper rollback on failure

CREATE OR REPLACE FUNCTION "public"."create_plan_with_tasks_transactional"(
  p_user_id uuid,
  p_goal_text text,
  p_start_date date,
  p_end_date date,
  p_summary_data jsonb,
  p_tasks jsonb,
  p_schedules jsonb,
  p_onboarding_response_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION "public"."create_plan_with_tasks_transactional"(uuid, text, date, date, jsonb, jsonb, jsonb, uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION "public"."create_plan_with_tasks_transactional" IS 
  'Atomically creates a plan with all associated tasks and schedules. Ensures data consistency by rolling back all changes if any operation fails. Returns success status with created IDs or error details with rollback confirmation.';



