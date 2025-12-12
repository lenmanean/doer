-- Verification queries for health snapshot setup

-- 1. Check if pg_net extension is enabled
SELECT 
  extname as extension_name,
  extversion as version
FROM pg_extension 
WHERE extname = 'pg_net';

-- 2. Verify the database function exists
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname = 'capture_all_health_snapshots';

-- 3. Check the cron job status
SELECT 
  jobid,
  schedule,
  jobname,
  active,
  command
FROM cron.job 
WHERE jobname = 'daily-health-snapshots';

-- 4. Check recent health snapshots
SELECT 
  plan_id,
  user_id,
  snapshot_date,
  health_score,
  has_scheduled_tasks,
  created_at
FROM health_snapshots
ORDER BY created_at DESC
LIMIT 10;

-- 5. Count active plans
SELECT COUNT(*) as active_plans_count
FROM plans
WHERE status = 'active';

