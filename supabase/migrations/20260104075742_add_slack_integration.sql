-- Migration: add Slack integration infrastructure
-- Generated for DOER Slack Integration

-- SLACK CONNECTIONS -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.slack_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id text NOT NULL, -- Slack workspace ID
  team_name text NOT NULL, -- Workspace name
  bot_token_encrypted text NOT NULL, -- Encrypted bot token
  user_token_encrypted text, -- Encrypted user token (optional)
  bot_user_id text NOT NULL, -- Bot's user ID in workspace
  default_channel_id text, -- Default channel for notifications
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb, -- Notification settings
  scopes text[] NOT NULL DEFAULT '{}', -- OAuth scopes granted
  installed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);

CREATE INDEX IF NOT EXISTS slack_connections_user_idx
  ON public.slack_connections (user_id, team_id);

CREATE INDEX IF NOT EXISTS slack_connections_team_idx
  ON public.slack_connections (team_id);

ALTER TABLE public.slack_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'slack_connections' 
      AND policyname = 'Users manage own Slack connections'
  ) THEN
    CREATE POLICY "Users manage own Slack connections"
      ON public.slack_connections
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

GRANT ALL ON public.slack_connections TO postgres;
GRANT ALL ON public.slack_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slack_connections TO authenticated;

-- TRIGGERS --------------------------------------------------------------------------

-- Trigger to update updated_at timestamp for slack_connections
CREATE OR REPLACE FUNCTION public.update_slack_connections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_slack_connections_updated_at ON public.slack_connections;
CREATE TRIGGER update_slack_connections_updated_at
  BEFORE UPDATE ON public.slack_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_slack_connections_updated_at();

-- COMMENTS --------------------------------------------------------------------------

COMMENT ON TABLE public.slack_connections IS 'Stores OAuth connections to Slack workspaces for notifications and integrations';
COMMENT ON COLUMN public.slack_connections.notification_preferences IS 'JSONB object with notification settings: { "plan_generation": { "enabled": true, "channel": "C123456" }, ... }';
COMMENT ON COLUMN public.slack_connections.scopes IS 'Array of OAuth scopes granted to the app';

