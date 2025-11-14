-- Touch tasks table to ensure PostgREST schema cache refreshes and picks up new columns
DO $$
BEGIN
  -- Ensure columns exist (idempotent safety)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'default_start_time'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN default_start_time time without time zone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'default_end_time'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN default_end_time time without time zone;
  END IF;

  -- Bump cache via comment change
  COMMENT ON TABLE public.tasks IS 'tasks table (cache touch 2025-10-30 12:30)';
END $$;




























