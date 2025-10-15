-- Migration: Fix Task Completion Logic
-- Purpose: Fix multiple critical issues with task completion tracking
-- Date: 2025-10-11
-- 
-- Issues Fixed:
-- 1. Same task being completed with different scheduled_dates (Dashboard vs Roadmap)
-- 2. v_user_progress view counting duplicates and wrong totals
-- 3. UNIQUE constraint allowing same task with different dates

-- ============================================================
-- Step 1: Clean up invalid completion records
-- ============================================================

-- For each task, keep only the completion with the matching scheduled_date from task_schedule
-- Delete any completions that don't match the task's actual schedule
DELETE FROM public.task_completions tc
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.task_schedule ts
  WHERE ts.task_id = tc.task_id
    AND ts.plan_id = tc.plan_id
    AND ts.date = tc.scheduled_date
);

-- Log cleanup results
DO $$
DECLARE
  deleted_count INT;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % completion records with invalid scheduled_dates', deleted_count;
END $$;

-- ============================================================
-- Step 2: Update UNIQUE constraint to prevent wrong completions
-- ============================================================

-- Drop the old constraint that allowed same task with different dates
ALTER TABLE public.task_completions
DROP CONSTRAINT IF EXISTS task_completions_unique_completion;

-- Drop the new constraint if it exists (for idempotency)
ALTER TABLE public.task_completions
DROP CONSTRAINT IF EXISTS task_completions_unique_per_task_plan;

-- Add new constraint: one completion per task per plan (regardless of scheduled_date)
-- This ensures a task can only be completed once per plan
ALTER TABLE public.task_completions
ADD CONSTRAINT task_completions_unique_per_task_plan
UNIQUE (user_id, task_id, plan_id);

COMMENT ON CONSTRAINT task_completions_unique_per_task_plan ON public.task_completions IS
'Ensures only one completion record exists per task per plan, preventing same task from being marked complete with different scheduled dates.';

-- ============================================================
-- Step 3: Fix v_user_progress view definition
-- ============================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.v_user_progress CASCADE;

-- Recreate with correct counting logic
CREATE OR REPLACE VIEW public.v_user_progress AS
SELECT
  m.plan_id,
  m.user_id,
  m.id AS milestone_id,
  m.name AS milestone_name,
  m.idx AS idx,
  
  -- Count DISTINCT task_ids (not scheduled_date combinations)
  COUNT(DISTINCT t.id) AS total_tasks,
  
  -- Count DISTINCT completed task_ids
  COUNT(DISTINCT CASE WHEN tc.id IS NOT NULL THEN t.id ELSE NULL END) AS completed_tasks,
  
  -- Calculate completion percentage
  CASE
    WHEN COUNT(DISTINCT t.id) > 0 THEN
      ROUND((COUNT(DISTINCT CASE WHEN tc.id IS NOT NULL THEN t.id ELSE NULL END)::numeric / COUNT(DISTINCT t.id)::numeric) * 100, 2)
    ELSE 0
  END AS completion_percentage,
  
  -- Last updated timestamp
  COALESCE(MAX(tc.completed_at), m.created_at) AS last_updated

FROM public.milestones m
LEFT JOIN public.tasks t ON t.milestone_id = m.id AND t.category = 'milestone_task'
LEFT JOIN public.task_completions tc ON tc.task_id = t.id AND tc.plan_id = m.plan_id
GROUP BY m.id, m.plan_id, m.user_id, m.name, m.created_at, m.idx
ORDER BY m.idx;

COMMENT ON VIEW public.v_user_progress IS
'Milestone progress tracking view. Counts UNIQUE tasks per milestone, not schedule combinations. Updated 2025-10-11 to fix counting logic.';

-- ============================================================
-- Step 4: Verification
-- ============================================================

-- Verify no task has multiple completions in same plan
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT user_id, task_id, plan_id, COUNT(*) as cnt
    FROM public.task_completions
    GROUP BY user_id, task_id, plan_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Still found % task completion duplicates after cleanup!', duplicate_count;
  ELSE
    RAISE NOTICE '✓ No duplicates found, constraint applied successfully';
  END IF;
END $$;

-- Verify milestone task counts are correct
DO $$
DECLARE
  incorrect_count INT;
BEGIN
  SELECT COUNT(*)
  INTO incorrect_count
  FROM public.v_user_progress vup
  WHERE vup.total_tasks != (
    SELECT COUNT(DISTINCT t.id)
    FROM public.tasks t
    WHERE t.milestone_id = vup.milestone_id
      AND t.category = 'milestone_task'
  );
  
  IF incorrect_count > 0 THEN
    RAISE WARNING 'Found % milestones with incorrect task counts in view', incorrect_count;
  ELSE
    RAISE NOTICE '✓ All milestone task counts are accurate';
  END IF;
END $$;

-- Show summary of milestone progress after fix
SELECT 
  milestone_name,
  total_tasks,
  completed_tasks,
  completion_percentage || '%' as progress
FROM public.v_user_progress
ORDER BY idx;

