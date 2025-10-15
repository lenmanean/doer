-- Migration: Fix Task Completions Duplicates
-- Purpose: Add UNIQUE constraint to prevent duplicate completion records
-- Date: 2025-10-11
-- Issue: task_completions table was missing UNIQUE constraint, causing upsert to fail and create duplicates

-- ============================================================
-- Step 1: Remove duplicate completion records (keep oldest)
-- ============================================================

-- Find and delete duplicate task completions, keeping only the first completion for each (user_id, task_id, scheduled_date)
DELETE FROM public.task_completions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, task_id, scheduled_date) id
  FROM public.task_completions
  ORDER BY user_id, task_id, scheduled_date, completed_at ASC
);

-- Log cleanup results
DO $$
DECLARE
  deleted_count INT;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % duplicate task completion records', deleted_count;
END $$;

-- ============================================================
-- Step 2: Add UNIQUE constraint to prevent future duplicates
-- ============================================================

-- Add UNIQUE constraint on (user_id, task_id, scheduled_date)
-- This ensures one completion record per user per task per scheduled date
ALTER TABLE public.task_completions
ADD CONSTRAINT task_completions_unique_completion
UNIQUE (user_id, task_id, scheduled_date);

COMMENT ON CONSTRAINT task_completions_unique_completion ON public.task_completions IS
'Ensures only one completion record exists per user per task per scheduled date. Enables proper upsert operations.';

-- ============================================================
-- Verification
-- ============================================================

-- Verify no duplicates remain
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT user_id, task_id, scheduled_date, COUNT(*) as cnt
    FROM public.task_completions
    GROUP BY user_id, task_id, scheduled_date
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Still found % groups of duplicates after cleanup!', duplicate_count;
  ELSE
    RAISE NOTICE '✓ No duplicates found, constraint applied successfully';
  END IF;
END $$;



