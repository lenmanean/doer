-- Remove recurrence pattern field since all recurring tasks are weekly by default
-- in a weekly schedule view

ALTER TABLE "public"."tasks" 
DROP COLUMN IF EXISTS "recurrence_pattern";

COMMENT ON COLUMN "public"."tasks"."is_recurring" IS 'Indicates if this task repeats weekly (all recurring tasks are weekly in weekly schedule view)';



