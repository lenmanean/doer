-- Migration: Add auto_push_enabled column if it doesn't exist
-- This ensures backward compatibility with existing calendar_connections tables

-- Add auto_push_enabled column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'calendar_connections' 
      AND column_name = 'auto_push_enabled'
  ) THEN
    ALTER TABLE public.calendar_connections
    ADD COLUMN auto_push_enabled boolean NOT NULL DEFAULT false;
    
    COMMENT ON COLUMN public.calendar_connections.auto_push_enabled IS 'Auto-push DOER tasks to calendar provider';
  END IF;
END
$$;

