-- Migration: add email to account_deletion_audit for trial abuse prevention
-- Created: 2026-01-05
-- Purpose: Store email address in deletion audit to prevent trial abuse via account deletion/recreation

-- Add email column to account_deletion_audit table
ALTER TABLE public.account_deletion_audit
ADD COLUMN IF NOT EXISTS email text;

-- Create index for efficient email lookups (for trial eligibility checks)
CREATE INDEX IF NOT EXISTS account_deletion_audit_email_idx 
  ON public.account_deletion_audit (email) 
  WHERE email IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.account_deletion_audit.email IS 
  'Email address of the deleted account. Used to prevent trial abuse via account deletion and recreation.';

