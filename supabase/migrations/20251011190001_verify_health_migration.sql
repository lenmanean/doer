-- Verification Queries for Health Migration
-- Run these in SQL Editor to verify the migration worked

-- ============================================================
-- 1. Check if v_plan_health view exists and has correct columns
-- ============================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'v_plan_health'
ORDER BY ordinal_position;

-- Expected columns:
-- plan_id, user_id, total_tasks, total_completions, tasks_scheduled_so_far,
-- has_scheduled_tasks, days_elapsed, health_score, progress, consistency, 
-- efficiency, late_completion_penalty, overdue_penalty, consistency_gap_penalty,
-- progress_lag_penalty, ontime_completion_bonus, early_completion_bonus, 
-- current_streak_days

-- ============================================================
-- 2. Check if get_plan_health_now function exists
-- ============================================================
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) as definition_preview
FROM pg_proc 
WHERE proname IN ('get_plan_health_now', 'get_vitality_now')
  AND pronamespace = 'public'::regnamespace;

-- Expected: Both functions should be listed

-- ============================================================
-- 3. Test the view with actual data (if you have an active plan)
-- ============================================================
SELECT 
  plan_id,
  health_score,
  has_scheduled_tasks,
  progress,
  consistency,
  efficiency,
  total_tasks,
  total_completions,
  current_streak_days
FROM public.v_plan_health
LIMIT 5;

-- Expected: Should return your plan(s) with health metrics
-- health_score should be 0-100
-- has_scheduled_tasks should be true/false

-- ============================================================
-- 4. Test the RPC function (replace with your actual user_id and plan_id)
-- ============================================================
-- First, get your user_id and plan_id:
SELECT 
  id as user_id,
  (SELECT id FROM public.plans WHERE user_id = auth.users.id AND status = 'active' LIMIT 1) as plan_id
FROM auth.users
WHERE email = current_setting('request.jwt.claims', true)::json->>'email';

-- Then test the function (replace the UUIDs with your actual values):
-- SELECT * FROM get_vitality_now(
--   'your-user-id'::uuid,
--   'your-plan-id'::uuid
-- );

-- Expected: JSON object with vitality_score, has_scheduled_tasks, progress, etc.

-- ============================================================
-- 5. Check specific health score calculation
-- ============================================================
SELECT 
  plan_id,
  health_score,
  -- Penalties (negative numbers)
  late_completion_penalty,
  overdue_penalty,
  consistency_gap_penalty,
  progress_lag_penalty,
  -- Bonuses (positive numbers)
  ontime_completion_bonus,
  early_completion_bonus,
  current_streak_days as streak_bonus,
  -- Calculation breakdown
  (100 + 
    COALESCE(late_completion_penalty, 0) + 
    COALESCE(overdue_penalty, 0) + 
    COALESCE(consistency_gap_penalty, 0) + 
    COALESCE(progress_lag_penalty, 0) + 
    COALESCE(ontime_completion_bonus, 0) + 
    COALESCE(early_completion_bonus, 0) + 
    COALESCE(current_streak_days, 0)
  ) as calculated_score
FROM public.v_plan_health;

-- This shows the health score breakdown and verifies the calculation

-- ============================================================
-- SUMMARY
-- ============================================================
-- If all queries return results without errors, the migration was successful!


