-- Add default start/end time columns to tasks for indefinite recurrence synthesis
-- Up
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'default_start_time'
    ) THEN
        ALTER TABLE public.tasks
        ADD COLUMN default_start_time time without time zone;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'default_end_time'
    ) THEN
        ALTER TABLE public.tasks
        ADD COLUMN default_end_time time without time zone;
    END IF;
END $$;

-- Down
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'default_end_time'
    ) THEN
        ALTER TABLE public.tasks
        DROP COLUMN default_end_time;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'default_start_time'
    ) THEN
        ALTER TABLE public.tasks
        DROP COLUMN default_start_time;
    END IF;
END $$;

























