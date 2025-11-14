-- Migration: Remove legacy table references from delete/reset helpers

CREATE OR REPLACE FUNCTION public.delete_plan_data(target_user_id uuid, target_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Delete in correct order
  DELETE FROM task_completions WHERE plan_id = target_plan_id AND user_id = target_user_id;
  DELETE FROM task_schedule WHERE plan_id = target_plan_id;
  DELETE FROM tasks WHERE plan_id = target_plan_id;
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
$function$;

COMMENT ON FUNCTION public.delete_plan_data IS 
  'Safely deletes a plan and all related data (tasks, completions, schedule) in correct order. Legacy tables have been removed.';


CREATE OR REPLACE FUNCTION public.reset_user_data(target_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Delete task_schedule
  DELETE FROM task_schedule WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{task_schedule}', to_jsonb(temp_count))::json;

  -- Delete tasks
  DELETE FROM tasks WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{tasks}', to_jsonb(temp_count))::json;

  -- Delete onboarding_responses
  DELETE FROM onboarding_responses WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{onboarding_responses}', to_jsonb(temp_count))::json;

  -- Delete plans
  DELETE FROM plans WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{plans}', to_jsonb(temp_count))::json;

  -- Delete scheduling_history
  DELETE FROM scheduling_history WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{scheduling_history}', to_jsonb(temp_count))::json;

  -- Delete health_snapshots
  DELETE FROM health_snapshots WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{health_snapshots}', to_jsonb(temp_count))::json;

  -- Delete pending_reschedules
  DELETE FROM pending_reschedules WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{pending_reschedules}', to_jsonb(temp_count))::json;

  RETURN deleted_counts;
END;
$function$;

COMMENT ON FUNCTION public.reset_user_data IS 
  'Resets all user data. Legacy tables (user_progress, analytics_snapshots, milestones) have been removed.';

