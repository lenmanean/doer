-- Add back recurrence fields needed for the UI
-- These fields are used by the CreateTaskModal but stored in a simplified way

-- Add recurrence pattern field
ALTER TABLE "public"."tasks" 
ADD COLUMN "recurrence_pattern" TEXT NULL;

-- Add recurrence days field (array of integers for days of week)
ALTER TABLE "public"."tasks" 
ADD COLUMN "recurrence_days" INTEGER[] NULL;

-- Add recurrence start date field
ALTER TABLE "public"."tasks" 
ADD COLUMN "recurrence_start_date" DATE NULL;

-- Add recurrence end date field
ALTER TABLE "public"."tasks" 
ADD COLUMN "recurrence_end_date" DATE NULL;

-- Add comments for the fields
COMMENT ON COLUMN "public"."tasks"."recurrence_pattern" IS 'Pattern for recurring tasks (e.g., weekly, daily)';
COMMENT ON COLUMN "public"."tasks"."recurrence_days" IS 'Array of days of week (0=Sunday, 1=Monday, etc.) for recurring tasks';
COMMENT ON COLUMN "public"."tasks"."recurrence_start_date" IS 'Start date for recurring task range';
COMMENT ON COLUMN "public"."tasks"."recurrence_end_date" IS 'End date for recurring task range';



