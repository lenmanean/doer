-- Migration: Multiple Plans Support
-- Purpose: Enable users to have multiple plans with single active plan workflow
-- Date: 2025-10-12
--
-- Changes:
-- - Add archived_at field to plans table
-- - Add unique constraint for one active plan per user
-- - Add RPC functions for plan management (switch, archive, list)

-- ============================================================
-- Step 1: Add archived_at field to plans table
-- ============================================================

ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.plans.archived_at IS
'Timestamp when the plan was archived. NULL for non-archived plans.';

-- ============================================================
-- Step 2: Create unique index for one active plan per user
-- ============================================================

-- Ensure only one plan can be 'active' per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_plan_per_user 
ON public.plans(user_id) 
WHERE status = 'active';

COMMENT ON INDEX idx_one_active_plan_per_user IS
'Ensures each user can have only one active plan at a time. Partial index on status=active.';

-- ============================================================
-- Step 3: RPC Function - Switch Active Plan
-- ============================================================

CREATE OR REPLACE FUNCTION public.switch_active_plan(
  p_user_id uuid,
  p_new_plan_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION public.switch_active_plan IS
'Switches the active plan for a user. Sets current active plan to paused and new plan to active. Validates plan ownership.';

-- ============================================================
-- Step 4: RPC Function - Archive Plan
-- ============================================================

CREATE OR REPLACE FUNCTION public.archive_plan(
  p_user_id uuid,
  p_plan_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION public.archive_plan IS
'Archives a plan by setting status to archived and recording archived_at timestamp. Does not auto-activate another plan if archiving active plan.';

-- ============================================================
-- Step 5: RPC Function - Get User Plans
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_plans(
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
      'milestone_count', (
        SELECT COUNT(*) 
        FROM public.milestones m 
        WHERE m.plan_id = p.id
      ),
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
  ) INTO v_plans
  FROM public.plans p
  WHERE p.user_id = p_user_id;
  
  -- Return plans or empty array if none exist
  RETURN COALESCE(v_plans, '[]'::json);
END;
$$;

COMMENT ON FUNCTION public.get_user_plans IS
'Returns all plans for a user with summary data, sorted by status (active first) and creation date. Includes milestone and task counts.';

-- ============================================================
-- Step 6: Update existing data to ensure consistency
-- ============================================================

-- Set any plans without explicit status to 'active' if they are the only plan for that user
-- or 'paused' if there are multiple plans for a user
DO $$
DECLARE
  v_user_id uuid;
  v_plan_count integer;
BEGIN
  FOR v_user_id IN 
    SELECT DISTINCT user_id FROM public.plans
  LOOP
    -- Count plans for this user
    SELECT COUNT(*) INTO v_plan_count
    FROM public.plans
    WHERE user_id = v_user_id;
    
    -- If user has only one plan, ensure it's active
    IF v_plan_count = 1 THEN
      UPDATE public.plans
      SET status = 'active'
      WHERE user_id = v_user_id
        AND (status IS NULL OR status = 'paused');
    ELSE
      -- If user has multiple plans, ensure only one is active
      -- Keep the most recent plan as active, set others to paused
      UPDATE public.plans
      SET status = 'paused'
      WHERE user_id = v_user_id
        AND id NOT IN (
          SELECT id FROM public.plans
          WHERE user_id = v_user_id
          ORDER BY created_at DESC
          LIMIT 1
        );
      
      -- Ensure the most recent plan is active
      UPDATE public.plans
      SET status = 'active'
      WHERE user_id = v_user_id
        AND id = (
          SELECT id FROM public.plans
          WHERE user_id = v_user_id
          ORDER BY created_at DESC
          LIMIT 1
        );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- Verification
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✓ archived_at column added to plans table';
  RAISE NOTICE '✓ Unique index created: idx_one_active_plan_per_user';
  RAISE NOTICE '✓ RPC function created: switch_active_plan()';
  RAISE NOTICE '✓ RPC function created: archive_plan()';
  RAISE NOTICE '✓ RPC function created: get_user_plans()';
  RAISE NOTICE '✓ Existing plans updated to ensure one active plan per user';
  RAISE NOTICE '';
  RAISE NOTICE 'Multiple plans support is now enabled!';
  RAISE NOTICE 'Users can now create and manage multiple plans with one active plan at a time.';
END $$;







