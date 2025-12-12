-- Enable pg_net extension for HTTP requests from cron jobs
-- Run this directly in Supabase SQL Editor to fix the cron job error

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

COMMENT ON EXTENSION "pg_net" IS 'Enables HTTP requests from PostgreSQL, used by cron jobs to call Edge Functions';

-- Verify the extension is installed
SELECT 
  extname as extension_name,
  extversion as version
FROM pg_extension 
WHERE extname = 'pg_net';


