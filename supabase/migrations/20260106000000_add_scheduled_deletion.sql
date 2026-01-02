-- Migration: add scheduled_deletion_at to user_settings for scheduled account deletion
-- Created: 2026-01-06
-- Purpose: Track when accounts are scheduled for deletion, allowing users to restore during grace period

-- Add scheduled_deletion_at column to user_settings table
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz;

-- Create index for efficient cron job queries (finds accounts ready for deletion)
CREATE INDEX IF NOT EXISTS user_settings_scheduled_deletion_at_idx 
  ON public.user_settings (scheduled_deletion_at) 
  WHERE scheduled_deletion_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_settings.scheduled_deletion_at IS 
  'Timestamp when the account is scheduled to be deleted. NULL if account is not scheduled for deletion. Used to allow users to restore their account during the grace period.';

