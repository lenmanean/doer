-- Migration: Create usage_metric enum before any dependent objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'usage_metric'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.usage_metric AS ENUM (
      'api_credits',
      'integration_actions'
    );
  END IF;
END $$;

COMMENT ON TYPE public.usage_metric IS
  'Tracks which usage bucket a balance entry belongs to (API credits, integration actions, etc).';

