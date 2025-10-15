# Quick Start: Health Snapshots (SQL Editor Only)

Complete setup guide using only the Supabase Dashboard SQL Editor.

---

## Step 1: Create Health Snapshots Infrastructure

**Go to: Supabase Dashboard → SQL Editor**

Copy and paste this entire SQL script:

```sql
-- Migration: Health Snapshots Persistence System
-- Run this in Supabase SQL Editor

-- ============================================================
-- Create health_snapshots table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.health_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Core health metrics
  health_score numeric NOT NULL DEFAULT 100,
  has_scheduled_tasks boolean NOT NULL DEFAULT false,
  progress numeric NOT NULL DEFAULT 0,
  consistency numeric NOT NULL DEFAULT 0,
  efficiency numeric DEFAULT NULL,
  
  -- Task counts
  total_tasks integer NOT NULL DEFAULT 0,
  total_completions integer NOT NULL DEFAULT 0,
  days_elapsed integer NOT NULL DEFAULT 0,
  current_streak_days integer NOT NULL DEFAULT 0,
  
  -- Penalty breakdown
  late_completion_penalty numeric NOT NULL DEFAULT 0,
  overdue_penalty numeric NOT NULL DEFAULT 0,
  consistency_gap_penalty numeric NOT NULL DEFAULT 0,
  progress_lag_penalty numeric NOT NULL DEFAULT 0,
  
  -- Bonus breakdown
  ontime_completion_bonus numeric NOT NULL DEFAULT 0,
  early_completion_bonus numeric NOT NULL DEFAULT 0,
  streak_bonus numeric NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  
  -- Prevent duplicate snapshots per plan per day
  UNIQUE(plan_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_health_snapshots_user_plan ON public.health_snapshots(user_id, plan_id);
CREATE INDEX idx_health_snapshots_date ON public.health_snapshots(snapshot_date DESC);
CREATE INDEX idx_health_snapshots_plan_date ON public.health_snapshots(plan_id, snapshot_date DESC);

-- ============================================================
-- Create capture_health_snapshot RPC function
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
  -- Get current health metrics
  v_health_data := public.get_plan_health_now(p_user_id, p_plan_id);
  
  -- Insert or update snapshot
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
  
  RETURN json_build_object(
    'success', true,
    'snapshot_id', v_snapshot_id,
    'plan_id', p_plan_id,
    'snapshot_date', CURRENT_DATE,
    'health_score', (v_health_data->>'health_score')::numeric
  );
END;
$$;

-- ============================================================
-- Enable Row Level Security
-- ============================================================

ALTER TABLE public.health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health snapshots"
  ON public.health_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can capture health snapshots"
  ON public.health_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Verification
-- ============================================================

SELECT 
  'health_snapshots table created' as status,
  COUNT(*) as row_count
FROM health_snapshots;
```

**✅ Expected Result**: Should show "health_snapshots table created" with 0 rows.

---

## Step 2: Test the RPC Function

**In SQL Editor, run:**

```sql
-- Find an active plan to test with
SELECT id as plan_id, user_id 
FROM plans 
WHERE status = 'active' 
LIMIT 1;
```

Copy the `plan_id` and `user_id`, then run:

```sql
-- Replace with actual UUIDs from above
SELECT capture_health_snapshot(
  'YOUR_USER_ID_HERE'::uuid,
  'YOUR_PLAN_ID_HERE'::uuid
);
```

**✅ Expected Result**: JSON response with `"success": true` and health metrics.

---

## Step 3: Verify Snapshot Was Created

**In SQL Editor, run:**

```sql
-- View all captured snapshots
SELECT 
  snapshot_date,
  health_score,
  progress,
  consistency,
  efficiency,
  total_completions,
  created_at
FROM health_snapshots
ORDER BY snapshot_date DESC;
```

**✅ Expected Result**: Should show at least one row with today's date.

---

## Step 4: Set Up Daily Automated Capture (Optional)

### Option A: Using Cron Job

**In SQL Editor, run:**

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily capture at 00:00 UTC
SELECT cron.schedule(
  'daily-health-snapshots',
  '0 0 * * *',
  $$
    SELECT
      net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/capture_health_snapshots',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
  $$
);
```

**Replace**:
- `YOUR_PROJECT_REF` with your actual project reference
- `YOUR_ANON_KEY` with your actual anon key

**✅ Expected Result**: 
```json
[{"schedule": 6}]  // or any number - this is your job ID
```

**Verify the cron job was created:**
```sql
-- View your specific cron job
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job 
WHERE jobname = 'daily-health-snapshots';
```

**Expected**: Should show your job scheduled for `0 0 * * *` (daily at midnight UTC)

**View ALL cron jobs in your database:**
```sql
-- See all cron jobs (active and inactive)
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database,
  nodename,
  username
FROM cron.job 
ORDER BY jobid;
```

**Note**: The job ID (6) doesn't mean there are 5 other active jobs - it's just the sequential ID. You might see other jobs from Supabase internal processes or previously deleted jobs.

### Option B: Manual Snapshots

If you prefer to capture snapshots manually, just run this whenever needed:

```sql
-- Capture snapshots for all active plans
DO $$
DECLARE
  plan_record RECORD;
  result json;
BEGIN
  FOR plan_record IN 
    SELECT user_id, id FROM plans WHERE status = 'active'
  LOOP
    SELECT capture_health_snapshot(plan_record.user_id, plan_record.id) INTO result;
    RAISE NOTICE 'Captured snapshot for plan %: %', plan_record.id, result;
  END LOOP;
END $$;
```

---

## Step 5: Check Your Setup

**Verify everything is working:**

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'health_snapshots';

-- Check function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'capture_health_snapshot';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'health_snapshots';

-- View snapshot count
SELECT 
  COUNT(*) as total_snapshots,
  COUNT(DISTINCT plan_id) as unique_plans,
  COUNT(DISTINCT snapshot_date) as unique_dates,
  MIN(snapshot_date) as earliest_snapshot,
  MAX(snapshot_date) as latest_snapshot
FROM health_snapshots;
```

---

## ✅ You're All Set!

Your health snapshots system is now ready. The analytics functions in `doer/src/lib/analytics.ts` will work automatically:

- `fetchHealthHistory(userId, planId, days)` - Get historical data
- `fetchWeeklyHealthAnalytics(userId, planId, weeks)` - Get weekly aggregates
- `fetchHealthInsights(userId, planId)` - Get trend analysis

---

## 📝 Quick Reference

### Capture Snapshot Manually
```sql
SELECT capture_health_snapshot('user-uuid'::uuid, 'plan-uuid'::uuid);
```

### View Recent Snapshots
```sql
SELECT * FROM health_snapshots ORDER BY created_at DESC LIMIT 10;
```

### View Snapshots for Specific Plan
```sql
SELECT * FROM health_snapshots 
WHERE plan_id = 'your-plan-uuid'
ORDER BY snapshot_date DESC;
```

### Capture All Active Plans
```sql
DO $$
DECLARE plan_record RECORD; result json;
BEGIN
  FOR plan_record IN SELECT user_id, id FROM plans WHERE status = 'active'
  LOOP
    SELECT capture_health_snapshot(plan_record.user_id, plan_record.id) INTO result;
  END LOOP;
END $$;
```

### View All Cron Jobs
```sql
-- See all cron jobs in your database
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  username
FROM cron.job 
ORDER BY jobid;
```

### Check Cron Job Run History
```sql
-- View recent runs (replace 6 with your job ID)
SELECT 
  jobid,
  runid,
  status,
  start_time,
  end_time,
  return_message
FROM cron.job_run_details 
WHERE jobid = 6
ORDER BY start_time DESC 
LIMIT 10;
```

---

## 🚨 Troubleshooting

**Error: relation "health_snapshots" does not exist**
- Re-run Step 1 migration SQL

**Error: function get_plan_health_now does not exist**
- Ensure `20251011190000_vitality_degrading_health_model.sql` was run first

**No snapshots appearing**
- Check active plans exist: `SELECT * FROM plans WHERE status = 'active'`
- Manually run capture function with known plan ID
- Check for error messages in result JSON

---

For more details, see `HEALTH_SNAPSHOTS_INTEGRATION.md` in the `supabase/migrations/` folder.

