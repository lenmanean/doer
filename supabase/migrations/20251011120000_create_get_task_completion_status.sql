-- Migration: Create get_task_completion_status RPC function
-- Purpose: Restore roadmap-client.ts functionality by providing task completion status for a specific date
-- Date: 2025-10-11

CREATE OR REPLACE FUNCTION public.get_task_completion_status(
  p_user_id uuid,
  p_plan_id uuid,
  p_date date
)
RETURNS TABLE(task_id uuid, is_completed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ts.task_id,
    EXISTS (
      SELECT 1 FROM public.task_completions tc
      WHERE tc.user_id = p_user_id
        AND tc.task_id = ts.task_id
        AND tc.plan_id = p_plan_id
        AND tc.scheduled_date = p_date
    ) AS is_completed
  FROM public.task_schedule ts
  WHERE ts.plan_id = p_plan_id
    AND ts.date = p_date;
END;
$$;

COMMENT ON FUNCTION public.get_task_completion_status IS 
'Returns task completion status for all tasks scheduled on a specific date';



