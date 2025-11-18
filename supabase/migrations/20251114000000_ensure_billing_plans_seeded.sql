-- Ensure billing plans are seeded
-- This migration is idempotent and can be run multiple times safely

-- Insert or update billing plans
INSERT INTO public.billing_plans (slug, name, description, active)
VALUES
  ('basic', 'Basic', 'Free tier with limited credits', true),
  ('pro', 'Pro', 'Advanced automation and increased credit limits', true)
ON CONFLICT (slug) DO UPDATE
  SET active = true,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = now();

-- Insert or update billing plan cycles
INSERT INTO public.billing_plan_cycles (billing_plan_id, cycle, api_credit_limit, integration_action_limit, price_cents, metadata)
SELECT bp.id,
       bc.cycle,
       bc.api_limit,
       bc.integration_limit,
       bc.price_cents,
       bc.metadata
FROM (
  VALUES
    ('basic', 'monthly'::public.billing_cycle, 10, 0, 0, '{}'::jsonb),
    ('pro', 'monthly'::public.billing_cycle, 100, 3000, 2000, jsonb_build_object('stripe_price_id', 'price_pro_monthly')),
    ('pro', 'annual'::public.billing_cycle, 150, 4000, 16000, jsonb_build_object('stripe_price_id', 'price_pro_annual'))
) AS bc(plan_slug, cycle, api_limit, integration_limit, price_cents, metadata)
JOIN public.billing_plans bp ON bp.slug = bc.plan_slug
ON CONFLICT (billing_plan_id, cycle) DO UPDATE
  SET api_credit_limit = EXCLUDED.api_credit_limit,
      integration_action_limit = EXCLUDED.integration_action_limit,
      price_cents = EXCLUDED.price_cents,
      metadata = EXCLUDED.metadata,
      updated_at = now();

