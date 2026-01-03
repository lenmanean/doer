-- Migration: add Todoist (task management) integration infrastructure
-- Generated for DOER Task Management Integration

-- TASK MANAGEMENT CONNECTIONS -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.task_management_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'todoist', 'asana', 'trello', etc. (text to support future tools)
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text, -- Optional, depends on provider
  token_expires_at timestamptz,
  default_project_id text, -- Provider-specific project ID (e.g., Todoist project ID)
  auto_push_enabled boolean NOT NULL DEFAULT false, -- Auto-push DOER tasks to task management tool
  auto_completion_sync boolean NOT NULL DEFAULT false, -- Sync completion status bidirectionally
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS task_management_connections_user_idx
  ON public.task_management_connections (user_id, provider);

CREATE INDEX IF NOT EXISTS task_management_connections_provider_idx
  ON public.task_management_connections (provider, auto_push_enabled);

ALTER TABLE public.task_management_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'task_management_connections' 
      AND policyname = 'Users manage own task management connections'
  ) THEN
    CREATE POLICY "Users manage own task management connections"
      ON public.task_management_connections
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

GRANT ALL ON public.task_management_connections TO postgres;
GRANT ALL ON public.task_management_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_management_connections TO authenticated;

-- TASK MANAGEMENT LINKS ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.task_management_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.task_management_connections(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  task_schedule_id uuid REFERENCES public.task_schedule(id) ON DELETE SET NULL,
  external_task_id text NOT NULL, -- Provider-specific task ID (e.g., Todoist task ID)
  external_project_id text, -- Provider-specific project ID
  sync_status text NOT NULL DEFAULT 'synced', -- 'synced', 'pending', 'failed'
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, -- Store any additional metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_task_id) -- One link per connection-task pair
);

CREATE INDEX IF NOT EXISTS task_management_links_user_idx
  ON public.task_management_links (user_id, plan_id);

CREATE INDEX IF NOT EXISTS task_management_links_task_idx
  ON public.task_management_links (task_id);

CREATE INDEX IF NOT EXISTS task_management_links_schedule_idx
  ON public.task_management_links (task_schedule_id) WHERE task_schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS task_management_links_plan_idx
  ON public.task_management_links (plan_id) WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS task_management_links_connection_idx
  ON public.task_management_links (connection_id, external_task_id);

CREATE INDEX IF NOT EXISTS task_management_links_sync_status_idx
  ON public.task_management_links (sync_status, last_synced_at);

ALTER TABLE public.task_management_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'task_management_links' 
      AND policyname = 'Users can view their task management links'
  ) THEN
    CREATE POLICY "Users can view their task management links"
      ON public.task_management_links
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'task_management_links' 
      AND policyname = 'Users can manage their task management links'
  ) THEN
    CREATE POLICY "Users can manage their task management links"
      ON public.task_management_links
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

GRANT ALL ON public.task_management_links TO postgres;
GRANT ALL ON public.task_management_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_management_links TO authenticated;

-- TASK MANAGEMENT SYNC LOGS (Optional but recommended) --------------------------------

CREATE TABLE IF NOT EXISTS public.task_management_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.task_management_connections(id) ON DELETE CASCADE,
  sync_type text NOT NULL, -- 'push', 'update', 'complete', 'full_sync'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  changes_summary jsonb NOT NULL DEFAULT '{}'::jsonb, -- Summary of tasks pushed/updated
  tasks_pushed integer DEFAULT 0,
  tasks_updated integer DEFAULT 0,
  tasks_completed integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb, -- Array of error messages
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_management_sync_logs_user_idx
  ON public.task_management_sync_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS task_management_sync_logs_connection_idx
  ON public.task_management_sync_logs (connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS task_management_sync_logs_status_idx
  ON public.task_management_sync_logs (status, created_at DESC);

ALTER TABLE public.task_management_sync_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'task_management_sync_logs' 
      AND policyname = 'Users can view their sync logs'
  ) THEN
    CREATE POLICY "Users can view their sync logs"
      ON public.task_management_sync_logs
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

GRANT ALL ON public.task_management_sync_logs TO postgres;
GRANT ALL ON public.task_management_sync_logs TO service_role;
GRANT SELECT ON public.task_management_sync_logs TO authenticated;

-- TRIGGERS ----------------------------------------------------------------------------

-- Trigger to update updated_at timestamp for task_management_connections
CREATE OR REPLACE FUNCTION public.update_task_management_connections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_task_management_connections_updated_at ON public.task_management_connections;
CREATE TRIGGER update_task_management_connections_updated_at
  BEFORE UPDATE ON public.task_management_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_management_connections_updated_at();

-- Trigger to update updated_at timestamp for task_management_links
CREATE OR REPLACE FUNCTION public.update_task_management_links_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_task_management_links_updated_at ON public.task_management_links;
CREATE TRIGGER update_task_management_links_updated_at
  BEFORE UPDATE ON public.task_management_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_management_links_updated_at();

-- COMMENTS ----------------------------------------------------------------------------

COMMENT ON TABLE public.task_management_connections IS 'Stores OAuth connections to task management providers (Todoist, Asana, Trello, etc.)';
COMMENT ON TABLE public.task_management_links IS 'Links DOER tasks to external task management tasks';
COMMENT ON TABLE public.task_management_sync_logs IS 'Logs sync operations for task management integrations';

