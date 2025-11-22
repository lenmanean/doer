-- Migration: add Google Calendar bidirectional sync infrastructure
-- Generated for DOER Calendar Integration

-- ENUM DEFINITIONS ----------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.calendar_provider AS ENUM ('google', 'outlook', 'apple');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.calendar_sync_type AS ENUM ('pull', 'push', 'full_sync');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.calendar_sync_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CALENDAR CONNECTIONS -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider public.calendar_provider NOT NULL DEFAULT 'google',
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  sync_token text, -- Google Calendar incremental sync token
  selected_calendar_ids text[] NOT NULL DEFAULT ARRAY[]::text[], -- Array of calendar IDs to sync
  auto_sync_enabled boolean NOT NULL DEFAULT false, -- Auto-pull from Google Calendar
  auto_push_enabled boolean NOT NULL DEFAULT false, -- Auto-push DOER tasks to Google Calendar
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS calendar_connections_user_idx
  ON public.calendar_connections (user_id, provider);

CREATE INDEX IF NOT EXISTS calendar_connections_provider_idx
  ON public.calendar_connections (provider, auto_sync_enabled);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_connections' 
      AND policyname = 'Users manage own calendar connections'
  ) THEN
    CREATE POLICY "Users manage own calendar connections"
      ON public.calendar_connections
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

GRANT ALL ON public.calendar_connections TO postgres;
GRANT ALL ON public.calendar_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO authenticated;

-- CALENDAR EVENTS ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_connection_id uuid NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  external_event_id text NOT NULL, -- Google Calendar event ID
  calendar_id text NOT NULL, -- Google Calendar ID (from selected_calendar_ids)
  summary text,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  timezone text,
  is_busy boolean NOT NULL DEFAULT true, -- True if event blocks availability
  is_doer_created boolean NOT NULL DEFAULT false, -- True if DOER created this event
  external_etag text, -- Google Calendar etag for conflict detection
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, -- Store any additional metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_connection_id, external_event_id, calendar_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_user_idx
  ON public.calendar_events (user_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS calendar_events_connection_idx
  ON public.calendar_events (calendar_connection_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS calendar_events_busy_slots_idx
  ON public.calendar_events (user_id, start_time, end_time)
  WHERE is_busy = true;

CREATE INDEX IF NOT EXISTS calendar_events_plan_overlap_idx
  ON public.calendar_events (user_id, start_time, end_time, is_doer_created);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_events' 
      AND policyname = 'Users can view their calendar events'
  ) THEN
    CREATE POLICY "Users can view their calendar events"
      ON public.calendar_events
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_events' 
      AND policyname = 'Users can manage their calendar events'
  ) THEN
    CREATE POLICY "Users can manage their calendar events"
      ON public.calendar_events
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

GRANT ALL ON public.calendar_events TO postgres;
GRANT ALL ON public.calendar_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;

-- CALENDAR EVENT LINKS -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_connection_id uuid NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  calendar_event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  task_schedule_id uuid REFERENCES public.task_schedule(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  external_event_id text NOT NULL, -- Google Calendar event ID for quick lookup
  ai_confidence numeric(3, 2), -- AI confidence score (0.00-1.00)
  plan_name text,
  task_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, -- Store extended properties from Google
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_event_id, task_schedule_id) -- One link per event-schedule pair
);

CREATE INDEX IF NOT EXISTS calendar_event_links_user_idx
  ON public.calendar_event_links (user_id, plan_id);

CREATE INDEX IF NOT EXISTS calendar_event_links_schedule_idx
  ON public.calendar_event_links (task_schedule_id) WHERE task_schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calendar_event_links_plan_idx
  ON public.calendar_event_links (plan_id) WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calendar_event_links_external_event_idx
  ON public.calendar_event_links (calendar_connection_id, external_event_id);

ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_event_links' 
      AND policyname = 'Users can view their calendar event links'
  ) THEN
    CREATE POLICY "Users can view their calendar event links"
      ON public.calendar_event_links
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_event_links' 
      AND policyname = 'Users can manage their calendar event links'
  ) THEN
    CREATE POLICY "Users can manage their calendar event links"
      ON public.calendar_event_links
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

GRANT ALL ON public.calendar_event_links TO postgres;
GRANT ALL ON public.calendar_event_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_links TO authenticated;

-- CALENDAR SYNC LOGS -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_connection_id uuid NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  sync_type public.calendar_sync_type NOT NULL,
  status public.calendar_sync_status NOT NULL DEFAULT 'pending',
  changes_summary jsonb NOT NULL DEFAULT '{}'::jsonb, -- Summary of events pulled/pushed
  events_pulled integer DEFAULT 0,
  events_pushed integer DEFAULT 0,
  conflicts_detected integer DEFAULT 0,
  plans_affected uuid[], -- Array of plan IDs affected by sync
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_sync_logs_user_idx
  ON public.calendar_sync_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS calendar_sync_logs_connection_idx
  ON public.calendar_sync_logs (calendar_connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS calendar_sync_logs_status_idx
  ON public.calendar_sync_logs (status, created_at DESC);

ALTER TABLE public.calendar_sync_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_sync_logs' 
      AND policyname = 'Users can view their sync logs'
  ) THEN
    CREATE POLICY "Users can view their sync logs"
      ON public.calendar_sync_logs
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

GRANT ALL ON public.calendar_sync_logs TO postgres;
GRANT ALL ON public.calendar_sync_logs TO service_role;
GRANT SELECT ON public.calendar_sync_logs TO authenticated;

-- FUNCTIONS -----------------------------------------------------------------------

-- Function to fetch busy slots for a user within a date range
CREATE OR REPLACE FUNCTION public.get_busy_slots_for_user(
  p_user_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
) RETURNS TABLE (
  start_time timestamptz,
  end_time timestamptz,
  summary text,
  is_doer_created boolean,
  metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT 
    ce.start_time,
    ce.end_time,
    ce.summary,
    ce.is_doer_created,
    ce.metadata
  FROM public.calendar_events ce
  JOIN public.calendar_connections cc ON cc.id = ce.calendar_connection_id
  WHERE cc.user_id = p_user_id
    AND ce.is_busy = true
    AND ce.start_time < p_end_date
    AND ce.end_time > p_start_date
  ORDER BY ce.start_time;
$$;

-- Function to check for conflicting events with a plan
CREATE OR REPLACE FUNCTION public.check_calendar_conflicts_for_plan(
  p_user_id uuid,
  p_plan_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS TABLE (
  conflict_date date,
  conflict_count integer,
  conflicting_events jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.date as conflict_date,
    COUNT(DISTINCT ce.id)::integer as conflict_count,
    jsonb_agg(
      jsonb_build_object(
        'event_id', ce.id,
        'summary', ce.summary,
        'start_time', ce.start_time,
        'end_time', ce.end_time,
        'is_doer_created', ce.is_doer_created
      )
    ) as conflicting_events
  FROM public.task_schedule ts
  JOIN public.calendar_events ce ON (
    ce.user_id = p_user_id
    AND ce.is_busy = true
    AND ts.date >= p_start_date
    AND ts.date <= p_end_date
    AND ts.start_time IS NOT NULL
    AND ts.end_time IS NOT NULL
    -- Check for time overlap
    AND (
      (ce.start_time::date = ts.date AND ce.start_time::time < ts.end_time::time AND ce.end_time::time > ts.start_time::time)
      OR (ce.end_time::date = ts.date AND ce.end_time::time > ts.start_time::time AND ce.start_time::time < ts.end_time::time)
      OR (ce.start_time::date < ts.date AND ce.end_time::date > ts.date)
    )
  )
  WHERE ts.plan_id = p_plan_id
  GROUP BY ts.date
  HAVING COUNT(DISTINCT ce.id) > 0;
END;
$$;

-- Function to update connection's last_sync_at timestamp
CREATE OR REPLACE FUNCTION public.update_calendar_connection_sync_time(
  p_connection_id uuid,
  p_sync_token text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.calendar_connections
  SET 
    last_sync_at = now(),
    sync_token = p_sync_token,
    updated_at = now()
  WHERE id = p_connection_id;
END;
$$;

-- Function to get recent sync logs for display
CREATE OR REPLACE FUNCTION public.get_recent_sync_logs(
  p_user_id uuid,
  p_limit integer DEFAULT 10
) RETURNS TABLE (
  id uuid,
  sync_type public.calendar_sync_type,
  status public.calendar_sync_status,
  changes_summary jsonb,
  events_pulled integer,
  events_pushed integer,
  conflicts_detected integer,
  plans_affected uuid[],
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT 
    csl.id,
    csl.sync_type,
    csl.status,
    csl.changes_summary,
    csl.events_pulled,
    csl.events_pushed,
    csl.conflicts_detected,
    csl.plans_affected,
    csl.error_message,
    csl.started_at,
    csl.completed_at,
    csl.created_at
  FROM public.calendar_sync_logs csl
  WHERE csl.user_id = p_user_id
  ORDER BY csl.created_at DESC
  LIMIT p_limit;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_event_links_updated_at
  BEFORE UPDATE ON public.calendar_event_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.calendar_connections IS 'Stores OAuth connections to calendar providers (Google, Outlook, Apple)';
COMMENT ON TABLE public.calendar_events IS 'Stores calendar events from external providers for busy slot detection';
COMMENT ON TABLE public.calendar_event_links IS 'Maps DOER task_schedule entries to Google Calendar events with AI metadata';
COMMENT ON TABLE public.calendar_sync_logs IS 'Logs sync operations for display in integrations UI';


