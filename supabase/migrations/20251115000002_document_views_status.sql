-- Migration: Document status of database views
-- Analyze which views are actively used vs potentially legacy

-- ============================================================================
-- VIEWS ANALYSIS
-- ============================================================================

-- 1. v_plan_health - ACTIVE
--    Status: Actively used by dashboard and health tracking system
--    Dependencies: plans, health_snapshots (both active tables)
--    Action: KEEP - This view is essential for plan health metrics

-- 2. user_usage_summary - POTENTIALLY UNUSED
--    Status: Created for usage tracking but not found in application code
--    Dependencies: plan_usage_balances, billing_plan_cycles (both active)
--    Action: Document as potentially unused, but keep for future use
--    Note: This view could be useful for admin dashboards or usage reporting

-- ============================================================================
-- ADD COMMENTS TO VIEWS
-- ============================================================================

-- Confirm v_plan_health is active
COMMENT ON VIEW public.v_plan_health IS 
  'ACTIVE: Plan health metrics view used by dashboard and health tracking system. 
   Aggregates data from plans and health_snapshots tables. 
   DO NOT REMOVE - Essential for plan health functionality.';

-- Mark user_usage_summary as potentially unused but useful
COMMENT ON VIEW public.user_usage_summary IS 
  'POTENTIALLY UNUSED: Aggregated view of per-user usage balances. 
   Created for usage tracking but not currently queried in application code.
   May be useful for:
   - Admin dashboards
   - Usage reporting
   - Future analytics features
   Keep for now - could be valuable for future features.';

-- ============================================================================
-- RECOMMENDATION
-- ============================================================================

-- v_plan_health: KEEP - Actively used
-- user_usage_summary: KEEP - Potentially useful for future features, no harm in keeping
-- 
-- Both views are lightweight (just SELECT statements) and don't consume storage.
-- Keeping them doesn't impact performance significantly.
-- 
-- If user_usage_summary remains unused after 6 months, consider removing it.

