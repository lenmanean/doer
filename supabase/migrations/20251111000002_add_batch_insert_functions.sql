-- Migration: Add batch insert functions for improved performance
-- These functions reduce database round trips by batching operations
-- Significant performance improvement: 20+ calls -> 3-5 calls per plan

-- ============================================================================
-- BATCH INSERT TASKS FUNCTION
-- ============================================================================
-- Inserts multiple tasks in a single operation
-- Returns array of created task IDs in the same order as input

CREATE OR REPLACE FUNCTION "public"."batch_insert_tasks"(
  p_plan_id uuid,
  p_user_id uuid,
  p_tasks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ============================================================================
-- BATCH INSERT SCHEDULES FUNCTION
-- ============================================================================
-- Inserts multiple schedule entries in a single operation
-- Returns count of created schedules

CREATE OR REPLACE FUNCTION "public"."batch_insert_schedules"(
  p_plan_id uuid,
  p_user_id uuid,
  p_schedules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ============================================================================
-- CLEANUP ORPHANED DATA FUNCTION
-- ============================================================================
-- Removes orphaned tasks and schedules when plan generation fails
-- Used for error recovery

CREATE OR REPLACE FUNCTION "public"."cleanup_orphaned_plan_data"(
  p_plan_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION "public"."batch_insert_tasks"(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."batch_insert_schedules"(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."cleanup_orphaned_plan_data"(uuid, uuid) TO authenticated;

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION "public"."batch_insert_tasks" IS 
  'Batch inserts multiple tasks in a single operation. Reduces database round trips from N to 1 where N is number of tasks. Returns array of created task IDs in order.';

COMMENT ON FUNCTION "public"."batch_insert_schedules" IS 
  'Batch inserts multiple schedule entries in a single operation. Reduces database round trips from N to 1 where N is number of schedules. Validates task IDs before insertion.';

COMMENT ON FUNCTION "public"."cleanup_orphaned_plan_data" IS 
  'Removes orphaned plan data (tasks, schedules, plan) when generation fails. Used for error recovery to maintain database consistency. Safe to call even if data is already deleted.';


-- Significant performance improvement: 20+ calls -> 3-5 calls per plan

-- ============================================================================
-- BATCH INSERT TASKS FUNCTION
-- ============================================================================
-- Inserts multiple tasks in a single operation
-- Returns array of created task IDs in the same order as input

CREATE OR REPLACE FUNCTION "public"."batch_insert_tasks"(
  p_plan_id uuid,
  p_user_id uuid,
  p_tasks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ============================================================================
-- BATCH INSERT SCHEDULES FUNCTION
-- ============================================================================
-- Inserts multiple schedule entries in a single operation
-- Returns count of created schedules

CREATE OR REPLACE FUNCTION "public"."batch_insert_schedules"(
  p_plan_id uuid,
  p_user_id uuid,
  p_schedules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ============================================================================
-- CLEANUP ORPHANED DATA FUNCTION
-- ============================================================================
-- Removes orphaned tasks and schedules when plan generation fails
-- Used for error recovery

CREATE OR REPLACE FUNCTION "public"."cleanup_orphaned_plan_data"(
  p_plan_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION "public"."batch_insert_tasks"(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."batch_insert_schedules"(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."cleanup_orphaned_plan_data"(uuid, uuid) TO authenticated;

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION "public"."batch_insert_tasks" IS 
  'Batch inserts multiple tasks in a single operation. Reduces database round trips from N to 1 where N is number of tasks. Returns array of created task IDs in order.';

COMMENT ON FUNCTION "public"."batch_insert_schedules" IS 
  'Batch inserts multiple schedule entries in a single operation. Reduces database round trips from N to 1 where N is number of schedules. Validates task IDs before insertion.';

COMMENT ON FUNCTION "public"."cleanup_orphaned_plan_data" IS 
  'Removes orphaned plan data (tasks, schedules, plan) when generation fails. Used for error recovery to maintain database consistency. Safe to call even if data is already deleted.';



