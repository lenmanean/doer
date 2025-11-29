-- Fix RLS policies for calendar_sync_logs to allow INSERT and UPDATE
-- The table currently only has SELECT policy, preventing sync logs from being created

DO $$
BEGIN
  -- Add INSERT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_sync_logs' 
      AND policyname = 'Users can insert their sync logs'
  ) THEN
    CREATE POLICY "Users can insert their sync logs"
      ON public.calendar_sync_logs
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Add UPDATE policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calendar_sync_logs' 
      AND policyname = 'Users can update their sync logs'
  ) THEN
    CREATE POLICY "Users can update their sync logs"
      ON public.calendar_sync_logs
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Grant INSERT and UPDATE permissions to authenticated role
GRANT INSERT, UPDATE ON public.calendar_sync_logs TO authenticated;

COMMENT ON POLICY "Users can insert their sync logs" ON public.calendar_sync_logs IS 'Allows authenticated users to create sync log entries for their own calendar connections';
COMMENT ON POLICY "Users can update their sync logs" ON public.calendar_sync_logs IS 'Allows authenticated users to update their own sync log entries';

