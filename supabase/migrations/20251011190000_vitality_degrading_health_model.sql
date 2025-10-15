-- Migration: Plan Health Degrading Model
-- Purpose: Replace progress-based metrics with degrading health bar model
-- Date: 2025-10-11
--
-- New Model: Plans start at 100% health (green) and degrade based on poor habits
-- Good habits restore vitality. Gray state only when no tasks scheduled yet.
--
-- Degradation Factors:
-- - Late completions: -5 points per task completed after scheduled date
-- - Overdue tasks: -3 points per day per incomplete overdue task
-- - Consistency gaps: -2 points per day with scheduled tasks but zero completions
-- - Progress lag: -10 points if behind expected completion rate
--
-- Recovery Factors:
-- - On-time completions: +2 points per task completed on scheduled date
-- - Early completions: +4 points per task completed before scheduled date
-- - Daily streak bonus: +1 point per day in current completion streak
--

-- ============================================================
-- Step 1: Drop and recreate v_plan_health view
-- ============================================================

DROP VIEW IF EXISTS public.v_plan_health CASCADE;

CREATE OR REPLACE VIEW public.v_plan_health AS
WITH plan_metrics AS (
  SELECT
    p.id AS plan_id,
    p.user_id,
    p.start_date,
    p.end_date,
    
    -- Total tasks scheduled
    COUNT(DISTINCT t.id) AS total_tasks,
    
    -- Total completions
    COUNT(DISTINCT tc.id) AS total_completions,
    
    -- Tasks scheduled so far (based on current date)
    COUNT(DISTINCT CASE 
      WHEN ts.date <= CURRENT_DATE THEN t.id 
      ELSE NULL 
    END) AS tasks_scheduled_so_far,
    
    -- Has any scheduled tasks (for gray state check)
    COUNT(DISTINCT ts.id) > 0 AS has_scheduled_tasks,
    
    -- Days elapsed since plan start
    GREATEST(CURRENT_DATE - p.start_date, 0) AS days_elapsed,
    
    -- Days with scheduled tasks
    COUNT(DISTINCT ts.date) AS total_scheduled_days,
    
    -- Days with scheduled tasks that have passed
    COUNT(DISTINCT CASE 
      WHEN ts.date <= CURRENT_DATE THEN ts.date 
      ELSE NULL 
    END) AS past_scheduled_days,
    
    -- === DEGRADATION FACTORS ===
    
    -- Late completions: completed after scheduled date (-5 points each)
    COUNT(CASE 
      WHEN tc.completed_at::date > ts.date THEN 1 
      ELSE NULL 
    END) * -5 AS late_completion_penalty,
    
    -- Overdue tasks: scheduled tasks not completed yet (-3 points per day per task)
    SUM(CASE
      WHEN ts.date < CURRENT_DATE AND tc.id IS NULL THEN
        (CURRENT_DATE - ts.date) * -3
      ELSE 0
    END) AS overdue_penalty,
    
    -- Consistency gaps: days with scheduled tasks but no completions (-2 points per day)
    (COUNT(DISTINCT CASE 
      WHEN ts.date <= CURRENT_DATE THEN ts.date 
      ELSE NULL 
    END) - COUNT(DISTINCT CASE 
      WHEN tc.completed_at IS NOT NULL AND tc.scheduled_date <= CURRENT_DATE THEN tc.scheduled_date 
      ELSE NULL 
    END)) * -2 AS consistency_gap_penalty,
    
    -- Progress lag: behind expected completion rate (-10 if lagging)
    CASE
      WHEN COUNT(DISTINCT CASE WHEN ts.date <= CURRENT_DATE THEN t.id ELSE NULL END) > 0 THEN
        CASE
          WHEN (COUNT(DISTINCT tc.id)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN ts.date <= CURRENT_DATE THEN t.id ELSE NULL END), 0)::numeric) < 0.7 THEN -10
          ELSE 0
        END
      ELSE 0
    END AS progress_lag_penalty,
    
    -- === RECOVERY FACTORS ===
    
    -- On-time completions: completed on scheduled date (+2 points each)
    COUNT(CASE 
      WHEN tc.completed_at::date = ts.date THEN 1 
      ELSE NULL 
    END) * 2 AS ontime_completion_bonus,
    
    -- Early completions: completed before scheduled date (+4 points each)
    COUNT(CASE 
      WHEN tc.completed_at::date < ts.date THEN 1 
      ELSE NULL 
    END) * 4 AS early_completion_bonus,
    
    -- Calculate current streak (consecutive days with completions)
    -- Simplified: count distinct completion dates in last 7 days
    COUNT(DISTINCT CASE
      WHEN tc.completed_at::date >= CURRENT_DATE - INTERVAL '7 days' 
        AND tc.completed_at::date <= CURRENT_DATE 
      THEN tc.completed_at::date
      ELSE NULL
    END) AS current_streak_days,
    
    -- Days with completions (for consistency calculation)
    COUNT(DISTINCT CASE 
      WHEN tc.completed_at IS NOT NULL AND tc.scheduled_date <= CURRENT_DATE 
      THEN tc.scheduled_date 
      ELSE NULL 
    END) AS days_with_completions

  FROM public.plans p
  LEFT JOIN public.tasks t ON t.plan_id = p.id
  LEFT JOIN public.task_schedule ts ON ts.task_id = t.id AND ts.plan_id = p.id
  LEFT JOIN public.task_completions tc ON tc.task_id = t.id AND tc.plan_id = p.id
  WHERE p.status = 'active'
  GROUP BY p.id, p.user_id, p.start_date, p.end_date
)
SELECT
  plan_id,
  user_id,
  total_tasks,
  total_completions,
  tasks_scheduled_so_far,
  has_scheduled_tasks,
  days_elapsed,
  
  -- Health Score: Start at 100, apply penalties and bonuses, clamp 0-100
  GREATEST(0, LEAST(100, 
    100 
    + COALESCE(late_completion_penalty, 0)
    + COALESCE(overdue_penalty, 0)
    + COALESCE(consistency_gap_penalty, 0)
    + COALESCE(progress_lag_penalty, 0)
    + COALESCE(ontime_completion_bonus, 0)
    + COALESCE(early_completion_bonus, 0)
    + COALESCE(current_streak_days, 0)  -- +1 per day in streak
  )) AS health_score,
  
  -- Individual metrics for display (0-100 scale)
  -- Progress: percentage of scheduled tasks completed
  CASE
    WHEN tasks_scheduled_so_far > 0 THEN
      ROUND((total_completions::numeric / tasks_scheduled_so_far::numeric) * 100, 2)
    ELSE 0
  END AS progress,
  
  -- Consistency: percentage of past scheduled days with at least one completion
  CASE
    WHEN past_scheduled_days > 0 THEN
      ROUND((days_with_completions::numeric / past_scheduled_days::numeric) * 100, 2)
    ELSE 0
  END AS consistency,
  
  -- Efficiency: percentage of completions that were on-time or early
  CASE
    WHEN total_completions > 0 THEN
      ROUND(((ontime_completion_bonus / 2 + early_completion_bonus / 4)::numeric 
             / total_completions::numeric) * 100, 2)
    ELSE NULL
  END AS efficiency,
  
  -- Detailed breakdown for debugging/display
  late_completion_penalty,
  overdue_penalty,
  consistency_gap_penalty,
  progress_lag_penalty,
  ontime_completion_bonus,
  early_completion_bonus,
  current_streak_days

FROM plan_metrics;

COMMENT ON VIEW public.v_plan_health IS
'Degrading health model for plans. Plans start at 100% health and degrade based on poor habits (late/overdue tasks, gaps). Good habits restore health. Updated 2025-10-11.';

COMMENT ON COLUMN public.v_plan_health.health_score IS
'Overall health score (0-100). Starts at 100, degrades with poor habits, recovers with good habits.';

COMMENT ON COLUMN public.v_plan_health.has_scheduled_tasks IS
'Boolean flag: true if plan has any scheduled tasks. Used to determine gray state (gray when false).';

-- ============================================================
-- Step 2: Update get_plan_health_now RPC function (alias get_vitality_now for backward compatibility)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_plan_health_now(
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
    'health_score', COALESCE(vph.health_score, 100),
    'has_scheduled_tasks', COALESCE(vph.has_scheduled_tasks, false),
    'progress', COALESCE(vph.progress, 0),
    'consistency', COALESCE(vph.consistency, 0),
    'efficiency', vph.efficiency,  -- Can be NULL
    'total_tasks', COALESCE(vph.total_tasks, 0),
    'total_completions', COALESCE(vph.total_completions, 0),
    'tasks_scheduled_so_far', COALESCE(vph.tasks_scheduled_so_far, 0),
    'days_elapsed', COALESCE(vph.days_elapsed, 0),
    'current_streak_days', COALESCE(vph.current_streak_days, 0),
    -- Penalty breakdown (for debugging/insights)
    'penalties', json_build_object(
      'late_completions', COALESCE(vph.late_completion_penalty, 0),
      'overdue_tasks', COALESCE(vph.overdue_penalty, 0),
      'consistency_gaps', COALESCE(vph.consistency_gap_penalty, 0),
      'progress_lag', COALESCE(vph.progress_lag_penalty, 0)
    ),
    -- Bonus breakdown (for debugging/insights)
    'bonuses', json_build_object(
      'ontime_completions', COALESCE(vph.ontime_completion_bonus, 0),
      'early_completions', COALESCE(vph.early_completion_bonus, 0),
      'streak_bonus', COALESCE(vph.current_streak_days, 0)
    )
  )
  INTO result
  FROM public.v_plan_health vph
  WHERE vph.user_id = p_user_id
    AND vph.plan_id = p_plan_id;
  
  -- If no result, return default values (new plan, no tasks yet)
  IF result IS NULL THEN
    result := json_build_object(
      'health_score', 100,
      'has_scheduled_tasks', false,
      'progress', 0,
      'consistency', 0,
      'efficiency', NULL,
      'total_tasks', 0,
      'total_completions', 0,
      'tasks_scheduled_so_far', 0,
      'days_elapsed', 0,
      'current_streak_days', 0,
      'penalties', json_build_object(
        'late_completions', 0,
        'overdue_tasks', 0,
        'consistency_gaps', 0,
        'progress_lag', 0
      ),
      'bonuses', json_build_object(
        'ontime_completions', 0,
        'early_completions', 0,
        'streak_bonus', 0
      )
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Create backward-compatible alias that maps field names
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
  health_result json;
BEGIN
  -- Get result from new function
  health_result := public.get_plan_health_now(p_user_id, p_plan_id);
  
  -- Map health_score to vitality_score for backward compatibility
  SELECT json_build_object(
    'vitality_score', (health_result->>'health_score')::numeric,
    'has_scheduled_tasks', (health_result->>'has_scheduled_tasks')::boolean,
    'progress', (health_result->>'progress')::numeric,
    'consistency', (health_result->>'consistency')::numeric,
    'efficiency', CASE 
      WHEN health_result->>'efficiency' IS NULL THEN NULL 
      ELSE (health_result->>'efficiency')::numeric 
    END,
    'total_tasks', (health_result->>'total_tasks')::integer,
    'total_completions', (health_result->>'total_completions')::integer,
    'tasks_scheduled_so_far', (health_result->>'tasks_scheduled_so_far')::integer,
    'days_elapsed', (health_result->>'days_elapsed')::integer,
    'current_streak_days', (health_result->>'current_streak_days')::integer,
    'penalties', health_result->'penalties',
    'bonuses', health_result->'bonuses'
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_plan_health_now IS
'Returns degrading health model metrics. Plans start at 100% health, degrade with poor habits, recover with good habits. Updated 2025-10-11.';

COMMENT ON FUNCTION public.get_vitality_now IS
'Backward compatibility alias for get_plan_health_now. Use get_plan_health_now for new code.';

-- ============================================================
-- Verification
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✓ v_plan_health view recreated with degrading health model';
  RAISE NOTICE '✓ Health starts at 100%%, degrades with poor habits, recovers with good habits';
  RAISE NOTICE '✓ Gray state only when has_scheduled_tasks = false';
  RAISE NOTICE '✓ get_plan_health_now function created (get_vitality_now aliased for compatibility)';
  RAISE NOTICE '';
  RAISE NOTICE 'Degradation Factors:';
  RAISE NOTICE '  - Late completions: -5 points each';
  RAISE NOTICE '  - Overdue tasks: -3 points per day per task';
  RAISE NOTICE '  - Consistency gaps: -2 points per missed day';
  RAISE NOTICE '  - Progress lag: -10 points if < 70%% completion rate';
  RAISE NOTICE '';
  RAISE NOTICE 'Recovery Factors:';
  RAISE NOTICE '  - On-time completions: +2 points each';
  RAISE NOTICE '  - Early completions: +4 points each';
  RAISE NOTICE '  - Daily streak: +1 point per day';
END $$;

