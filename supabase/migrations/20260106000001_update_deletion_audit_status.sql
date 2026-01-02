-- Migration: update account_deletion_audit status to include 'scheduled' and 'restored'
-- Created: 2026-01-06
-- Purpose: Track scheduled deletions and account restorations in audit log

-- Drop existing CHECK constraint
ALTER TABLE public.account_deletion_audit
DROP CONSTRAINT IF EXISTS account_deletion_audit_status_check;

-- Add new CHECK constraint with additional status values
ALTER TABLE public.account_deletion_audit
ADD CONSTRAINT account_deletion_audit_status_check 
  CHECK (status IN ('pending', 'in_progress', 'scheduled', 'restored', 'completed', 'failed', 'partial'));

-- Add comment explaining new statuses
COMMENT ON COLUMN public.account_deletion_audit.status IS 
  'Overall deletion status: pending (initial state), in_progress (deletion in progress), scheduled (deletion scheduled for future), restored (user restored account), completed (deletion finished), failed (deletion failed), partial (partial success)';

