-- Migration: add Notion integration infrastructure
-- Generated for DOER Notion Integration

-- NOTION CONNECTIONS -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notion_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id text NOT NULL, -- Notion workspace ID
  workspace_name text NOT NULL, -- Workspace name
  access_token_encrypted text NOT NULL, -- Encrypted OAuth access token
  token_expires_at timestamptz, -- Token expiration (if applicable)
  selected_page_ids text[] NOT NULL DEFAULT '{}', -- Pages to use as context
  selected_database_ids text[] NOT NULL DEFAULT '{}', -- Databases to use as context
  default_page_id text, -- Default page for plan exports
  default_database_id text, -- Default database for task sync (future)
  auto_context_enabled boolean NOT NULL DEFAULT true, -- Use Notion content as context
  auto_export_enabled boolean NOT NULL DEFAULT false, -- Auto-export plans to Notion
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb, -- Additional settings
  installed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS notion_connections_user_idx
  ON public.notion_connections (user_id, workspace_id);

CREATE INDEX IF NOT EXISTS notion_connections_workspace_idx
  ON public.notion_connections (workspace_id);

-- RLS
ALTER TABLE public.notion_connections ENABLE ROW LEVEL SECURITY;

-- Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'notion_connections' 
      AND policyname = 'Users manage own Notion connections'
  ) THEN
    CREATE POLICY "Users manage own Notion connections"
      ON public.notion_connections
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Grants
GRANT ALL ON public.notion_connections TO postgres;
GRANT ALL ON public.notion_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notion_connections TO authenticated;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_notion_connections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_notion_connections_updated_at ON public.notion_connections;
CREATE TRIGGER update_notion_connections_updated_at
  BEFORE UPDATE ON public.notion_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notion_connections_updated_at();

-- Comments
COMMENT ON TABLE public.notion_connections IS 'Stores OAuth connections to Notion workspaces for context reading and plan export';
COMMENT ON COLUMN public.notion_connections.selected_page_ids IS 'Array of Notion page IDs to use as context for AI plan generation';
COMMENT ON COLUMN public.notion_connections.selected_database_ids IS 'Array of Notion database IDs to use as context for AI plan generation';
COMMENT ON COLUMN public.notion_connections.preferences IS 'JSONB object with additional settings: { "export_template_id": "...", ... }';

-- NOTION PAGE LINKS (for tracking exported plans) ------------------------------------

CREATE TABLE IF NOT EXISTS public.notion_page_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.notion_connections(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  notion_page_id text NOT NULL, -- Notion page ID
  notion_database_id text, -- Optional database ID if using databases
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, notion_page_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS notion_page_links_user_idx
  ON public.notion_page_links (user_id);

CREATE INDEX IF NOT EXISTS notion_page_links_plan_idx
  ON public.notion_page_links (plan_id);

CREATE INDEX IF NOT EXISTS notion_page_links_connection_idx
  ON public.notion_page_links (connection_id);

-- RLS
ALTER TABLE public.notion_page_links ENABLE ROW LEVEL SECURITY;

-- Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'notion_page_links' 
      AND policyname = 'Users manage own Notion page links'
  ) THEN
    CREATE POLICY "Users manage own Notion page links"
      ON public.notion_page_links
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Grants
GRANT ALL ON public.notion_page_links TO postgres;
GRANT ALL ON public.notion_page_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notion_page_links TO authenticated;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_notion_page_links_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_notion_page_links_updated_at ON public.notion_page_links;
CREATE TRIGGER update_notion_page_links_updated_at
  BEFORE UPDATE ON public.notion_page_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notion_page_links_updated_at();

-- Comments
COMMENT ON TABLE public.notion_page_links IS 'Tracks exported DOER plans in Notion pages';
COMMENT ON COLUMN public.notion_page_links.notion_page_id IS 'Notion page ID where the plan is exported';

