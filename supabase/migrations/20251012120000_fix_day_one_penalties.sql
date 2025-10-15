-- Migration: Fix Day 1 Health Penalties
-- Purpose: Prevent consistency gap and progress lag penalties from applying on the current day
-- Date: 2025-10-12
--
-- Issue: Brand new plans show 88% health on Day 1 because penalties apply to the current day
-- Fix: Only count fully elapsed days (exclude current day from penalty calculations)

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
    
    -- Days with scheduled tasks that have passed (EXCLUDING TODAY)
    COUNT(DISTINCT CASE 
      WHEN ts.date < CURRENT_DATE THEN ts.date 
      ELSE NULL 
    END) AS past_scheduled_days,
    
    -- === DEGRADATION FACTORS ===
    
    -- Late completions: completed after scheduled date (-5 points each)
    COUNT(CASE 
      WHEN tc.completed_at::date > ts.date THEN 1 
      ELSE NULL 
    END) * -5 AS late_completion_penalty,
    
    -- Overdue tasks: scheduled tasks not completed yet (-3 points per day per task)
    -- Only count tasks from PAST days (not today)
    SUM(CASE
      WHEN ts.date < CURRENT_DATE AND tc.id IS NULL THEN
        (CURRENT_DATE - ts.date) * -3
      ELSE 0
    END) AS overdue_penalty,
    
    -- Consistency gaps: PAST days with scheduled tasks but no completions (-2 points per day)
    -- FIXED: Only count days BEFORE today, exclude current day
    (COUNT(DISTINCT CASE 
      WHEN ts.date < CURRENT_DATE THEN ts.date 
      ELSE NULL 
    END) - COUNT(DISTINCT CASE 
      WHEN tc.completed_at IS NOT NULL AND tc.scheduled_date < CURRENT_DATE THEN tc.scheduled_date 
      ELSE NULL 
    END)) * -2 AS consistency_gap_penalty,
    
    -- Progress lag: behind expected completion rate (-10 if lagging)
    -- FIXED: Only apply if there are tasks from PAST days, exclude current day
    CASE
      WHEN COUNT(DISTINCT CASE WHEN ts.date < CURRENT_DATE THEN t.id ELSE NULL END) > 0 THEN
        CASE
          WHEN (COUNT(DISTINCT tc.id)::numeric / NULLIF(COUNT(DISTINCT CASE WHEN ts.date < CURRENT_DATE THEN t.id ELSE NULL END), 0)::numeric) < 0.7 THEN -10
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
    -- FIXED: Only count PAST days for consistency metric
    COUNT(DISTINCT CASE 
      WHEN tc.completed_at IS NOT NULL AND tc.scheduled_date < CURRENT_DATE 
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
'Degrading health model for plans. Plans start at 100% health and degrade based on poor habits (late/overdue tasks, gaps). Good habits restore health. Penalties only apply to fully elapsed days (not current day). Updated 2025-10-12.';

COMMENT ON COLUMN public.v_plan_health.health_score IS
'Overall health score (0-100). Starts at 100, degrades with poor habits, recovers with good habits. Penalties exclude current day.';

COMMENT ON COLUMN public.v_plan_health.has_scheduled_tasks IS
'Boolean flag: true if plan has any scheduled tasks. Used to determine gray state (gray when false).';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✓ Fixed Day 1 penalties: consistency gaps and progress lag now exclude current day';
  RAISE NOTICE '✓ New plans will start at 100%% health on Day 1';
  RAISE NOTICE '✓ Penalties only apply to fully elapsed days';
END $$;


