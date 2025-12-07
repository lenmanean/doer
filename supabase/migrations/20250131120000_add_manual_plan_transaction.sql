-- Migration: Add atomic transaction wrapper for manual plan creation
-- This ensures plan creation and pausing existing plans succeed or fail together
-- Prevents race conditions and orphaned active plans

-- ============================================================================
-- CREATE TRANSACTIONAL MANUAL PLAN CREATION FUNCTION
-- ============================================================================
-- This function handles manual plan creation atomically:
-- 1. Pause any existing active plans for the user
-- 2. Insert new manual plan record
-- All within a single transaction with proper rollback on failure

CREATE OR REPLACE FUNCTION "public"."create_manual_plan_transactional"(
  p_user_id uuid,
  p_goal_text text,
  p_start_date date,
  p_end_date date,
  p_summary_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan_id uuid;
  v_plans_paused integer := 0;
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

  -- All operations within a single transaction
  BEGIN
    -- 1. Pause any existing active plans
    UPDATE public.plans
    SET status = 'paused'
    WHERE user_id = p_user_id
      AND status = 'active';
    
    GET DIAGNOSTICS v_plans_paused = ROW_COUNT;
    
    -- 2. Insert manual plan record
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
      'manual',
      p_summary_data
    )
    RETURNING id INTO v_plan_id;
    
    -- Return success result
    RETURN jsonb_build_object(
      'success', true,
      'plan_id', v_plan_id,
      'plans_paused', v_plans_paused,
      'message', 'Manual plan created successfully'
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback happens automatically
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE,
        'message', 'Transaction rolled back due to error'
      );
  END;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION "public"."create_manual_plan_transactional"(uuid, text, date, date, jsonb) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION "public"."create_manual_plan_transactional" IS 
  'Atomically creates a manual plan and pauses any existing active plans for the user. Ensures data consistency by rolling back all changes if any operation fails.';
