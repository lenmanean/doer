-- Allow longer durations for manual tasks
-- Manual tasks (plan_id = null, is_calendar_event = false) can be any length
-- Calendar events (is_calendar_event = true) can be any length
-- AI-generated tasks (plan_id != null) are limited to 6 hours (360 minutes)

-- Drop existing constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_duration_check;

-- Add new constraint that allows longer durations for manual tasks and calendar events
-- Manual tasks (plan_id = null, is_calendar_event = false): minimum 5 minutes, no maximum
-- Calendar events (is_calendar_event = true): minimum 5 minutes, no maximum
-- AI-generated tasks (plan_id != null): 5-360 minutes (6 hours max)
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
'Duration must be at least 5 minutes. Manual tasks (plan_id = null) and calendar events can be any length. AI-generated tasks (plan_id != null) are limited to 360 minutes (6 hours).';

