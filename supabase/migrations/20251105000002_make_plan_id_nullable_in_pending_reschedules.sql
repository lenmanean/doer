-- Make plan_id nullable in pending_reschedules table to support free-mode tasks
-- This allows reschedule proposals for tasks that aren't part of a plan

-- First, drop the foreign key constraint if it exists
-- Note: The constraint name might be auto-generated, so we'll check and drop it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%plan_id%' 
    AND table_name = 'pending_reschedules'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE "public"."pending_reschedules" 
    DROP CONSTRAINT IF EXISTS "pending_reschedules_plan_id_fkey";
  END IF;
END $$;

-- Make plan_id nullable
ALTER TABLE "public"."pending_reschedules" 
ALTER COLUMN "plan_id" DROP NOT NULL;

-- Recreate the foreign key constraint (allows NULL values)
-- PostgreSQL foreign keys allow NULL values by default
ALTER TABLE "public"."pending_reschedules"
ADD CONSTRAINT "pending_reschedules_plan_id_fkey" 
FOREIGN KEY ("plan_id") 
REFERENCES "public"."plans"("id") 
ON DELETE CASCADE;

-- Update the comment to clarify
COMMENT ON COLUMN "public"."pending_reschedules"."plan_id" IS 'Plan ID for plan-based tasks. NULL for free-mode tasks not associated with a plan.';

-- Update the index to handle NULL values (partial index for plan-based queries)
DROP INDEX IF EXISTS "idx_pending_reschedules_user_plan";
CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_user_plan" 
  ON "public"."pending_reschedules"("user_id", "plan_id")
  WHERE "plan_id" IS NOT NULL;

-- Add index for free-mode tasks
CREATE INDEX IF NOT EXISTS "idx_pending_reschedules_user_free_mode" 
  ON "public"."pending_reschedules"("user_id")
  WHERE "plan_id" IS NULL;

