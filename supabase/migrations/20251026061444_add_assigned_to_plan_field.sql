-- Add assigned_to_plan field to task_schedule table
-- This field indicates whether a task was created as part of a plan (true) or manually (false)

-- Add the assigned_to_plan column to task_schedule table
ALTER TABLE "public"."task_schedule" 
ADD COLUMN "assigned_to_plan" boolean NOT NULL DEFAULT false;

-- Add comment for the new field
COMMENT ON COLUMN "public"."task_schedule"."assigned_to_plan" IS 'Indicates whether the task was created as part of a plan (true) or manually by the user (false)';

-- Update existing tasks to be marked as assigned to plan (since they were created via AI/plan generation)
UPDATE "public"."task_schedule" 
SET "assigned_to_plan" = true 
WHERE "assigned_to_plan" IS NULL;






