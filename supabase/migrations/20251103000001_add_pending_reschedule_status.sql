-- Update task_schedule to support pending reschedule workflow
-- Adds pending_reschedule_id column and updates status constraint

-- ============================================================================
-- 1. Add pending_reschedule_id column to task_schedule
-- ============================================================================

ALTER TABLE "public"."task_schedule"
ADD COLUMN IF NOT EXISTS "pending_reschedule_id" uuid REFERENCES "public"."pending_reschedules"("id") ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN "public"."task_schedule"."pending_reschedule_id" IS 'Reference to pending reschedule proposal awaiting user approval';

-- ============================================================================
-- 2. Update status check constraint to include 'pending_reschedule'
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE "public"."task_schedule"
DROP CONSTRAINT IF EXISTS "task_schedule_status_check";

-- Add new constraint with 'pending_reschedule' status
ALTER TABLE "public"."task_schedule"
ADD CONSTRAINT "task_schedule_status_check" 
  CHECK ("status" IN ('scheduled', 'overdue', 'pending_reschedule', 'rescheduling', 'rescheduled'));

-- Update comment
COMMENT ON COLUMN "public"."task_schedule"."status" IS 'Task scheduling status: scheduled (normal), overdue (passed end_time), pending_reschedule (awaiting user approval), rescheduling (in process), rescheduled (completed rescheduling)';

-- ============================================================================
-- 3. Create index for pending_reschedule_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_task_schedule_pending_reschedule" 
  ON "public"."task_schedule"("pending_reschedule_id") 
  WHERE "pending_reschedule_id" IS NOT NULL;
















