-- Add pending reschedules table for user-approval workflow
-- This migration creates a table to store reschedule proposals that require user approval

-- ============================================================================
-- 1. Create pending_reschedules table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."pending_reschedules" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "plan_id" uuid NOT NULL REFERENCES "public"."plans"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "task_schedule_id" uuid NOT NULL REFERENCES "public"."task_schedule"("id") ON DELETE CASCADE,
  "task_id" uuid NOT NULL REFERENCES "public"."tasks"("id") ON DELETE CASCADE,
  "proposed_date" date NOT NULL,
  "proposed_start_time" time without time zone NOT NULL,
  "proposed_end_time" time without time zone NOT NULL,
  "proposed_day_index" integer NOT NULL,
  "original_date" date NOT NULL,
  "original_start_time" time without time zone,
  "original_end_time" time without time zone,
  "original_day_index" integer NOT NULL,
  "context_score" numeric,
  "priority_penalty" numeric,
  "density_penalty" numeric,
  "reason" text DEFAULT 'auto_reschedule_overdue',
  "status" text DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'rejected')),
  "created_at" timestamp with time zone DEFAULT now(),
  "reviewed_at" timestamp with time zone,
  "reviewed_by_user_id" uuid REFERENCES "auth"."users"("id")
);

-- Add comments
COMMENT ON TABLE "public"."pending_reschedules" IS 'Stores reschedule proposals that require user approval before being applied';
COMMENT ON COLUMN "public"."pending_reschedules"."status" IS 'Status: pending (awaiting approval), accepted (applied), rejected (user declined)';
COMMENT ON COLUMN "public"."pending_reschedules"."context_score" IS 'Score indicating how well the proposed slot fits the task context';

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_user_plan" 
  ON "public"."pending_reschedules"("user_id", "plan_id");

CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_status" 
  ON "public"."pending_reschedules"("status") 
  WHERE "status" = 'pending';

CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_task_schedule" 
  ON "public"."pending_reschedules"("task_schedule_id");

CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_created_at" 
  ON "public"."pending_reschedules"("created_at" DESC);

-- ============================================================================
-- 3. Enable RLS and create policies
-- ============================================================================

ALTER TABLE "public"."pending_reschedules" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own pending reschedules
CREATE POLICY "Users can view their own pending reschedules"
  ON "public"."pending_reschedules"
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own pending reschedules (system will do this)
CREATE POLICY "Users can insert their own pending reschedules"
  ON "public"."pending_reschedules"
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own pending reschedules (for accept/reject)
CREATE POLICY "Users can update their own pending reschedules"
  ON "public"."pending_reschedules"
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own pending reschedules
CREATE POLICY "Users can delete their own pending reschedules"
  ON "public"."pending_reschedules"
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Grant permissions
-- ============================================================================

GRANT ALL ON "public"."pending_reschedules" TO authenticated;
GRANT ALL ON "public"."pending_reschedules" TO service_role;




















