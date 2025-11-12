-- Migration: Add database-level validation constraints
-- These constraints ensure data integrity at the database level
-- Prevents invalid data from being inserted even if application logic fails

-- ============================================================================
-- ADD CONSTRAINTS TO PLANS TABLE
-- ============================================================================

-- Drop existing constraints if they exist to allow rerunning migration
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_timeline_days_check;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_date_order_check;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_status_check;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_type_check;

-- Ensure timeline_days is within acceptable range (1-21 days)
ALTER TABLE public.plans
ADD CONSTRAINT plans_timeline_days_check 
CHECK (
  (summary_data->>'total_duration_days')::integer IS NULL OR
  ((summary_data->>'total_duration_days')::integer BETWEEN 1 AND 21)
);

-- Ensure start_date is not after end_date
ALTER TABLE public.plans
ADD CONSTRAINT plans_date_order_check 
CHECK (start_date <= end_date);

-- Ensure status is valid
ALTER TABLE public.plans
ADD CONSTRAINT plans_status_check
CHECK (status IN ('active', 'paused', 'completed', 'archived'));

-- Ensure plan_type is valid
ALTER TABLE public.plans
ADD CONSTRAINT plans_type_check
CHECK (plan_type IN ('ai', 'manual'));

-- ============================================================================
-- ADD CONSTRAINTS TO TASKS TABLE
-- ============================================================================

-- Drop existing constraints if they exist to allow rerunning migration
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_duration_check;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_idx_positive_check;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_name_not_empty_check;

-- Ensure estimated_duration_minutes is within reasonable range (5-360 minutes = 6 hours max)
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_duration_check 
CHECK (estimated_duration_minutes BETWEEN 5 AND 360);

-- Ensure priority is valid (1=Critical, 2=High, 3=Medium, 4=Low)
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_priority_check 
CHECK (priority IN (1, 2, 3, 4));

-- Ensure idx is positive
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_idx_positive_check 
CHECK (idx > 0);

-- Ensure name is not empty
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_name_not_empty_check 
CHECK (trim(name) != '');

-- ============================================================================
-- ADD CONSTRAINTS TO TASK_SCHEDULE TABLE
-- ============================================================================

-- Drop existing constraints if they exist to allow rerunning migration
ALTER TABLE public.task_schedule DROP CONSTRAINT IF EXISTS task_schedule_day_index_check;
ALTER TABLE public.task_schedule DROP CONSTRAINT IF EXISTS task_schedule_duration_check;
ALTER TABLE public.task_schedule DROP CONSTRAINT IF EXISTS task_schedule_time_order_check;
ALTER TABLE public.task_schedule DROP CONSTRAINT IF EXISTS task_schedule_status_check;

-- Ensure day_index is non-negative
ALTER TABLE public.task_schedule
ADD CONSTRAINT task_schedule_day_index_check 
CHECK (day_index >= 0);

-- Ensure duration_minutes is positive if specified
ALTER TABLE public.task_schedule
ADD CONSTRAINT task_schedule_duration_check 
CHECK (duration_minutes IS NULL OR duration_minutes > 0);

-- Ensure start_time is before end_time if both specified
ALTER TABLE public.task_schedule
ADD CONSTRAINT task_schedule_time_order_check 
CHECK (
  start_time IS NULL OR 
  end_time IS NULL OR 
  start_time < end_time
);

-- Ensure status is valid
ALTER TABLE public.task_schedule
ADD CONSTRAINT task_schedule_status_check
CHECK (
  status IS NULL OR 
  status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')
);

-- ============================================================================
-- ADD CONSTRAINTS TO USER_SETTINGS TABLE
-- ============================================================================

-- Drop existing constraints if they exist to allow rerunning migration
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_workday_hours_check;
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_lunch_hours_check;
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_time_format_check;

-- Ensure workday hours are logical
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_workday_hours_check
CHECK (
  (preferences->>'workday_start_hour')::integer IS NULL OR
  (preferences->>'workday_end_hour')::integer IS NULL OR
  (
    (preferences->>'workday_start_hour')::integer >= 0 AND
    (preferences->>'workday_start_hour')::integer <= 23 AND
    (preferences->>'workday_end_hour')::integer >= 1 AND
    (preferences->>'workday_end_hour')::integer <= 24 AND
    (preferences->>'workday_start_hour')::integer < (preferences->>'workday_end_hour')::integer
  )
);

-- Ensure lunch hours are logical
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_lunch_hours_check
CHECK (
  (preferences->>'lunch_start_hour')::integer IS NULL OR
  (preferences->>'lunch_end_hour')::integer IS NULL OR
  (
    (preferences->>'lunch_start_hour')::integer >= 0 AND
    (preferences->>'lunch_start_hour')::integer <= 23 AND
    (preferences->>'lunch_end_hour')::integer >= 1 AND
    (preferences->>'lunch_end_hour')::integer <= 24 AND
    (preferences->>'lunch_start_hour')::integer < (preferences->>'lunch_end_hour')::integer
  )
);

-- Ensure time_format is valid
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_time_format_check
CHECK (
  (preferences->>'time_format') IS NULL OR
  (preferences->>'time_format') IN ('12h', '24h')
);

-- ============================================================================
-- ADD INDEXES FOR IMPROVED QUERY PERFORMANCE
-- ============================================================================

-- Index for finding active plans efficiently
CREATE INDEX IF NOT EXISTS idx_plans_user_status ON public.plans(user_id, status) WHERE status = 'active';

-- Index for task priority queries
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(plan_id, priority);

-- Index for schedule date range queries
CREATE INDEX IF NOT EXISTS idx_task_schedule_date_range ON public.task_schedule(user_id, date);

-- Index for finding pending schedules
CREATE INDEX IF NOT EXISTS idx_task_schedule_status ON public.task_schedule(user_id, status) WHERE status = 'scheduled';

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON CONSTRAINT plans_timeline_days_check ON public.plans IS 
  'Ensures timeline is between 1-21 days to maintain quality and prevent scope creep';

COMMENT ON CONSTRAINT tasks_duration_check ON public.tasks IS 
  'Ensures task durations are realistic: 5 min minimum, 6 hours maximum';

COMMENT ON CONSTRAINT tasks_priority_check ON public.tasks IS 
  'Ensures priority is valid: 1=Critical, 2=High, 3=Medium, 4=Low';

COMMENT ON CONSTRAINT task_schedule_time_order_check ON public.task_schedule IS 
  'Ensures start_time is before end_time for logical time blocks';


-- Prevents invalid data from being inserted even if application logic fails

-- ============================================================================
-- ADD CONSTRAINTS TO PLANS TABLE
-- ============================================================================

-- Drop existing constraints if they exist to allow rerunning migration
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_timeline_days_check;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_date_order_check;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_status_check;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_type_check;

-- Ensure timeline_days is within acceptable range (1-21 days)
ALTER TABLE public.plans
ADD CONSTRAINT plans_timeline_days_check 
CHECK (
  (summary_data->>'total_duration_days')::integer IS NULL OR
  ((summary_data->>'total_duration_days')::integer BETWEEN 1 AND 21)
);

-- Ensure start_date is not after end_date
ALTER TABLE public.plans
ADD CONSTRAINT plans_date_order_check 
CHECK (start_date <= end_date);

-- Ensure status is valid
ALTER TABLE public.plans
ADD CONSTRAINT plans_status_check
CHECK (status IN ('active', 'paused', 'completed', 'archived'));

-- Ensure plan_type is valid
ALTER TABLE public.plans
ADD CONSTRAINT plans_type_check
CHECK (plan_type IN ('ai', 'manual'));

-- ============================================================================
-- ADD CONSTRAINTS TO TASKS TABLE
-- ============================================================================

-- Drop existing constraints if they exist to allow rerunning migration
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_duration_check;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_idx_positive_check;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_name_not_empty_check;

-- Ensure estimated_duration_minutes is within reasonable range (5-360 minutes = 6 hours max)
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_duration_check 
CHECK (estimated_duration_minutes BETWEEN 5 AND 360);

-- Ensure priority is valid (1=Critical, 2=High, 3=Medium, 4=Low)
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_priority_check 
CHECK (priority IN (1, 2, 3, 4));

-- Ensure idx is positive
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_idx_positive_check 
CHECK (idx > 0);

-- Ensure name is not empty
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_name_not_empty_check 
CHECK (trim(name) != '');

-- ============================================================================
-- ADD CONSTRAINTS TO TASK_SCHEDULE TABLE
-- ============================================================================

-- Drop existing constraints if they exist to allow rerunning migration
ALTER TABLE public.task_schedule DROP CONSTRAINT IF EXISTS task_schedule_day_index_check;
ALTER TABLE public.task_schedule DROP CONSTRAINT IF EXISTS task_schedule_duration_check;
ALTER TABLE public.task_schedule DROP CONSTRAINT IF EXISTS task_schedule_time_order_check;
ALTER TABLE public.task_schedule DROP CONSTRAINT IF EXISTS task_schedule_status_check;

-- Ensure day_index is non-negative
ALTER TABLE public.task_schedule
ADD CONSTRAINT task_schedule_day_index_check 
CHECK (day_index >= 0);

-- Ensure duration_minutes is positive if specified
ALTER TABLE public.task_schedule
ADD CONSTRAINT task_schedule_duration_check 
CHECK (duration_minutes IS NULL OR duration_minutes > 0);

-- Ensure start_time is before end_time if both specified
ALTER TABLE public.task_schedule
ADD CONSTRAINT task_schedule_time_order_check 
CHECK (
  start_time IS NULL OR 
  end_time IS NULL OR 
  start_time < end_time
);

-- Ensure status is valid
ALTER TABLE public.task_schedule
ADD CONSTRAINT task_schedule_status_check
CHECK (
  status IS NULL OR 
  status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')
);

-- ============================================================================
-- ADD CONSTRAINTS TO USER_SETTINGS TABLE
-- ============================================================================

-- Drop existing constraints if they exist to allow rerunning migration
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_workday_hours_check;
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_lunch_hours_check;
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_time_format_check;

-- Ensure workday hours are logical
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_workday_hours_check
CHECK (
  (preferences->>'workday_start_hour')::integer IS NULL OR
  (preferences->>'workday_end_hour')::integer IS NULL OR
  (
    (preferences->>'workday_start_hour')::integer >= 0 AND
    (preferences->>'workday_start_hour')::integer <= 23 AND
    (preferences->>'workday_end_hour')::integer >= 1 AND
    (preferences->>'workday_end_hour')::integer <= 24 AND
    (preferences->>'workday_start_hour')::integer < (preferences->>'workday_end_hour')::integer
  )
);

-- Ensure lunch hours are logical
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_lunch_hours_check
CHECK (
  (preferences->>'lunch_start_hour')::integer IS NULL OR
  (preferences->>'lunch_end_hour')::integer IS NULL OR
  (
    (preferences->>'lunch_start_hour')::integer >= 0 AND
    (preferences->>'lunch_start_hour')::integer <= 23 AND
    (preferences->>'lunch_end_hour')::integer >= 1 AND
    (preferences->>'lunch_end_hour')::integer <= 24 AND
    (preferences->>'lunch_start_hour')::integer < (preferences->>'lunch_end_hour')::integer
  )
);

-- Ensure time_format is valid
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_time_format_check
CHECK (
  (preferences->>'time_format') IS NULL OR
  (preferences->>'time_format') IN ('12h', '24h')
);

-- ============================================================================
-- ADD INDEXES FOR IMPROVED QUERY PERFORMANCE
-- ============================================================================

-- Index for finding active plans efficiently
CREATE INDEX IF NOT EXISTS idx_plans_user_status ON public.plans(user_id, status) WHERE status = 'active';

-- Index for task priority queries
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(plan_id, priority);

-- Index for schedule date range queries
CREATE INDEX IF NOT EXISTS idx_task_schedule_date_range ON public.task_schedule(user_id, date);

-- Index for finding pending schedules
CREATE INDEX IF NOT EXISTS idx_task_schedule_status ON public.task_schedule(user_id, status) WHERE status = 'scheduled';

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON CONSTRAINT plans_timeline_days_check ON public.plans IS 
  'Ensures timeline is between 1-21 days to maintain quality and prevent scope creep';

COMMENT ON CONSTRAINT tasks_duration_check ON public.tasks IS 
  'Ensures task durations are realistic: 5 min minimum, 6 hours maximum';

COMMENT ON CONSTRAINT tasks_priority_check ON public.tasks IS 
  'Ensures priority is valid: 1=Critical, 2=High, 3=Medium, 4=Low';

COMMENT ON CONSTRAINT task_schedule_time_order_check ON public.task_schedule IS 
  'Ensures start_time is before end_time for logical time blocks';



