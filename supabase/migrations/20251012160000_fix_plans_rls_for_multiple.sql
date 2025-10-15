-- Migration: Fix RLS Policies for Multiple Plans Support
-- Purpose: Ensure users can update plan status and create multiple plans
-- Date: 2025-10-12

-- ============================================================
-- Step 1: Drop existing RLS policies if they're too restrictive
-- ============================================================

-- Drop existing policies (they'll be recreated with proper permissions)
DROP POLICY IF EXISTS "Users can view own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can create own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can update own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can delete own plans" ON public.plans;

-- ============================================================
-- Step 2: Create comprehensive RLS policies for plans
-- ============================================================

-- Allow users to view their own plans
CREATE POLICY "Users can view own plans"
ON public.plans
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to create their own plans
CREATE POLICY "Users can create own plans"
ON public.plans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own plans (including status changes)
CREATE POLICY "Users can update own plans"
ON public.plans
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own plans
CREATE POLICY "Users can delete own plans"
ON public.plans
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================
-- Step 3: Ensure unique constraint doesn't block new plans
-- ============================================================

-- The unique index only prevents multiple active plans, which is correct
-- But we need to make sure the constraint name is clear
DO $$
BEGIN
  -- Check if constraint exists and recreate with proper name if needed
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_one_active_plan_per_user'
  ) THEN
    RAISE NOTICE '✓ Unique active plan constraint exists';
  ELSE
    -- Create the unique index if it doesn't exist
    CREATE UNIQUE INDEX idx_one_active_plan_per_user 
    ON public.plans(user_id) 
    WHERE status = 'active';
    RAISE NOTICE '✓ Created unique active plan constraint';
  END IF;
END $$;

-- ============================================================
-- Step 4: Grant necessary permissions for RPC functions
-- ============================================================

-- Ensure authenticated users can execute RPC functions
GRANT EXECUTE ON FUNCTION public.switch_active_plan TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_plan TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_plans TO authenticated;

-- ============================================================
-- Step 5: Verify plan table permissions
-- ============================================================

-- Ensure authenticated users have proper table access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;

-- ============================================================
-- Verification
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✓ RLS policies recreated for plans table';
  RAISE NOTICE '✓ Multiple active plans prevented by partial unique index';
  RAISE NOTICE '✓ Users can create, view, update, and delete their own plans';
  RAISE NOTICE '✓ Status changes permitted for plan owners';
  RAISE NOTICE '✓ RPC functions granted to authenticated users';
  RAISE NOTICE '';
  RAISE NOTICE 'Multiple plans support RLS policies are now configured!';
END $$;





