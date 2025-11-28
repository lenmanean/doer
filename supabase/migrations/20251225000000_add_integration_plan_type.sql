-- Migration: Add 'integration' plan type for calendar integration plans
-- This allows calendar events to be stored as tasks in dedicated integration plans

-- Drop existing constraint if it exists
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_plan_type_check;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_type_check;

-- Add new constraint that includes 'integration' type
ALTER TABLE public.plans
ADD CONSTRAINT plans_plan_type_check
CHECK (plan_type IN ('ai', 'manual', 'integration'));

-- Add comment explaining the new type
COMMENT ON COLUMN public.plans.plan_type IS 
  'Plan type: ai (AI-generated), manual (user-created), or integration (calendar/integration sync)';

