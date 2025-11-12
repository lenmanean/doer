-- Add recurring task support to tasks table
-- This migration adds fields to support recurring tasks with different patterns

-- Add recurring task fields to tasks table
ALTER TABLE "public"."tasks" 
ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL,
ADD COLUMN "recurrence_pattern" text, -- 'daily', 'weekly', 'monthly'
ADD COLUMN "recurrence_days" integer[], -- Array of day numbers (0=Sunday, 1=Monday, etc.)
ADD COLUMN "recurrence_interval" integer DEFAULT 1, -- Every N days/weeks/months
ADD COLUMN "recurrence_end_date" date, -- When to stop recurring
ADD COLUMN "parent_task_id" uuid REFERENCES "public"."tasks"("id") ON DELETE CASCADE; -- For tracking recurring instances

-- Add index for recurring task queries
CREATE INDEX "idx_tasks_recurring" ON "public"."tasks"("is_recurring", "parent_task_id");

-- Add index for recurrence pattern queries
CREATE INDEX "idx_tasks_recurrence_pattern" ON "public"."tasks"("recurrence_pattern", "recurrence_days");

-- Add comment explaining the recurrence fields
COMMENT ON COLUMN "public"."tasks"."is_recurring" IS 'Whether this task repeats on a schedule';
COMMENT ON COLUMN "public"."tasks"."recurrence_pattern" IS 'Pattern: daily, weekly, or monthly';
COMMENT ON COLUMN "public"."tasks"."recurrence_days" IS 'Array of day numbers for weekly patterns (0=Sunday, 1=Monday, etc.)';
COMMENT ON COLUMN "public"."tasks"."recurrence_interval" IS 'Every N days/weeks/months (e.g., every 2 weeks)';
COMMENT ON COLUMN "public"."tasks"."recurrence_end_date" IS 'When to stop generating recurring instances';
COMMENT ON COLUMN "public"."tasks"."parent_task_id" IS 'Reference to the parent recurring task for generated instances';






