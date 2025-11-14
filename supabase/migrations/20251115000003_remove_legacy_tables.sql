-- Migration: Remove legacy tables that are no longer used
-- Removes: user_progress, analytics_snapshots, milestones
-- Updates delete functions to remove references to these tables

-- ============================================================================
-- UPDATE DELETE FUNCTIONS
-- ============================================================================

-- Update delete_plan_data function to remove milestones deletion
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
  -- milestones removed - table no longer exists
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
  'Safely deletes a plan and all related data (tasks, completions, schedule) in correct order. 
   Legacy tables (milestones, user_progress, analytics_snapshots) have been removed.';

-- Update reset_user_data function to remove legacy table deletions
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

  -- user_progress removed - table no longer exists

  -- analytics_snapshots removed - table no longer exists

  -- Delete task_schedule
  DELETE FROM task_schedule WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{task_schedule}', to_jsonb(temp_count))::json;

  -- Delete tasks
  DELETE FROM tasks WHERE user_id = target_user_id;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts::jsonb, '{tasks}', to_jsonb(temp_count))::json;

  -- milestones removed - table no longer exists

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

-- Update get_user_tables function to remove legacy table references
CREATE OR REPLACE FUNCTION public.get_user_tables()
 RETURNS TABLE(table_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT c.table_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name = 'user_id'
    -- Exclude legacy tables that no longer exist
    AND c.table_name NOT IN ('user_progress', 'analytics_snapshots', 'milestones')
  ORDER BY 
    -- Order by foreign key dependencies (most dependent first)
    CASE c.table_name
      WHEN 'task_completions' THEN 1
      WHEN 'task_schedule' THEN 2
      WHEN 'tasks' THEN 3
      WHEN 'onboarding_responses' THEN 4
      WHEN 'plans' THEN 5
      ELSE 99  -- New tables go last by default
    END;
END;
$function$;

COMMENT ON FUNCTION public.get_user_tables IS 
  'Returns all user tables. Legacy tables (user_progress, analytics_snapshots, milestones) excluded.';

-- ============================================================================
-- DROP LEGACY TABLES
-- ============================================================================

-- Drop tables in order (check if they exist first to avoid errors)
DO $$
BEGIN
  -- Drop milestones table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'milestones') THEN
    DROP TABLE IF EXISTS public.milestones CASCADE;
    RAISE NOTICE 'Dropped table: milestones';
  END IF;

  -- Drop analytics_snapshots table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_snapshots') THEN
    DROP TABLE IF EXISTS public.analytics_snapshots CASCADE;
    RAISE NOTICE 'Dropped table: analytics_snapshots';
  END IF;

  -- Drop user_progress table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_progress') THEN
    DROP TABLE IF EXISTS public.user_progress CASCADE;
    RAISE NOTICE 'Dropped table: user_progress';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables are dropped
DO $$
DECLARE
  table_count integer;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('user_progress', 'analytics_snapshots', 'milestones');
  
  IF table_count > 0 THEN
    RAISE WARNING 'Some legacy tables still exist. Count: %', table_count;
  ELSE
    RAISE NOTICE 'All legacy tables successfully removed.';
  END IF;
END $$;


