-- Update get_user_plans function to include plan_type and integration_metadata
CREATE OR REPLACE FUNCTION public.get_user_plans(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_plans json;
BEGIN
  -- Get all plans for the user with summary data
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'user_id', p.user_id,
      'goal_text', p.goal_text,
      'status', p.status,
      'start_date', p.start_date,
      'end_date', p.end_date,
      'plan_type', p.plan_type,
      'integration_metadata', p.integration_metadata,
      'summary_data', p.summary_data,
      'created_at', p.created_at,
      'archived_at', p.archived_at,
      'task_count', (
        SELECT COUNT(*) 
        FROM public.tasks t 
        WHERE t.plan_id = p.id
      )
    )
    ORDER BY 
      CASE p.status 
        WHEN 'active' THEN 1 
        WHEN 'paused' THEN 2 
        WHEN 'completed' THEN 3 
        WHEN 'archived' THEN 4 
        ELSE 5 
      END,
      p.created_at DESC
  )
  INTO v_plans
  FROM public.plans p
  WHERE p.user_id = p_user_id;
  
  RETURN COALESCE(v_plans, '[]'::json);
END;
$function$;

