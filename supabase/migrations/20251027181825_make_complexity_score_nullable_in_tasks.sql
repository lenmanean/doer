-- Make complexity_score nullable in tasks table for free mode tasks
-- This allows free mode tasks to have null complexity scores since they're not part of a structured plan

-- Make complexity_score nullable in tasks table
ALTER TABLE "public"."tasks" 
ALTER COLUMN "complexity_score" DROP NOT NULL;

-- Add comment for the updated field
COMMENT ON COLUMN "public"."tasks"."complexity_score" IS 'Complexity score for tasks within a plan. NULL for free mode tasks not associated with a plan.';



