-- Migration: Fix RLS performance issues and consolidate duplicate policies
-- This migration addresses:
-- 1. Auth RLS initialization plan issues (wrap auth.uid() and auth.role() in subqueries)
-- 2. Multiple permissive policies (consolidate duplicate policies)
-- 3. Duplicate indexes (remove redundant index)
-- 4. Unindexed foreign keys (add indexes on foreign key columns)

-- ============================================================================
-- 1. FIX AUTH RLS INITIALIZATION PLAN ISSUES
-- ============================================================================
-- Replace auth.uid() and auth.role() with (select auth.uid()) and (select auth.role())
-- This ensures they're evaluated once per query rather than per row

-- API TOKENS
DROP POLICY IF EXISTS "Users manage own API tokens" ON public.api_tokens;
CREATE POLICY "Users manage own API tokens"
  ON public.api_tokens
  USING ((select auth.uid()) = user_id AND revoked_at IS NULL)
  WITH CHECK ((select auth.uid()) = user_id);

-- PLAN USAGE BALANCES
DROP POLICY IF EXISTS "Users can view their usage balances" ON public.plan_usage_balances;
CREATE POLICY "Users can view their usage balances"
  ON public.plan_usage_balances
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages usage balances" ON public.plan_usage_balances;
CREATE POLICY "Service role manages usage balances"
  ON public.plan_usage_balances
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- USAGE LEDGER
DROP POLICY IF EXISTS "Users can view their usage ledger" ON public.usage_ledger;
CREATE POLICY "Users can view their usage ledger"
  ON public.usage_ledger
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages usage ledger" ON public.usage_ledger;
CREATE POLICY "Service role manages usage ledger"
  ON public.usage_ledger
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- USER PLAN SUBSCRIPTIONS
-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users view their subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users insert their subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users update their subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users delete their subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Service role manages all subscriptions" ON public.user_plan_subscriptions;

-- Create consolidated policies (one per operation, no duplicates)
CREATE POLICY "Users can view their own subscriptions"
  ON public.user_plan_subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.user_plan_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.user_plan_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.user_plan_subscriptions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role manages all subscriptions"
  ON public.user_plan_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- EMAIL CHANGE REQUESTS
DROP POLICY IF EXISTS "Users can view their email change requests" ON public.email_change_requests;
DROP POLICY IF EXISTS "Users can create their email change requests" ON public.email_change_requests;
DROP POLICY IF EXISTS "Users can update their email change requests" ON public.email_change_requests;
DROP POLICY IF EXISTS "Users can delete their email change requests" ON public.email_change_requests;
DROP POLICY IF EXISTS "Service role manages email change requests" ON public.email_change_requests;

-- Create consolidated policies (no duplicates - service role policy should not overlap with user policies)
CREATE POLICY "Users can view their email change requests"
  ON public.email_change_requests
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create their email change requests"
  ON public.email_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their email change requests"
  ON public.email_change_requests
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their email change requests"
  ON public.email_change_requests
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Service role policy should be restrictive to service_role only to avoid overlap
CREATE POLICY "Service role manages email change requests"
  ON public.email_change_requests
  FOR ALL
  TO service_role
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- EMAIL CHANGE AUDIT
DROP POLICY IF EXISTS "Users can view their email audit" ON public.email_change_audit;
DROP POLICY IF EXISTS "Service role manages email audit" ON public.email_change_audit;

CREATE POLICY "Users can view their email audit"
  ON public.email_change_audit
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Service role policy should be restrictive to service_role only
CREATE POLICY "Service role manages email audit"
  ON public.email_change_audit
  FOR ALL
  TO service_role
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- USERNAME CHANGE AUDIT
DROP POLICY IF EXISTS "Users can view their username audit" ON public.username_change_audit;
DROP POLICY IF EXISTS "Service role manages username audit" ON public.username_change_audit;

CREATE POLICY "Users can view their username audit"
  ON public.username_change_audit
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Service role policy should be restrictive to service_role only
CREATE POLICY "Service role manages username audit"
  ON public.username_change_audit
  FOR ALL
  TO service_role
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ============================================================================
-- 2. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================
-- Foreign keys should have indexes to improve query performance
-- This is especially important for joins and foreign key constraint checks

-- API TOKENS
-- Index on user_id FK (for FK constraint checks and joins)
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id
  ON public.api_tokens (user_id);

-- Index on billing_plan_cycle_id FK (nullable, so use partial index)
CREATE INDEX IF NOT EXISTS idx_api_tokens_billing_plan_cycle_id
  ON public.api_tokens (billing_plan_cycle_id)
  WHERE billing_plan_cycle_id IS NOT NULL;

-- PLAN USAGE BALANCES
-- Index on billing_plan_cycle_id FK (nullable, so use partial index)
CREATE INDEX IF NOT EXISTS idx_plan_usage_balances_billing_plan_cycle_id
  ON public.plan_usage_balances (billing_plan_cycle_id)
  WHERE billing_plan_cycle_id IS NOT NULL;

-- USAGE LEDGER
-- Index on billing_plan_cycle_id FK (nullable, so use partial index)
CREATE INDEX IF NOT EXISTS idx_usage_ledger_billing_plan_cycle_id
  ON public.usage_ledger (billing_plan_cycle_id)
  WHERE billing_plan_cycle_id IS NOT NULL;

-- Index on token_id FK (nullable, so use partial index)
CREATE INDEX IF NOT EXISTS idx_usage_ledger_token_id
  ON public.usage_ledger (token_id)
  WHERE token_id IS NOT NULL;

-- USER PLAN SUBSCRIPTIONS
-- Index on billing_plan_cycle_id FK (NOT NULL, so regular index)
CREATE INDEX IF NOT EXISTS idx_user_plan_subscriptions_billing_plan_cycle_id
  ON public.user_plan_subscriptions (billing_plan_cycle_id);

-- EMAIL CHANGE AUDIT
-- Check if user_id index exists
CREATE INDEX IF NOT EXISTS idx_email_change_audit_user_id
  ON public.email_change_audit (user_id);

-- USERNAME CHANGE AUDIT
-- Check if user_id index exists
CREATE INDEX IF NOT EXISTS idx_username_change_audit_user_id
  ON public.username_change_audit (user_id);

-- ============================================================================
-- 3. REMOVE DUPLICATE INDEXES
-- ============================================================================
-- Remove the duplicate index - keep idx_user_plan_subscriptions_user_status
-- as it's more descriptive and was created in the later migration
DROP INDEX IF EXISTS public.user_plan_subscriptions_user_idx;

-- ============================================================================
-- 4. DOCUMENT UNUSED INDEXES
-- ============================================================================
-- The following indexes have been reported as unused by the database linter.
-- These are INFO-level warnings - indexes may be needed for future queries
-- or during specific operations. Consider monitoring these and removing if
-- they remain unused over time:
--
-- - idx_plans_end_date on public.plans
-- - idx_tasks_duration on public.tasks
-- - idx_task_schedule_start_time on public.task_schedule
-- - idx_health_snapshots_created_at on public.health_snapshots
-- - idx_task_schedule_pending_reschedule on public.task_schedule
-- - idx_pending_reschedules_plan_id on public.pending_reschedules
-- - idx_user_plan_subscriptions_external_subscription_id on public.user_plan_subscriptions
-- - idx_plans_user_status on public.plans
-- - idx_task_schedule_status on public.task_schedule
-- - idx_user_settings_phone_number on public.user_settings
-- - idx_user_plan_subscriptions_user_status on public.user_plan_subscriptions
-- - idx_billing_plan_cycles_billing_plan_id on public.billing_plan_cycles
-- - idx_billing_plans_active on public.billing_plans
-- - idx_user_settings_stripe_customer_id on public.user_settings
-- - idx_pending_reschedules_user_plan on public.pending_reschedules
-- - idx_user_settings_avatar_url on public.user_settings
-- - idx_scheduling_history_adjustment_date on public.scheduling_history
--
-- Note: We're keeping these indexes for now as they may be needed for future
-- queries or optimization. They can be removed in a future migration if they
-- remain unused.

-- ============================================================================
-- 5. VERIFY NO DUPLICATE POLICIES REMAIN
-- ============================================================================
-- This DO block will warn if there are still multiple permissive policies
DO $$
DECLARE
  pol_record RECORD;
  pol_count INTEGER;
BEGIN
  FOR pol_record IN
    SELECT 
      schemaname,
      tablename,
      policyname,
      roles,
      cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_plan_subscriptions',
        'api_tokens',
        'plan_usage_balances',
        'usage_ledger',
        'email_change_requests',
        'email_change_audit',
        'username_change_audit'
      )
  LOOP
    SELECT COUNT(*)
    INTO pol_count
    FROM pg_policies p1
    WHERE p1.schemaname = pol_record.schemaname
      AND p1.tablename = pol_record.tablename
      AND p1.cmd = pol_record.cmd
      AND p1.roles && pol_record.roles  -- Overlap check
      AND p1.permissive = 'PERMISSIVE';  -- Only check permissive policies
    
    IF pol_count > 1 THEN
      RAISE WARNING 'Multiple permissive policies found for table % operation %', 
        pol_record.tablename, pol_record.cmd;
    END IF;
  END LOOP;
END $$;

