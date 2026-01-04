-- Check for pg_cron jobs in the database
-- Run this in your Supabase SQL Editor

-- First, check if pg_cron extension is installed
SELECT 
  extname as extension_name,
  extversion as version
FROM pg_extension 
WHERE extname = 'pg_cron';

-- Check all cron jobs
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobid;

-- Specifically check for health snapshot related jobs
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active,
  database
FROM cron.job
WHERE 
  command LIKE '%capture_health_snapshot%' 
  OR jobname LIKE '%health%' 
  OR jobname LIKE '%snapshot%'
ORDER BY jobid;

-- Count total jobs
SELECT COUNT(*) as total_cron_jobs FROM cron.job;

-- Count active jobs
SELECT COUNT(*) as active_cron_jobs 
FROM cron.job 
WHERE active = true;





















