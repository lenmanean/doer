-- Migration: Remove Integration Plans and Associated Data
-- This migration deletes all integration plans and their associated tasks, schedules, and links
-- Users will need to re-sync their calendars after this migration

DO $$
DECLARE
  integration_plan_record RECORD;
  task_count integer;
  schedule_count integer;
  link_count integer;
BEGIN
  -- Log start
  RAISE NOTICE 'Starting migration to remove integration plans...';

  -- Loop through all integration plans
  FOR integration_plan_record IN 
    SELECT id, user_id, goal_text
    FROM public.plans
    WHERE plan_type = 'integration'
  LOOP
    -- Count associated data for logging
    SELECT COUNT(*) INTO task_count
    FROM public.tasks
    WHERE plan_id = integration_plan_record.id;
    
    SELECT COUNT(*) INTO schedule_count
    FROM public.task_schedule
    WHERE plan_id = integration_plan_record.id;
    
    SELECT COUNT(*) INTO link_count
    FROM public.calendar_event_links
    WHERE plan_id = integration_plan_record.id;

    RAISE NOTICE 'Deleting integration plan % (user: %): % tasks, % schedules, % links', 
      integration_plan_record.id, 
      integration_plan_record.user_id,
      task_count,
      schedule_count,
      link_count;

    -- Delete calendar event links
    DELETE FROM public.calendar_event_links
    WHERE plan_id = integration_plan_record.id;

    -- Delete task schedules
    DELETE FROM public.task_schedule
    WHERE plan_id = integration_plan_record.id;

    -- Delete tasks
    DELETE FROM public.tasks
    WHERE plan_id = integration_plan_record.id;

    -- Delete the plan
    DELETE FROM public.plans
    WHERE id = integration_plan_record.id;

    RAISE NOTICE 'Deleted integration plan %', integration_plan_record.id;
  END LOOP;

  RAISE NOTICE 'Migration completed: All integration plans and associated data have been removed.';
  RAISE NOTICE 'Users will need to re-sync their calendars to recreate calendar event tasks.';
END
$$;

-- Note: calendar_events table data is preserved
-- The calendar_events table stores the raw event data and is not tied to integration plans
-- New syncs will create tasks with plan_id = null and is_calendar_event = true

