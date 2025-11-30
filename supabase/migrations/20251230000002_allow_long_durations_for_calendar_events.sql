-- Allow longer durations for calendar events
-- Calendar events can be all-day or multi-day, so they need longer durations
-- Regular tasks should still be limited to 6 hours (360 minutes)

-- Drop existing constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_duration_check;

-- Add new constraint that allows longer durations for calendar events
-- Calendar events (is_calendar_event = true): minimum 5 minutes, no maximum
-- Regular tasks: 5-360 minutes (6 hours max)
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_duration_check 
CHECK (
  estimated_duration_minutes >= 5 AND
  (
    COALESCE(is_calendar_event, false) = true OR
    estimated_duration_minutes <= 360
  )
);

COMMENT ON CONSTRAINT tasks_duration_check ON public.tasks IS 
'Duration must be at least 5 minutes. Calendar events can be any length (all-day/multi-day). Regular tasks are limited to 360 minutes (6 hours).';

