-- Enable pg_net extension for HTTP requests from cron jobs
-- This allows cron jobs to call Supabase Edge Functions via net.http_post()

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

COMMENT ON EXTENSION "pg_net" IS 'Enables HTTP requests from PostgreSQL, used by cron jobs to call Edge Functions';























