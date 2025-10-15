-- Migration: Verification Queries
-- Purpose: Verify all database function and trigger updates are correctly applied
-- Date: 2025-10-11
-- NOTE: This file contains verification queries for manual testing

-- ============================================================
-- 1. Verify get_task_completion_status RPC exists
-- ============================================================
SELECT 
  proname AS function_name,
  pronargs AS num_args,
  pg_get_function_result(oid) AS return_type,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc 
WHERE proname = 'get_task_completion_status'
  AND pronamespace = 'public'::regnamespace;

-- Expected: 1 row showing function with 3 args (uuid, uuid, date)


-- ============================================================
-- 2. Check triggers on task_completions table
-- ============================================================
SELECT 
  tgname AS trigger_name,
  tgtype AS trigger_type,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger 
WHERE tgrelid = 'public.task_completions'::regclass
  AND tgname NOT LIKE 'RI_%';  -- Exclude system triggers

-- Expected: trg_fill_milestone_in_completion trigger present


-- ============================================================
-- 3. Verify unified realtime channel functions
-- ============================================================
SELECT 
  proname AS function_name,
  pg_get_function_result(oid) AS return_type,
  prosecdef AS security_definer
FROM pg_proc 
WHERE proname IN ('refresh_plan_state', 'notify_plan_update')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- Expected: 2 rows, both with security_definer = true


-- ============================================================
-- 4. Confirm legacy functions have been removed
-- ============================================================
SELECT 
  proname AS function_name,
  'SHOULD NOT EXIST' AS status
FROM pg_proc 
WHERE proname IN ('generate_daily_analytics_snapshots', 'update_analytics_snapshots')
  AND pronamespace = 'public'::regnamespace;

-- Expected: 0 rows (functions should be dropped)


-- ============================================================
-- 5. Confirm legacy tables have been removed
-- ============================================================
SELECT 
  tablename,
  'SHOULD NOT EXIST' AS status
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('analytics_snapshots', '_backup_analytics_snapshots');

-- Expected: 0 rows (tables should be dropped)


-- ============================================================
-- 6. Verify health view still works
-- ============================================================
SELECT 
  user_id,
  plan_id,
  progress,
  consistency,
  efficiency
FROM public.v_plan_health 
LIMIT 5;

-- Expected: Returns up to 5 rows of health metrics


-- ============================================================
-- 7. Test get_task_completion_status with real data
-- ============================================================
-- MANUAL TEST: Replace UUIDs with actual test data from your database
-- 
-- Example usage:
-- SELECT * FROM public.get_task_completion_status(
--   '<test_user_id>'::uuid, 
--   '<test_plan_id>'::uuid, 
--   CURRENT_DATE
-- );
--
-- Expected: Returns task_id and is_completed boolean for each task scheduled today


-- ============================================================
-- 8. Verify get_vitality_now RPC exists and works
-- ============================================================
SELECT 
  proname AS function_name,
  pg_get_function_result(oid) AS return_type,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc 
WHERE proname = 'get_vitality_now'
  AND pronamespace = 'public'::regnamespace;

-- Expected: 1 row showing function returning json


-- ============================================================
-- Summary Query: All Critical Functions
-- ============================================================
SELECT 
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments,
  CASE 
    WHEN prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END AS security_mode
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'get_task_completion_status',
    'refresh_plan_state',
    'notify_plan_update',
    'auto_fill_milestone_in_completion',
    'get_vitality_now',
    'delete_plan_data',
    'reset_user_data'
  )
ORDER BY proname;

-- Expected: 7 functions listed



