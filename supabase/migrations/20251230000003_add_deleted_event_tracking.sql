-- Add deleted event tracking to calendar_events and tasks tables
-- This allows us to track when events are deleted in Google Calendar
-- and keep them visible in DOER with appropriate indicators

-- Add columns to calendar_events table
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS is_deleted_in_calendar boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add column to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS is_deleted_in_calendar boolean NOT NULL DEFAULT false;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_is_deleted 
  ON public.calendar_events(is_deleted_in_calendar) 
  WHERE is_deleted_in_calendar = true;

CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted_in_calendar 
  ON public.tasks(is_deleted_in_calendar) 
  WHERE is_deleted_in_calendar = true;

-- Add comments for documentation
COMMENT ON COLUMN public.calendar_events.is_deleted_in_calendar IS 
  'True if this event was deleted in the external calendar (Google/Outlook/Apple). The event is kept in DOER for reference.';

COMMENT ON COLUMN public.calendar_events.deleted_at IS 
  'Timestamp when the event was deleted in the external calendar. NULL if not deleted.';

COMMENT ON COLUMN public.tasks.is_deleted_in_calendar IS 
  'True if the corresponding calendar event was deleted in the external calendar. The task is kept in DOER but marked as deleted.';

