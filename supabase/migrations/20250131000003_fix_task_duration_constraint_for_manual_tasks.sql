-- Fix task duration constraint to properly separate manual tasks, calendar events, and AI tasks
-- This migration restores the intended separation that was overwritten by intermediate migrations
--
-- Migration History Context:
-- - 20250101000000_allow_long_durations_for_manual_tasks.sql: Had correct logic allowing manual tasks unlimited duration
-- - 20251111000001_add_plan_validation_constraints.sql: Overwrote constraint with simple 5-360 minute limit for ALL tasks
-- - 20251230000002_allow_long_durations_for_calendar_events.sql: Only restored exception for calendar events, NOT manual tasks
--
-- This migration fixes the constraint to properly allow:
-- - Manual tasks (plan_id = null, is_calendar_event = false): minimum 5 minutes, no maximum
-- - Calendar events (is_calendar_event = true): minimum 5 minutes, no maximum
-- - AI-generated tasks (plan_id != null): 5-360 minutes (6 hours max)
--
-- This enables cross-day manual tasks (e.g., 9-hour sleep task from 9 PM to 6 AM) while
-- maintaining the 6-hour limit for AI-generated tasks to ensure consistent plan generation.

-- Drop existing constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_duration_check;

-- Add new constraint that properly separates task types
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_duration_check 
CHECK (
  estimated_duration_minutes >= 5 AND
  (
    COALESCE(is_calendar_event, false) = true OR
    plan_id IS NULL OR
    estimated_duration_minutes <= 360
  )
);

COMMENT ON CONSTRAINT tasks_duration_check ON public.tasks IS 
'Duration must be at least 5 minutes. Manual tasks (plan_id = null) and calendar events can be any length. AI-generated tasks (plan_id != null) are limited to 360 minutes (6 hours). This separation allows cross-day manual tasks (e.g., sleep schedules) while maintaining consistent AI plan generation.';

