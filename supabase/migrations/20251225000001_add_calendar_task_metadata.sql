-- Migration: Add calendar event metadata to tasks table
-- This allows tasks to be linked to calendar events and tracked for sync purposes

-- Add is_calendar_event column to mark tasks that came from calendar events
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS is_calendar_event boolean NOT NULL DEFAULT false;

-- Add calendar_event_id to link task to calendar_events table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL;

-- Add is_detached column to mark tasks that have been edited by user
-- Detached tasks won't be overwritten by calendar sync
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS is_detached boolean NOT NULL DEFAULT false;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tasks_calendar_event_id 
  ON public.tasks(calendar_event_id) 
  WHERE calendar_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_is_calendar_event 
  ON public.tasks(is_calendar_event) 
  WHERE is_calendar_event = true;

CREATE INDEX IF NOT EXISTS idx_tasks_is_detached 
  ON public.tasks(is_detached) 
  WHERE is_detached = true;

-- Add comments for documentation
COMMENT ON COLUMN public.tasks.is_calendar_event IS 
  'True if this task was created from a calendar event (Google Calendar, Outlook, etc.)';

COMMENT ON COLUMN public.tasks.calendar_event_id IS 
  'Reference to calendar_events table. NULL if task is not from a calendar event or has been detached.';

COMMENT ON COLUMN public.tasks.is_detached IS 
  'True if user has edited this calendar event task. Detached tasks are not overwritten by calendar sync.';

