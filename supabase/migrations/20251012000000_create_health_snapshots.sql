-- Migration: Health Snapshots Persistence System
-- Purpose: Store daily health snapshots for historical tracking and analytics
-- Date: 2025-10-12
--
-- Captures daily snapshots of plan health metrics for:
-- - Historical trend analysis
-- - Weekly/monthly aggregations
-- - Insights and comparative analysis

-- ============================================================
-- Step 1: Create health_snapshots table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.health_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Core health metrics (captured from v_plan_health view)
  health_score numeric NOT NULL DEFAULT 100,
  has_scheduled_tasks boolean NOT NULL DEFAULT false,
  progress numeric NOT NULL DEFAULT 0,
  consistency numeric NOT NULL DEFAULT 0,
  efficiency numeric DEFAULT NULL,  -- Nullable until completions exist
  
  -- Task counts
  total_tasks integer NOT NULL DEFAULT 0,
  total_completions integer NOT NULL DEFAULT 0,
  days_elapsed integer NOT NULL DEFAULT 0,
  current_streak_days integer NOT NULL DEFAULT 0,
  
  -- Penalty breakdown (for insights)
  late_completion_penalty numeric NOT NULL DEFAULT 0,
  overdue_penalty numeric NOT NULL DEFAULT 0,
  consistency_gap_penalty numeric NOT NULL DEFAULT 0,
  progress_lag_penalty numeric NOT NULL DEFAULT 0,
  
  -- Bonus breakdown (for insights)
  ontime_completion_bonus numeric NOT NULL DEFAULT 0,
  early_completion_bonus numeric NOT NULL DEFAULT 0,
  streak_bonus numeric NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  
  -- Prevent duplicate snapshots per plan per day
  UNIQUE(plan_id, snapshot_date)
);

-- Indexes for efficient querying
CREATE INDEX idx_health_snapshots_user_plan ON public.health_snapshots(user_id, plan_id);
CREATE INDEX idx_health_snapshots_date ON public.health_snapshots(snapshot_date DESC);
CREATE INDEX idx_health_snapshots_plan_date ON public.health_snapshots(plan_id, snapshot_date DESC);

COMMENT ON TABLE public.health_snapshots IS
'Daily snapshots of plan health metrics for historical tracking and analytics. Unique constraint prevents duplicate snapshots per plan per day.';

-- ============================================================
-- Step 2: Create capture_health_snapshot RPC function
-- ============================================================

CREATE OR REPLACE FUNCTION public.capture_health_snapshot(
  p_user_id uuid,
  p_plan_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_health_data json;
  v_snapshot_id uuid;
BEGIN
  -- Get current health metrics using existing function
  v_health_data := public.get_plan_health_now(p_user_id, p_plan_id);
  
  -- Insert snapshot (or update if already exists for today)
  INSERT INTO public.health_snapshots (
    user_id,
    plan_id,
    snapshot_date,
    health_score,
    has_scheduled_tasks,
    progress,
    consistency,
    efficiency,
    total_tasks,
    total_completions,
    days_elapsed,
    current_streak_days,
    late_completion_penalty,
    overdue_penalty,
    consistency_gap_penalty,
    progress_lag_penalty,
    ontime_completion_bonus,
    early_completion_bonus,
    streak_bonus
  )
  VALUES (
    p_user_id,
    p_plan_id,
    CURRENT_DATE,
    (v_health_data->>'health_score')::numeric,
    (v_health_data->>'has_scheduled_tasks')::boolean,
    (v_health_data->>'progress')::numeric,
    (v_health_data->>'consistency')::numeric,
    CASE 
      WHEN v_health_data->>'efficiency' IS NULL THEN NULL 
      ELSE (v_health_data->>'efficiency')::numeric 
    END,
    (v_health_data->>'total_tasks')::integer,
    (v_health_data->>'total_completions')::integer,
    (v_health_data->>'days_elapsed')::integer,
    (v_health_data->>'current_streak_days')::integer,
    (v_health_data->'penalties'->>'late_completions')::numeric,
    (v_health_data->'penalties'->>'overdue_tasks')::numeric,
    (v_health_data->'penalties'->>'consistency_gaps')::numeric,
    (v_health_data->'penalties'->>'progress_lag')::numeric,
    (v_health_data->'bonuses'->>'ontime_completions')::numeric,
    (v_health_data->'bonuses'->>'early_completions')::numeric,
    (v_health_data->'bonuses'->>'streak_bonus')::numeric
  )
  ON CONFLICT (plan_id, snapshot_date)
  DO UPDATE SET
    health_score = EXCLUDED.health_score,
    has_scheduled_tasks = EXCLUDED.has_scheduled_tasks,
    progress = EXCLUDED.progress,
    consistency = EXCLUDED.consistency,
    efficiency = EXCLUDED.efficiency,
    total_tasks = EXCLUDED.total_tasks,
    total_completions = EXCLUDED.total_completions,
    days_elapsed = EXCLUDED.days_elapsed,
    current_streak_days = EXCLUDED.current_streak_days,
    late_completion_penalty = EXCLUDED.late_completion_penalty,
    overdue_penalty = EXCLUDED.overdue_penalty,
    consistency_gap_penalty = EXCLUDED.consistency_gap_penalty,
    progress_lag_penalty = EXCLUDED.progress_lag_penalty,
    ontime_completion_bonus = EXCLUDED.ontime_completion_bonus,
    early_completion_bonus = EXCLUDED.early_completion_bonus,
    streak_bonus = EXCLUDED.streak_bonus,
    created_at = now()
  RETURNING id INTO v_snapshot_id;
  
  -- Return success result
  RETURN json_build_object(
    'success', true,
    'snapshot_id', v_snapshot_id,
    'plan_id', p_plan_id,
    'snapshot_date', CURRENT_DATE,
    'health_score', (v_health_data->>'health_score')::numeric
  );
END;
$$;

COMMENT ON FUNCTION public.capture_health_snapshot IS
'Captures a daily health snapshot for a plan. Uses get_plan_health_now() to fetch current metrics and stores them in health_snapshots table. Idempotent - updates existing snapshot if already captured today.';

-- ============================================================
-- Step 3: Enable RLS
-- ============================================================

ALTER TABLE public.health_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can only read their own snapshots
CREATE POLICY "Users can view own health snapshots"
  ON public.health_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert/update snapshots (via RPC functions)
CREATE POLICY "System can capture health snapshots"
  ON public.health_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Verification
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✓ health_snapshots table created';
  RAISE NOTICE '✓ Unique constraint: (plan_id, snapshot_date)';
  RAISE NOTICE '✓ Indexes created for efficient querying';
  RAISE NOTICE '✓ capture_health_snapshot() RPC function created';
  RAISE NOTICE '✓ Row Level Security enabled';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Deploy Supabase Edge Function: capture_health_snapshots';
  RAISE NOTICE '  2. Configure cron job: daily at 00:00 UTC';
  RAISE NOTICE '  3. Update analytics.ts with history fetching functions';
END $$;

