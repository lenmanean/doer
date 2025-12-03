-- Make plan_id nullable in task_completions table for free mode tasks
-- This allows task completions to be recorded for free-mode tasks that don't have a plan_id

-- First, drop the foreign key constraint if it exists (we'll recreate it to allow NULL)
ALTER TABLE "public"."task_completions"
DROP CONSTRAINT IF EXISTS "task_completions_plan_id_fkey";

-- Make plan_id nullable in task_completions table
ALTER TABLE "public"."task_completions"
ALTER COLUMN "plan_id" DROP NOT NULL;

-- Recreate the foreign key constraint with NULL allowed
-- This allows plan_id to be NULL for free-mode tasks while still maintaining referential integrity for plan-based tasks
ALTER TABLE "public"."task_completions"
ADD CONSTRAINT "task_completions_plan_id_fkey" 
FOREIGN KEY ("plan_id") 
REFERENCES "public"."plans"("id") 
ON DELETE CASCADE;

-- Add comment for the updated field
COMMENT ON COLUMN "public"."task_completions"."plan_id" IS 'Plan ID for plan-based task completions. NULL for free-mode task completions not associated with a plan.';

