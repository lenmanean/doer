-- Migration: Add atomic transaction wrapper for manual task creation
-- This ensures task creation and schedule insertion succeed or fail together
-- Prevents orphaned tasks or schedules in the database

-- ============================================================================
-- CREATE TRANSACTIONAL MANUAL TASK CREATION FUNCTION
-- ============================================================================
-- This function handles manual task creation atomically:
-- 1. Batch insert tasks
-- 2. Batch insert schedules
-- All within a single transaction with proper rollback on failure

CREATE OR REPLACE FUNCTION "public"."create_manual_tasks_with_schedules_transactional"(
  p_plan_id uuid,
  p_user_id uuid,
  p_tasks jsonb,
  p_schedules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task record;
  v_task_id_map jsonb := '{}'::jsonb;
  v_schedule record;
  v_tasks_created integer := 0;
  v_schedules_created integer := 0;
  v_error_context text;
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

  -- All operations within a single transaction
  BEGIN
    -- Verify plan exists and belongs to user
    IF NOT EXISTS (
      SELECT 1 FROM public.plans 
      WHERE id = p_plan_id 
        AND user_id = p_user_id 
        AND plan_type = 'manual'
    ) THEN
      RAISE EXCEPTION 'Plan not found or does not belong to user';
    END IF;
    
    -- 1. Batch insert tasks
    FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
    LOOP
      DECLARE
        v_new_task_id uuid;
        v_task_idx integer;
        v_task_name text;
      BEGIN
        v_task_idx := (v_task.value->>'idx')::integer;
        v_task_name := trim(v_task.value->>'name');
        
        IF v_task_name IS NULL OR v_task_name = '' THEN
          RAISE EXCEPTION 'Task name cannot be empty';
        END IF;
        
        INSERT INTO public.tasks (
          plan_id,
          user_id,
          idx,
          name,
          details,
          estimated_duration_minutes,
          priority,
          category
        )
        VALUES (
          p_plan_id,
          p_user_id,
          v_task_idx,
          v_task_name,
          NULLIF(v_task.value->>'details', ''),
          COALESCE((v_task.value->>'estimated_duration_minutes')::integer, 60),
          COALESCE((v_task.value->>'priority')::integer, 1),
          COALESCE(v_task.value->>'category', 'B')
        )
        RETURNING id INTO v_new_task_id;
        
        -- Build task ID mapping (original index -> new_id)
        v_task_id_map := jsonb_set(
          v_task_id_map,
          array[v_task_idx::text],
          to_jsonb(v_new_task_id)
        );
        
        v_tasks_created := v_tasks_created + 1;
      END;
    END LOOP;
    
    v_error_context := 'tasks created: ' || v_tasks_created::text;
    
    -- 2. Batch insert schedules
    IF p_schedules IS NOT NULL AND jsonb_array_length(p_schedules) > 0 THEN
      FOR v_schedule IN SELECT * FROM jsonb_array_elements(p_schedules)
      LOOP
        DECLARE
          v_task_idx text;
          v_mapped_task_id uuid;
        BEGIN
          v_task_idx := v_schedule.value->>'task_idx';
          v_mapped_task_id := (v_task_id_map->v_task_idx)::uuid;
          
          IF v_mapped_task_id IS NULL THEN
            RAISE EXCEPTION 'Task ID mapping not found for index: %', v_task_idx;
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
            v_mapped_task_id,
            (v_schedule.value->>'day_index')::integer,
            (v_schedule.value->>'date')::date,
            NULLIF(v_schedule.value->>'start_time', '')::time,
            NULLIF(v_schedule.value->>'end_time', '')::time,
            (v_schedule.value->>'duration_minutes')::integer,
            COALESCE(v_schedule.value->>'status', 'scheduled')
          );
          
          v_schedules_created := v_schedules_created + 1;
        END;
      END LOOP;
    END IF;
    
    v_error_context := v_error_context || ', schedules created: ' || v_schedules_created::text;
    
    -- Return success result
    RETURN jsonb_build_object(
      'success', true,
      'tasks_created', v_tasks_created,
      'schedules_created', v_schedules_created,
      'task_id_map', v_task_id_map,
      'message', 'Tasks and schedules created successfully'
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback happens automatically
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
GRANT EXECUTE ON FUNCTION "public"."create_manual_tasks_with_schedules_transactional"(uuid, uuid, jsonb, jsonb) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION "public"."create_manual_tasks_with_schedules_transactional" IS 
  'Atomically creates tasks and their schedules for a manual plan. Ensures data consistency by rolling back all changes if any operation fails.';
