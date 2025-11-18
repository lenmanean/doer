-- Fix Function Search Path Security Issues
-- Addresses Supabase linter warnings for functions with mutable search_path
-- 
-- Security: Functions with SECURITY DEFINER must set search_path to prevent
-- search path injection attacks. This ensures functions execute with a
-- predictable schema search path regardless of the caller's search_path setting.

-- ============================================================================
-- FIX delete_plan_data FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_plan_data(target_user_id uuid, target_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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

-- Preserve grants
GRANT ALL ON FUNCTION public.delete_plan_data(uuid, uuid) TO authenticated;

-- ============================================================================
-- FIX is_username_available FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_username_available(check_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.user_settings 
    WHERE LOWER(username) = LOWER(check_username)
  );
END;
$function$;

COMMENT ON FUNCTION public.is_username_available(TEXT) IS 
  'Checks if a username is available (case-insensitive check)';

-- Preserve grants
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO authenticated;

-- ============================================================================
-- FIX get_user_tables FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_tables()
 RETURNS TABLE(table_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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

-- Preserve grants
GRANT ALL ON FUNCTION public.get_user_tables() TO authenticated;

