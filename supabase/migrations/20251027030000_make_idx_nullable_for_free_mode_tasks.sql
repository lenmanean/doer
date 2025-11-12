-- Make idx nullable in tasks table to support free mode tasks
-- This allows tasks to exist without being tied to a specific plan

-- Remove the NOT NULL constraint from idx
ALTER TABLE "public"."tasks" 
ALTER COLUMN "idx" DROP NOT NULL;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN "public"."tasks"."idx" IS 'Sequential order index for tasks within a plan. NULL for free mode tasks created in schedule view.';





