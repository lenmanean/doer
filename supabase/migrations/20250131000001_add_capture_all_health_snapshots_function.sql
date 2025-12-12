-- Add function to capture health snapshots for all active plans
-- This function is called by the daily cron job via Edge Function

CREATE OR REPLACE FUNCTION public.capture_all_health_snapshots()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  plan_record RECORD;
  snapshot_result json;
  total_plans integer := 0;
  successful_snapshots integer := 0;
  failed_snapshots integer := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  -- Loop through all active plans
  FOR plan_record IN
    SELECT id, user_id
    FROM public.plans
    WHERE status = 'active'
    ORDER BY created_at ASC
  LOOP
    total_plans := total_plans + 1;
    
    BEGIN
      -- Capture snapshot for this plan
      snapshot_result := public.capture_health_snapshot(plan_record.user_id, plan_record.id);
      
      -- Check if snapshot was successful
      IF snapshot_result->>'success' = 'true' THEN
        successful_snapshots := successful_snapshots + 1;
      ELSE
        failed_snapshots := failed_snapshots + 1;
        errors := errors || jsonb_build_object(
          'plan_id', plan_record.id,
          'user_id', plan_record.user_id,
          'error', COALESCE(snapshot_result->>'error', 'Unknown error')
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      failed_snapshots := failed_snapshots + 1;
      errors := errors || jsonb_build_object(
        'plan_id', plan_record.id,
        'user_id', plan_record.user_id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Return summary
  RETURN json_build_object(
    'success', true,
    'total_plans', total_plans,
    'successful_snapshots', successful_snapshots,
    'failed_snapshots', failed_snapshots,
    'errors', errors,
    'timestamp', now()
  );
END;
$$;

COMMENT ON FUNCTION public.capture_all_health_snapshots() IS 'Captures health snapshots for all active plans. Called daily by cron job via Edge Function.';

