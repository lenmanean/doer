-- Update Pro Annual plan price from $192/yr to $160/yr (33% discount)
-- This reflects the actual Stripe pricing: $20/mo × 12 = $240/yr, but charging $160/yr = 33% discount

UPDATE public.billing_plan_cycles
SET 
  price_cents = 16000,  -- $160.00 in cents
  updated_at = now()
WHERE 
  billing_plan_id = (SELECT id FROM public.billing_plans WHERE slug = 'pro')
  AND cycle = 'annual';

COMMENT ON COLUMN public.billing_plan_cycles.price_cents IS 'Price in cents. Pro Annual: $160/yr (33% discount from $240/yr monthly equivalent)';

