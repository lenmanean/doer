-- Migration: Add transaction-based function for applying schedule changes
-- This replaces the invalid client-side transaction RPC calls with a proper server-side transaction

CREATE OR REPLACE FUNCTION public.apply_schedule_changes_transaction(
  p_plan_id uuid,
  p_user_id uuid,
  p_new_end_date date,
  p_original_end_date date,
  p_task_adjustments jsonb,
  p_days_extended integer,
  p_reason jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_current_plan record;
  v_adjustment jsonb;
  v_old_end_date date;
BEGIN
  -- Start transaction (implicit in function)
  
  -- 1. Fetch current plan to check if original_end_date exists
  SELECT end_date, original_end_date
  INTO v_current_plan
  FROM public.plans
  WHERE id = p_plan_id AND user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'PLAN_NOT_FOUND', DETAIL = 'Plan not found or access denied.';
  END IF;
  
  -- Store old end date for history
  v_old_end_date := v_current_plan.end_date;
  
  -- 2. Update plan end date
  UPDATE public.plans
  SET 
    end_date = p_new_end_date,
    original_end_date = COALESCE(v_current_plan.original_end_date, v_old_end_date)
  WHERE id = p_plan_id AND user_id = p_user_id;
  
  -- 3. Update task schedules with time-block data
  FOR v_adjustment IN SELECT * FROM jsonb_array_elements(p_task_adjustments)
  LOOP
    UPDATE public.task_schedule
    SET 
      date = (v_adjustment->>'newDate')::date,
      rescheduled_from = (v_adjustment->>'oldDate')::date,
      start_time = CASE 
        WHEN v_adjustment->>'newStartTime' IS NOT NULL 
        THEN (v_adjustment->>'newStartTime')::time 
        ELSE start_time 
      END,
      end_time = CASE 
        WHEN v_adjustment->>'newEndTime' IS NOT NULL 
        THEN (v_adjustment->>'newEndTime')::time 
        ELSE end_time 
      END,
      duration_minutes = CASE 
        WHEN (v_adjustment->>'duration')::integer IS NOT NULL 
        THEN (v_adjustment->>'duration')::integer 
        ELSE duration_minutes 
      END
    WHERE task_id = (v_adjustment->>'taskId')::uuid
      AND plan_id = p_plan_id;
    
    IF NOT FOUND THEN
      RAISE WARNING 'Task schedule not found for task_id: %', v_adjustment->>'taskId';
    END IF;
  END LOOP;
  
  -- 4. Record in scheduling history
  INSERT INTO public.scheduling_history(
    user_id,
    plan_id,
    old_end_date,
    new_end_date,
    days_extended,
    tasks_rescheduled,
    milestones_adjusted,
    reason
  )
  VALUES (
    p_user_id,
    p_plan_id,
    COALESCE(
      (p_task_adjustments->0->>'oldDate')::date,
      v_old_end_date
    ),
    p_new_end_date,
    p_days_extended,
    jsonb_array_length(p_task_adjustments),
    0, -- Milestones removed from system
    p_reason
  );
  
  -- Transaction commits automatically on success
  RETURN true;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction rolls back automatically on exception
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.apply_schedule_changes_transaction IS
  'Atomically applies schedule changes including plan end date updates, task schedule adjustments, and history recording. Uses server-side transaction for data consistency.';

GRANT EXECUTE ON FUNCTION public.apply_schedule_changes_transaction(uuid, uuid, date, date, jsonb, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_schedule_changes_transaction(uuid, uuid, date, date, jsonb, integer, jsonb) TO authenticated;

