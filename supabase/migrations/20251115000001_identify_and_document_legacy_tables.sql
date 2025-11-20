-- Migration: Identify and document legacy/unused tables
-- Some tables may be referenced in delete functions but not actively used in the application

-- ============================================================================
-- LEGACY TABLES ANALYSIS
-- ============================================================================

-- 1. user_plan_subscriptions - DEPRECATED (Stripe is now source of truth)
--    Status: Deprecated but kept for backward compatibility
--    Action: Already marked as deprecated in previous migration
--    Can be removed in future after confirming no active references

-- 2. user_progress - POTENTIALLY LEGACY
--    Status: Only referenced in delete functions, not in active code
--    Action: Document as potentially unused, investigate before removal

-- 3. analytics_snapshots - POTENTIALLY LEGACY  
--    Status: Only referenced in delete functions, not in active code
--    Action: Document as potentially unused, investigate before removal

-- 4. milestones - POTENTIALLY LEGACY
--    Status: Referenced in delete functions and old migrations
--    Comment in get_user_plans says "milestones removed"
--    Action: Document as potentially unused, investigate before removal

-- ============================================================================
-- ACTIVE TABLES (DO NOT REMOVE)
-- ============================================================================

-- health_snapshots - ACTIVE (used by v_plan_health view and capture_health_snapshot function)
-- All other tables visible in Supabase dashboard are actively used

-- ============================================================================
-- ADD COMMENTS TO POTENTIALLY LEGACY TABLES
-- ============================================================================

-- Mark user_progress as potentially legacy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_progress') THEN
    COMMENT ON TABLE public.user_progress IS 
      'POTENTIALLY LEGACY: Only referenced in delete functions. Not actively used in application code. 
       Investigate usage before removal.';
  END IF;
END $$;

-- Mark analytics_snapshots as potentially legacy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_snapshots') THEN
    COMMENT ON TABLE public.analytics_snapshots IS 
      'POTENTIALLY LEGACY: Only referenced in delete functions. Not actively used in application code. 
       Investigate usage before removal.';
  END IF;
END $$;

-- Mark milestones as potentially legacy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'milestones') THEN
    COMMENT ON TABLE public.milestones IS 
      'POTENTIALLY LEGACY: Referenced in delete functions but not in active application code. 
       Comment in get_user_plans function says "milestones removed". 
       Investigate usage before removal.';
  END IF;
END $$;

-- ============================================================================
-- RECOMMENDATION FOR FUTURE CLEANUP
-- ============================================================================

-- Before removing any potentially legacy tables:
-- 1. Check Supabase dashboard for any data in these tables
-- 2. Search codebase for any indirect references (views, functions, triggers)
-- 3. Check if any external integrations or cron jobs use these tables
-- 4. Create a backup before removal
-- 5. Remove in order: milestones -> analytics_snapshots -> user_progress -> user_plan_subscriptions

-- Note: user_plan_subscriptions should be kept until we're 100% certain
-- no code paths use it as a fallback (currently used in reset_usage_cycle fallback)




