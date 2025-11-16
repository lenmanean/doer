-- Migration: Remove category column from tasks table
-- Categories (A/B/C) were replaced by priority (1-4) system and are no longer used

-- Drop the category column constraint first
ALTER TABLE "public"."tasks" 
DROP CONSTRAINT IF EXISTS "tasks_category_check";

-- Drop the category column
ALTER TABLE "public"."tasks" 
DROP COLUMN IF EXISTS "category";

-- Verify column is dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'category'
  ) THEN
    RAISE WARNING 'Category column still exists after drop attempt';
  ELSE
    RAISE NOTICE 'Category column successfully removed from tasks table';
  END IF;
END $$;

