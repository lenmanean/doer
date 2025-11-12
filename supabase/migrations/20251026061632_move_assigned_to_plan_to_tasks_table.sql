-- Move assigned_to_plan field from task_schedule to tasks table
-- This field indicates whether a task was created as part of a plan (true) or manually (false)

-- First, add the assigned_to_plan column to tasks table
ALTER TABLE "public"."tasks" 
ADD COLUMN "assigned_to_plan" boolean NOT NULL DEFAULT true;

-- Add comment for the new field
COMMENT ON COLUMN "public"."tasks"."assigned_to_plan" IS 'Indicates whether the task was created as part of a plan (true) or manually by the user (false)';

-- Update existing tasks to be marked as assigned to plan (since they were created via AI/plan generation)
UPDATE "public"."tasks" 
SET "assigned_to_plan" = true 
WHERE "assigned_to_plan" IS NULL;

-- Remove the assigned_to_plan column from task_schedule table
ALTER TABLE "public"."task_schedule" 
DROP COLUMN "assigned_to_plan";






