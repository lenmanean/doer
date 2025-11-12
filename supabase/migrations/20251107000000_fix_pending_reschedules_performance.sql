-- Fix performance issues for pending_reschedules table
-- 1. Add indexes for unindexed foreign keys
-- 2. Fix RLS policies to use subquery syntax for better performance

-- ============================================================================
-- 1. Add indexes for foreign keys
-- ============================================================================

-- Index for plan_id foreign key (nullable, but still needs index for lookups)
CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_plan_id" 
  ON "public"."pending_reschedules"("plan_id")
  WHERE "plan_id" IS NOT NULL;

-- Index for task_id foreign key
CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_task_id" 
  ON "public"."pending_reschedules"("task_id");

-- Index for reviewed_by_user_id foreign key (nullable, but still needs index for lookups)
CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_reviewed_by_user_id" 
  ON "public"."pending_reschedules"("reviewed_by_user_id")
  WHERE "reviewed_by_user_id" IS NOT NULL;

-- ============================================================================
-- 2. Fix RLS policies to use subquery syntax for better performance
-- This prevents re-evaluation of auth.uid() for each row
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own pending reschedules" ON "public"."pending_reschedules";
DROP POLICY IF EXISTS "Users can insert their own pending reschedules" ON "public"."pending_reschedules";
DROP POLICY IF EXISTS "Users can update their own pending reschedules" ON "public"."pending_reschedules";
DROP POLICY IF EXISTS "Users can delete their own pending reschedules" ON "public"."pending_reschedules";

-- Recreate policies with subquery syntax for better performance
CREATE POLICY "Users can view their own pending reschedules"
  ON "public"."pending_reschedules"
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own pending reschedules"
  ON "public"."pending_reschedules"
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own pending reschedules"
  ON "public"."pending_reschedules"
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own pending reschedules"
  ON "public"."pending_reschedules"
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);









