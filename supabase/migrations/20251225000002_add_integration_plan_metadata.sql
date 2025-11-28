-- Migration: Add integration metadata to plans table
-- This stores connection information for integration plans (calendar connections, etc.)

-- Add integration_metadata jsonb column to store integration-specific data
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS integration_metadata jsonb;

-- Add index for querying integration plans by connection_id
CREATE INDEX IF NOT EXISTS idx_plans_integration_connection_id 
  ON public.plans USING gin ((integration_metadata->>'connection_id'))
  WHERE plan_type = 'integration' AND integration_metadata IS NOT NULL;

-- Add index for querying by provider
CREATE INDEX IF NOT EXISTS idx_plans_integration_provider 
  ON public.plans USING gin ((integration_metadata->>'provider'))
  WHERE plan_type = 'integration' AND integration_metadata IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.plans.integration_metadata IS 
  'JSONB metadata for integration plans. Structure: { connection_id: uuid, provider: string, calendar_ids: string[], calendar_names: string[] }';

