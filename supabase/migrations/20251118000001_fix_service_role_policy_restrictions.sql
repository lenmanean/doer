-- Migration: Fix service role policy restrictions
-- The service role policies for plan_usage_balances and usage_ledger
-- were missing TO service_role restrictions, causing them to be evaluated
-- for all roles and triggering multiple permissive policy warnings.

-- ============================================================================
-- FIX SERVICE ROLE POLICY RESTRICTIONS
-- ============================================================================

-- PLAN USAGE BALANCES
DROP POLICY IF EXISTS "Service role manages usage balances" ON public.plan_usage_balances;
CREATE POLICY "Service role manages usage balances"
  ON public.plan_usage_balances
  FOR ALL
  TO service_role
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- USAGE LEDGER
DROP POLICY IF EXISTS "Service role manages usage ledger" ON public.usage_ledger;
CREATE POLICY "Service role manages usage ledger"
  ON public.usage_ledger
  FOR ALL
  TO service_role
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

