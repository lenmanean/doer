-- Add priority field to tasks table
-- This field indicates task priority (1-4) for better scheduling

-- Add the priority column to tasks table
ALTER TABLE "public"."tasks" 
ADD COLUMN "priority" integer CHECK ("priority" >= 1 AND "priority" <= 4);

-- Add comment for the new field
COMMENT ON COLUMN "public"."tasks"."priority" IS 'Task priority: 1=Critical (foundation/dependencies), 2=High (core functionality), 3=Medium (enhancements), 4=Low (polish/optional)';

-- Make priority NOT NULL for new tasks (existing tasks can be NULL temporarily)
-- We'll update this in a separate migration after we have data
































