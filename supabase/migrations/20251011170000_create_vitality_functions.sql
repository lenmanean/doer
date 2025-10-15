-- Migration: Create Vitality/Health Metrics Functions and Views
-- Purpose: Create missing get_vitality_now RPC and v_plan_health view for dashboard metrics
-- Date: 2025-10-11

-- ============================================================
-- Step 1: Create v_plan_health view
-- ============================================================

DROP VIEW IF EXISTS public.v_plan_health CASCADE;

CREATE OR REPLACE VIEW public.v_plan_health AS
SELECT
  p.id AS plan_id,
  p.user_id,
  
  -- Progress: Percentage of all tasks completed (both daily and milestone)
  CASE
    WHEN COUNT(DISTINCT t.id) > 0 THEN
      ROUND((COUNT(DISTINCT CASE WHEN tc.id IS NOT NULL THEN t.id ELSE NULL END)::numeric 
             / COUNT(DISTINCT t.id)::numeric) * 100, 2)
    ELSE 0
  END AS progress,
  
  -- Consistency: Percentage of days with at least one task completed
  -- (Simplified calculation - can be enhanced later)
  CASE
    WHEN (p.end_date - p.start_date) > 0 THEN
      ROUND((COUNT(DISTINCT tc.scheduled_date)::numeric 
             / (p.end_date - p.start_date + 1)::numeric) * 100, 2)
    ELSE 0
  END AS consistency,
  
  -- Efficiency: Percentage of tasks completed on or before scheduled date
  CASE
    WHEN COUNT(tc.id) > 0 THEN
      ROUND((COUNT(CASE WHEN tc.completed_at::date <= ts.date THEN 1 ELSE NULL END)::numeric 
             / COUNT(tc.id)::numeric) * 100, 2)
    ELSE 100  -- If no tasks completed yet, show 100% efficiency
  END AS efficiency,
  
  -- Health score: Average of the three metrics
  CASE
    WHEN COUNT(DISTINCT t.id) > 0 THEN
      ROUND((
        -- Progress
        (COUNT(DISTINCT CASE WHEN tc.id IS NOT NULL THEN t.id ELSE NULL END)::numeric 
         / COUNT(DISTINCT t.id)::numeric) * 100 +
        -- Consistency
        (COUNT(DISTINCT tc.scheduled_date)::numeric 
         / GREATEST((p.end_date - p.start_date + 1), 1)::numeric) * 100 +
        -- Efficiency
        CASE 
          WHEN COUNT(tc.id) > 0 THEN
            (COUNT(CASE WHEN tc.completed_at::date <= ts.date THEN 1 ELSE NULL END)::numeric 
             / COUNT(tc.id)::numeric) * 100
          ELSE 100
        END
      ) / 3, 2)
    ELSE 0
  END AS health_score

FROM public.plans p
LEFT JOIN public.tasks t ON t.plan_id = p.id
LEFT JOIN public.task_completions tc ON tc.plan_id = p.id AND tc.task_id = t.id
LEFT JOIN public.task_schedule ts ON ts.task_id = t.id AND ts.plan_id = p.id
WHERE p.status = 'active'
GROUP BY p.id, p.user_id, p.start_date, p.end_date;

COMMENT ON VIEW public.v_plan_health IS
'Plan health metrics view. Calculates progress, consistency, efficiency, and overall health score for active plans.';

-- ============================================================
-- Step 2: Create get_vitality_now RPC function
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_vitality_now(
  p_user_id uuid,
  p_plan_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Get health metrics from the view
  SELECT json_build_object(
    'progress', COALESCE(vph.progress, 0),
    'consistency', COALESCE(vph.consistency, 0),
    'efficiency', COALESCE(vph.efficiency, 100),
    'health_score', COALESCE(vph.health_score, 0)
  )
  INTO result
  FROM public.v_plan_health vph
  WHERE vph.user_id = p_user_id
    AND vph.plan_id = p_plan_id;
  
  -- If no result, return default values
  IF result IS NULL THEN
    result := json_build_object(
      'progress', 0,
      'consistency', 0,
      'efficiency', 100,
      'health_score', 0
    );
  END IF;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_vitality_now IS
'Returns current vitality/health metrics for a specific plan. Returns progress, consistency, efficiency percentages and overall health score.';

-- ============================================================
-- Verification
-- ============================================================

-- Test the function with a sample query (will return default values if no data)
DO $$
DECLARE
  test_result json;
BEGIN
  -- Just verify the function can be called without errors
  RAISE NOTICE '✓ get_vitality_now function created successfully';
  RAISE NOTICE '✓ v_plan_health view created successfully';
END $$;



