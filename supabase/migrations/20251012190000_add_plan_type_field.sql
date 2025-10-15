-- Migration: Add Plan Type Field
-- Purpose: Distinguish between AI-generated and manually created plans
-- Date: 2025-10-12
--
-- Changes:
-- - Add plan_type field to plans table ('ai' or 'manual')
-- - Set default to 'ai' for backward compatibility
-- - Update existing plans to have plan_type = 'ai'

-- ============================================================
-- Step 1: Add plan_type field to plans table
-- ============================================================

ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'ai'
CHECK (plan_type IN ('ai', 'manual'));

COMMENT ON COLUMN public.plans.plan_type IS
'Type of plan: ai (AI-generated) or manual (user-created). Defaults to ai for backward compatibility.';

-- ============================================================
-- Step 2: Update existing plans to have plan_type = 'ai'
-- ============================================================

UPDATE public.plans
SET plan_type = 'ai'
WHERE plan_type IS NULL;

-- ============================================================
-- Verification
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✓ plan_type column added to plans table';
  RAISE NOTICE '✓ Check constraint added: plan_type IN (ai, manual)';
  RAISE NOTICE '✓ Existing plans updated to plan_type = ai';
  RAISE NOTICE '';
  RAISE NOTICE 'Plan type tracking is now enabled!';
  RAISE NOTICE 'The system can now distinguish between AI-generated and manually created plans.';
END $$;

