-- Add indefinite recurring task fields to the tasks table
ALTER TABLE public.tasks
ADD COLUMN is_indefinite BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN recurrence_start_date DATE;

-- Add check constraints for the new fields
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_recurrence_start_date_check
CHECK (
    (recurrence_start_date IS NULL) OR
    (recurrence_start_date IS NOT NULL AND recurrence_start_date >= '2020-01-01')
);

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_recurrence_end_date_check
CHECK (
    (recurrence_end_date IS NULL) OR
    (recurrence_end_date IS NOT NULL AND recurrence_end_date >= '2020-01-01')
);

-- Add constraint to ensure end date is after start date when both are provided
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_recurrence_date_range_check
CHECK (
    (recurrence_start_date IS NULL OR recurrence_end_date IS NULL) OR
    (recurrence_start_date IS NOT NULL AND recurrence_end_date IS NOT NULL AND recurrence_end_date >= recurrence_start_date)
);

-- Add constraint to ensure indefinite tasks don't have end dates
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_indefinite_no_end_date_check
CHECK (
    (is_indefinite = FALSE) OR
    (is_indefinite = TRUE AND recurrence_end_date IS NULL)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS tasks_is_indefinite_idx ON public.tasks (is_indefinite);
CREATE INDEX IF NOT EXISTS tasks_recurrence_start_date_idx ON public.tasks (recurrence_start_date);
CREATE INDEX IF NOT EXISTS tasks_recurrence_end_date_idx ON public.tasks (recurrence_end_date);

-- Add comments for documentation
COMMENT ON COLUMN public.tasks.is_indefinite IS 'Whether the recurring task should repeat indefinitely';
COMMENT ON COLUMN public.tasks.recurrence_start_date IS 'Start date for recurring task range (NULL for indefinite)';
COMMENT ON COLUMN public.tasks.recurrence_end_date IS 'End date for recurring task range (NULL for indefinite)';
