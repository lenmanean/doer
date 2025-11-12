-- Make plan_id nullable in task_schedule table for free mode tasks
-- This allows tasks to exist independently of any specific plan

-- Make plan_id nullable in task_schedule table
ALTER TABLE "public"."task_schedule" 
ALTER COLUMN "plan_id" DROP NOT NULL;

-- Add comment for the updated field
COMMENT ON COLUMN "public"."task_schedule"."plan_id" IS 'Foreign key to plans table. Null for free-mode tasks not associated with a plan.';





