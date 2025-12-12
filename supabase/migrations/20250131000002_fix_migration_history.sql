-- Fix migration history for out-of-sync migrations
-- Mark existing migrations as applied to sync local and remote

-- Note: Only run this if migrations are already applied on remote but not tracked locally
-- This is a repair migration to fix the migration history table

-- The migrations that need to be marked as applied (if they exist on remote):
-- 20250101000000_allow_long_durations_for_manual_tasks.sql
-- 20250120000000_add_unique_constraint_external_subscription_id.sql  
-- 20250121000000_add_unique_constraint_external_subscription_id.sql

-- This migration will be applied normally, and the repair should be done manually
-- if needed using: supabase migration repair --status applied <version>

COMMENT ON SCHEMA public IS 'Public schema with all application tables and functions';


