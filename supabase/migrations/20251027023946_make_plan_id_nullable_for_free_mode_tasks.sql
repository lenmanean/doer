-- Make plan_id nullable in tasks table to support free mode tasks
-- This allows tasks to exist without being tied to a specific plan

-- Remove the NOT NULL constraint from plan_id
ALTER TABLE "public"."tasks" 
ALTER COLUMN "plan_id" DROP NOT NULL;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN "public"."tasks"."plan_id" IS 'Plan ID for tasks that belong to a specific plan. NULL for free mode tasks created in schedule view.';

-- Update the idx column comment to reflect that it's only relevant for plan-based tasks
COMMENT ON COLUMN "public"."tasks"."idx" IS 'Sequential order index for tasks within a plan. NULL for free mode tasks.';





