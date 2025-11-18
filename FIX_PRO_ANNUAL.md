# Fix Pro Annual Plan Configuration

## Issue
The Pro Annual plan is not working - shows "Billing plan cycle "pro" (annual) not found" error.

## Root Cause
The Pro Annual billing plan cycle is missing from the `billing_plan_cycles` table in the database.

## Solution

### Step 1: Check Database
1. Go to Supabase Dashboard → Table Editor
2. Navigate to `billing_plans` table
3. Verify "pro" plan exists (should have slug = 'pro')
4. Navigate to `billing_plan_cycles` table
5. Check if there's a row with:
   - `billing_plan_id` = (ID of pro plan)
   - `cycle` = 'annual'

### Step 2: Create Pro Annual Plan Cycle (if missing)
If the Pro Annual plan cycle doesn't exist, you need to create it:

```sql
-- First, get the Pro plan ID
SELECT id FROM billing_plans WHERE slug = 'pro';

-- Then insert the annual cycle (replace <PRO_PLAN_ID> with the ID from above)
INSERT INTO billing_plan_cycles (
  billing_plan_id,
  cycle,
  api_credit_limit,
  integration_action_limit,
  price_cents,
  metadata
) VALUES (
  '<PRO_PLAN_ID>',  -- Replace with actual Pro plan ID
  'annual',
  100,  -- API credits per month (or adjust as needed)
  3000,  -- Integration actions per month (or adjust as needed)
  20000,  -- Price in cents ($200.00) - adjust as needed
  '{}'::jsonb
);
```

### Step 3: Verify Stripe Price ID
Ensure `STRIPE_PRICE_PRO_ANNUAL` environment variable is set:
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Verify `STRIPE_PRICE_PRO_ANNUAL` is set to the correct Stripe price ID
3. The price ID should match a Stripe price with:
   - Product: Pro Plan
   - Billing period: Annual (yearly)
   - Amount: $200.00 (or your annual price)

### Step 4: Verify Consistency
Ensure Pro Annual has the same implementation as Pro Monthly:
- Same API credit limits
- Same integration action limits
- Properly linked to Stripe price
- Metadata configured correctly

## Expected Database State

### billing_plans table should have:
- Row with `slug = 'pro'` and `name = 'Pro Plan'` (or similar)

### billing_plan_cycles table should have TWO rows for Pro:
1. **Pro Monthly:**
   - `billing_plan_id` = (Pro plan ID)
   - `cycle` = 'monthly'
   - `price_cents` = 2000 (or your monthly price)
   
2. **Pro Annual:**
   - `billing_plan_id` = (Pro plan ID)
   - `cycle` = 'annual'
   - `price_cents` = 20000 (or your annual price)

## Testing
After fixing:
1. Try accessing `/checkout?plan=pro&cycle=annual`
2. Should load without errors
3. Should show correct pricing and limits
4. Should allow checkout to proceed

