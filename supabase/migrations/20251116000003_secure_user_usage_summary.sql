-- Migration: Harden user_usage_summary view and restrict grants
CREATE OR REPLACE VIEW public.user_usage_summary
WITH (security_invoker = true) AS
SELECT
  bub.user_id,
  bub.metric,
  bub.cycle_start,
  bub.cycle_end,
  bub.allocation,
  bub.used,
  bub.reserved,
  (bub.allocation - bub.used - bub.reserved) AS available,
  bpc.cycle AS billing_cycle
FROM public.plan_usage_balances bub
JOIN public.billing_plan_cycles bpc
  ON bpc.id = bub.billing_plan_cycle_id;

COMMENT ON VIEW public.user_usage_summary IS
  'Aggregated view of per-user usage balances. Runs with invoker privileges to honor table RLS.';

REVOKE ALL ON public.user_usage_summary FROM anon;
GRANT SELECT ON public.user_usage_summary TO authenticated;
GRANT SELECT ON public.user_usage_summary TO service_role;

