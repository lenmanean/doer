-- Migration: Expand allowed task_schedule statuses to match application logic
ALTER TABLE public.task_schedule
  DROP CONSTRAINT IF EXISTS task_schedule_status_check;

ALTER TABLE public.task_schedule
  ADD CONSTRAINT task_schedule_status_check
  CHECK (
    status IS NULL OR status IN (
      'scheduled',
      'completed',
      'cancelled',
      'rescheduled',
      'overdue',
      'pending_reschedule',
      'rescheduling'
    )
  );

COMMENT ON CONSTRAINT task_schedule_status_check ON public.task_schedule IS
  'Ensures task schedule status stays within the supported lifecycle states used by the scheduler.';

