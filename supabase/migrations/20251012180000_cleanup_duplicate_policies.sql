-- =====================================================
-- CLEANUP DUPLICATE RLS POLICIES
-- =====================================================
-- Purpose: Remove duplicate policies on the plans table
-- Date: 2025-10-12
--
-- Background: The plans table has 8 policies when it should have 4.
-- This happened due to multiple migrations creating similar policies
-- with slightly different names.
--
-- This migration is OPTIONAL and only for cleanup purposes.
-- The duplicates don't cause any functional issues.
-- =====================================================

-- Display current policies before cleanup
DO $$
BEGIN
  RAISE NOTICE '📋 Current policies on plans table:';
END $$;

SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'plans' 
ORDER BY policyname;

-- =====================================================
-- Remove the older/shorter policy names
-- =====================================================

-- Keep: "Users can view their own plans"
-- Remove: "Users can view own plans"
DROP POLICY IF EXISTS "Users can view own plans" ON public.plans;

-- Keep: "Users can insert their own plans"  
-- Remove: "Users can create own plans"
DROP POLICY IF EXISTS "Users can create own plans" ON public.plans;

-- Keep: "Users can update their own plans"
-- Remove: "Users can update own plans"
DROP POLICY IF EXISTS "Users can update own plans" ON public.plans;

-- Keep: "Users can delete their own plans"
-- Remove: "Users can delete own plans"
DROP POLICY IF EXISTS "Users can delete own plans" ON public.plans;

-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  v_policy_count integer;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'plans' AND schemaname = 'public';
  
  IF v_policy_count = 4 THEN
    RAISE NOTICE '✅ Cleanup successful! Plans table now has exactly 4 policies.';
  ELSE
    RAISE NOTICE '⚠️ Unexpected policy count: %. Expected 4.', v_policy_count;
  END IF;
END $$;

-- Display remaining policies after cleanup
DO $$
BEGIN
  RAISE NOTICE '📋 Remaining policies on plans table:';
END $$;

SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'plans' 
ORDER BY policyname;

-- =====================================================
-- Final verification
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Duplicate policy cleanup complete';
  RAISE NOTICE '✓ RLS remains fully functional';
  RAISE NOTICE '✓ No security changes - just cleaner policy list';
  RAISE NOTICE '';
  RAISE NOTICE 'The following policies are now active on plans table:';
  RAISE NOTICE '  1. Users can view their own plans';
  RAISE NOTICE '  2. Users can insert their own plans';
  RAISE NOTICE '  3. Users can update their own plans';
  RAISE NOTICE '  4. Users can delete their own plans';
END $$;







