-- Migration: Convert existing calendar events to tasks in integration plans
-- This migration creates integration plans for existing calendar connections
-- and converts existing calendar_events to tasks

DO $$
DECLARE
  connection_record RECORD;
  plan_record RECORD;
  event_record RECORD;
  task_record RECORD;
  schedule_record RECORD;
  plan_id_val uuid;
  task_id_val uuid;
  schedule_id_val uuid;
  next_idx integer;
  event_date date;
  day_index_val integer;
  start_time_str time;
  end_time_str time;
  duration_minutes_val integer;
  calendar_names_array text[];
BEGIN
  -- Loop through all calendar connections
  FOR connection_record IN 
    SELECT id, user_id, provider, selected_calendar_ids
    FROM public.calendar_connections
    WHERE selected_calendar_ids IS NOT NULL 
      AND array_length(selected_calendar_ids, 1) > 0
  LOOP
    -- Check if integration plan already exists for this connection
    SELECT id INTO plan_record
    FROM public.plans
    WHERE plan_type = 'integration'
      AND integration_metadata->>'connection_id' = connection_record.id::text
      AND status = 'active'
    LIMIT 1;

    -- Create integration plan if it doesn't exist
    IF plan_record IS NULL THEN
      -- Get calendar names (we'll use IDs as names if we can't fetch them)
      -- For migration, we'll use a generic name
      calendar_names_array := ARRAY[]::text[];
      FOR i IN 1..array_length(connection_record.selected_calendar_ids, 1) LOOP
        calendar_names_array := calendar_names_array || COALESCE(connection_record.selected_calendar_ids[i], 'Calendar ' || i::text);
      END LOOP;

      INSERT INTO public.plans (
        user_id,
        goal_text,
        plan_type,
        start_date,
        end_date,
        status,
        integration_metadata,
        summary_data
      ) VALUES (
        connection_record.user_id,
        CASE 
          WHEN connection_record.provider = 'google' THEN 'Google Calendar - ' || COALESCE(calendar_names_array[1], 'Primary')
          WHEN connection_record.provider = 'outlook' THEN 'Microsoft Outlook - ' || COALESCE(calendar_names_array[1], 'Primary')
          WHEN connection_record.provider = 'apple' THEN 'Apple Calendar - ' || COALESCE(calendar_names_array[1], 'Primary')
          ELSE 'Calendar Integration - ' || COALESCE(calendar_names_array[1], 'Primary')
        END,
        'integration',
        CURRENT_DATE,
        NULL,
        'active',
        jsonb_build_object(
          'connection_id', connection_record.id::text,
          'provider', connection_record.provider,
          'calendar_ids', connection_record.selected_calendar_ids,
          'calendar_names', calendar_names_array
        ),
        jsonb_build_object(
          'provider', connection_record.provider,
          'calendar_count', array_length(connection_record.selected_calendar_ids, 1)
        )
      )
      RETURNING id INTO plan_id_val;

      RAISE NOTICE 'Created integration plan % for connection %', plan_id_val, connection_record.id;
    ELSE
      plan_id_val := plan_record.id;
      RAISE NOTICE 'Using existing integration plan % for connection %', plan_id_val, connection_record.id;
    END IF;

    -- Get max idx for tasks in this plan
    SELECT COALESCE(MAX(idx), 0) INTO next_idx
    FROM public.tasks
    WHERE plan_id = plan_id_val;

    next_idx := next_idx + 1;

    -- Convert calendar events to tasks
    FOR event_record IN
      SELECT 
        ce.id as event_id,
        ce.user_id,
        ce.summary,
        ce.description,
        ce.start_time,
        ce.end_time,
        ce.external_event_id,
        ce.calendar_id
      FROM public.calendar_events ce
      WHERE ce.calendar_connection_id = connection_record.id
        AND ce.is_busy = true
        AND ce.is_doer_created = false
        AND ce.start_time IS NOT NULL
        AND ce.end_time IS NOT NULL
      ORDER BY ce.start_time
    LOOP
      -- Calculate date and day_index
      event_date := DATE(event_record.start_time);
      
      -- Get plan start date for day_index calculation
      SELECT start_date INTO plan_record
      FROM public.plans
      WHERE id = plan_id_val;

      day_index_val := event_date - plan_record.start_date;

      -- Calculate duration
      duration_minutes_val := EXTRACT(EPOCH FROM (event_record.end_time - event_record.start_time)) / 60;
      duration_minutes_val := GREATEST(duration_minutes_val, 5); -- Minimum 5 minutes

      -- Format times
      start_time_str := event_record.start_time::time;
      end_time_str := event_record.end_time::time;

      -- Check if task already exists for this calendar event
      SELECT id INTO task_record
      FROM public.tasks
      WHERE calendar_event_id = event_record.event_id
        AND plan_id = plan_id_val
      LIMIT 1;

      IF task_record IS NULL THEN
        -- Create new task
        INSERT INTO public.tasks (
          plan_id,
          user_id,
          idx,
          name,
          details,
          estimated_duration_minutes,
          priority,
          is_calendar_event,
          calendar_event_id,
          is_detached
        ) VALUES (
          plan_id_val,
          event_record.user_id,
          next_idx,
          COALESCE(event_record.summary, 'Untitled Event'),
          event_record.description,
          duration_minutes_val,
          3, -- Default to medium priority
          true,
          event_record.event_id,
          false
        )
        RETURNING id INTO task_id_val;

        next_idx := next_idx + 1;

        -- Create task schedule
        INSERT INTO public.task_schedule (
          plan_id,
          user_id,
          task_id,
          date,
          day_index,
          start_time,
          end_time,
          duration_minutes,
          status
        ) VALUES (
          plan_id_val,
          event_record.user_id,
          task_id_val,
          event_date,
          day_index_val,
          start_time_str::text,
          end_time_str::text,
          duration_minutes_val,
          'scheduled'
        )
        RETURNING id INTO schedule_id_val;

        -- Create calendar event link if it doesn't exist
        INSERT INTO public.calendar_event_links (
          user_id,
          calendar_connection_id,
          calendar_event_id,
          plan_id,
          task_id,
          external_event_id,
          task_name,
          metadata
        ) VALUES (
          event_record.user_id,
          connection_record.id,
          event_record.event_id,
          plan_id_val,
          task_id_val,
          event_record.external_event_id,
          COALESCE(event_record.summary, 'Untitled Event'),
          jsonb_build_object('migrated', true)
        )
        ON CONFLICT (calendar_event_id, task_schedule_id) DO NOTHING;

        RAISE NOTICE 'Created task % and schedule % for calendar event %', task_id_val, schedule_id_val, event_record.event_id;
      ELSE
        RAISE NOTICE 'Task already exists for calendar event %, skipping', event_record.event_id;
      END IF;
    END LOOP;

    RAISE NOTICE 'Completed migration for connection %', connection_record.id;
  END LOOP;

  RAISE NOTICE 'Migration completed successfully';
END $$;

