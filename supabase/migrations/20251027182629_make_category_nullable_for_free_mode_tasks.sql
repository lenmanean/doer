-- Make category nullable for free-mode tasks
-- Free-mode tasks should have category: null since they're not part of structured plans

-- Make category nullable
ALTER TABLE "public"."tasks" 
ALTER COLUMN "category" DROP NOT NULL;

-- Update existing free-mode tasks (plan_id is null) to have category: null
UPDATE "public"."tasks" 
SET "category" = NULL 
WHERE "plan_id" IS NULL;

-- Add comment for the updated field
COMMENT ON COLUMN "public"."tasks"."category" IS 'Priority/difficulty category: A (hard difficulty, high priority), B (medium difficulty, medium priority), C (easy difficulty, low priority). NULL for free-mode tasks not associated with a plan.';



