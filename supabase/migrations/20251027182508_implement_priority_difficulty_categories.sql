-- Implement priority/difficulty categorization system (A/B/C)
-- Remove old milestone/parent task structure and replace with category system

-- Add category column for A/B/C classification
ALTER TABLE "public"."tasks" 
ADD COLUMN "category" text CHECK ("category" IN ('A', 'B', 'C'));

-- Add comment for the new field
COMMENT ON COLUMN "public"."tasks"."category" IS 'Priority/difficulty category: A (hard difficulty, high priority), B (medium difficulty, medium priority), C (easy difficulty, low priority)';

-- Remove old milestone/parent task columns
ALTER TABLE "public"."tasks" 
DROP COLUMN IF EXISTS "parent_task_id",
DROP COLUMN IF EXISTS "milestone_id";

-- Update existing tasks to have a default category (B for medium)
UPDATE "public"."tasks" 
SET "category" = 'B' 
WHERE "category" IS NULL;

-- Make category NOT NULL after setting defaults
ALTER TABLE "public"."tasks" 
ALTER COLUMN "category" SET NOT NULL;

-- Remove complexity_score column as it's replaced by category
ALTER TABLE "public"."tasks" 
DROP COLUMN IF EXISTS "complexity_score";



