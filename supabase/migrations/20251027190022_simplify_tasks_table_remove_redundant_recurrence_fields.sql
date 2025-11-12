-- Simplify tasks table by removing redundant recurrence fields
-- Keep only essential recurrence information

-- Remove redundant recurrence fields
ALTER TABLE "public"."tasks" 
DROP COLUMN IF EXISTS "recurrence_pattern",
DROP COLUMN IF EXISTS "recurrence_days", 
DROP COLUMN IF EXISTS "recurrence_interval",
DROP COLUMN IF EXISTS "recurrence_end_date",
DROP COLUMN IF EXISTS "recurrence_start_date";

-- Keep only essential fields:
-- - is_recurring (boolean): indicates if task is recurring
-- - is_indefinite (boolean): indicates if recurring task has no end date
-- - assigned_to_plan (boolean): indicates if task is part of a plan

COMMENT ON COLUMN "public"."tasks"."is_recurring" IS 'Indicates if this task repeats on a schedule';
COMMENT ON COLUMN "public"."tasks"."is_indefinite" IS 'For recurring tasks, indicates if they continue indefinitely';
COMMENT ON COLUMN "public"."tasks"."assigned_to_plan" IS 'Indicates if this task is part of a specific plan';



