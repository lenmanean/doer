-- Migration: Enable RLS and tighten grants for user_plan_subscriptions

ALTER TABLE IF EXISTS public.user_plan_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users insert their subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users update their subscriptions" ON public.user_plan_subscriptions;
DROP POLICY IF EXISTS "Users delete their subscriptions" ON public.user_plan_subscriptions;

CREATE POLICY "Users view their subscriptions"
  ON public.user_plan_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their subscriptions"
  ON public.user_plan_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their subscriptions"
  ON public.user_plan_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their subscriptions"
  ON public.user_plan_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

REVOKE ALL ON public.user_plan_subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plan_subscriptions TO authenticated;
GRANT ALL ON public.user_plan_subscriptions TO service_role;

