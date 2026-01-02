-- Migration: add account_deletion_audit table for tracking account deletions
-- Created: 2026-01-04
-- Purpose: Audit trail for account deletions, including Stripe cleanup status

CREATE TABLE IF NOT EXISTS public.account_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  deletion_initiated_at timestamptz NOT NULL DEFAULT now(),
  deletion_completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'partial')),
  stripe_cleanup_status text CHECK (stripe_cleanup_status IN ('pending', 'completed', 'failed', 'skipped')),
  subscriptions_canceled integer DEFAULT 0,
  payment_methods_detached integer DEFAULT 0,
  customer_deleted boolean DEFAULT false,
  redaction_job_id text,
  error_details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS account_deletion_audit_user_id_idx 
  ON public.account_deletion_audit (user_id);

CREATE INDEX IF NOT EXISTS account_deletion_audit_stripe_customer_id_idx 
  ON public.account_deletion_audit (stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS account_deletion_audit_deletion_initiated_at_idx 
  ON public.account_deletion_audit (deletion_initiated_at);

CREATE INDEX IF NOT EXISTS account_deletion_audit_status_idx 
  ON public.account_deletion_audit (status);

-- RLS Policies
ALTER TABLE public.account_deletion_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own audit records
CREATE POLICY "Users can read own deletion audit records"
  ON public.account_deletion_audit
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for API routes)
CREATE POLICY "Service role can manage deletion audit records"
  ON public.account_deletion_audit
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Comments for documentation
COMMENT ON TABLE public.account_deletion_audit IS 'Audit trail for account deletions, tracking Stripe cleanup status and errors';
COMMENT ON COLUMN public.account_deletion_audit.status IS 'Overall deletion status: pending, in_progress, completed, failed, partial';
COMMENT ON COLUMN public.account_deletion_audit.stripe_cleanup_status IS 'Stripe cleanup status: pending, completed, failed, skipped (if no Stripe customer)';
COMMENT ON COLUMN public.account_deletion_audit.error_details IS 'JSONB object containing error details for failed operations';
COMMENT ON COLUMN public.account_deletion_audit.redaction_job_id IS 'Stripe redaction job ID if GDPR redaction was initiated';

