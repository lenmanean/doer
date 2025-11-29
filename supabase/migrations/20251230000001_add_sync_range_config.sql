-- Migration: Add sync range configuration to calendar connections
-- Allows users to configure how many days before/after current date to sync

ALTER TABLE public.calendar_connections
ADD COLUMN IF NOT EXISTS sync_range_days integer DEFAULT 30;

COMMENT ON COLUMN public.calendar_connections.sync_range_days IS 'Number of days before and after current date to sync calendar events (default: 30 days)';

-- Add constraint to ensure positive value
ALTER TABLE public.calendar_connections
ADD CONSTRAINT check_sync_range_days_positive 
CHECK (sync_range_days > 0 AND sync_range_days <= 365);

