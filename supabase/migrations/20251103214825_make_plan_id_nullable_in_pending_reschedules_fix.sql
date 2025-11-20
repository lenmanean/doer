-- Make plan_id nullable in pending_reschedules table to support free-mode tasks
-- PostgreSQL foreign keys allow NULL values by default, so we only need to drop NOT NULL

-- Make plan_id nullable (this will work even with the foreign key constraint)
ALTER TABLE "public"."pending_reschedules" 
ALTER COLUMN "plan_id" DROP NOT NULL;

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





















