-- Migration: add calendar connection events logging
-- Logs connection lifecycle events for audit, debugging, and analytics

-- ENUM DEFINITION ----------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.calendar_connection_event_type AS ENUM (
    'connected',
    'disconnected',
    'token_refreshed',
    'token_refresh_failed',
    'token_expired',
    'settings_changed',
    'oauth_failed',
    'reconnected',
    'calendar_selected',
    'calendar_deselected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CALENDAR CONNECTION EVENTS TABLE ----------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_connection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_connection_id uuid REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  event_type public.calendar_connection_event_type NOT NULL,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb, -- Store relevant context (settings changed, error messages, etc.)
  ip_address inet, -- For security tracking
  user_agent text, -- For debugging
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS calendar_connection_events_user_idx
  ON public.calendar_connection_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS calendar_connection_events_connection_idx
  ON public.calendar_connection_events (calendar_connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS calendar_connection_events_type_idx
  ON public.calendar_connection_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS calendar_connection_events_created_at_idx
  ON public.calendar_connection_events (created_at DESC);

-- Row Level Security
ALTER TABLE public.calendar_connection_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_connection_events' 
      AND policyname = 'Users can view their connection events'
  ) THEN
    CREATE POLICY "Users can view their connection events"
      ON public.calendar_connection_events
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Authenticated users can insert their own connection events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_connection_events' 
      AND policyname = 'Users can insert their own connection events'
  ) THEN
    CREATE POLICY "Users can insert their own connection events"
      ON public.calendar_connection_events
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Grants
GRANT ALL ON public.calendar_connection_events TO postgres;
GRANT ALL ON public.calendar_connection_events TO service_role;
GRANT SELECT, INSERT ON public.calendar_connection_events TO authenticated;

-- Helper function to get recent connection events for a user
CREATE OR REPLACE FUNCTION public.get_recent_connection_events(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_event_type public.calendar_connection_event_type DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  calendar_connection_id uuid,
  event_type public.calendar_connection_event_type,
  event_details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT 
    cce.id,
    cce.calendar_connection_id,
    cce.event_type,
    cce.event_details,
    cce.ip_address,
    cce.user_agent,
    cce.created_at
  FROM public.calendar_connection_events cce
  WHERE cce.user_id = p_user_id
    AND (p_event_type IS NULL OR cce.event_type = p_event_type)
  ORDER BY cce.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON TABLE public.calendar_connection_events IS 'Logs calendar connection lifecycle events for audit, debugging, and analytics';
COMMENT ON COLUMN public.calendar_connection_events.event_details IS 'JSON object containing relevant context: changed settings, error messages, OAuth errors, etc.';
COMMENT ON COLUMN public.calendar_connection_events.ip_address IS 'IP address of the user when the event occurred (for security tracking)';
COMMENT ON COLUMN public.calendar_connection_events.user_agent IS 'User agent string for debugging connection issues';

