# Subscription Issues and Fixes

## Issues Identified

### 1. **Billing Plans Not Seeded in Database**
**Problem:** The `billing_plans` and `billing_plan_cycles` tables were empty, causing the error:
```
Error: Billing plan with slug "pro" not found. Available plans: none
```

**Root Cause:** The migration that creates the billing tables (`20251111010000_add_billing_usage_and_api_tokens.sql`) includes seed data, but it appears the seed data wasn't applied or was removed.

**Fix Applied:**
- Created migration `20251114000000_ensure_billing_plans_seeded.sql` that ensures:
  - Basic plan (monthly, free)
  - Pro plan (monthly, $20/mo)
  - Pro plan (annual, $160/yr)
- Migration is idempotent (can be run multiple times safely)
- Applied to remote database

### 2. **Subscription Not Saved After Payment**
**Problem:** User completes payment successfully, but subscription doesn't appear in settings page.

**Root Cause:** 
- When `assignSubscription()` is called, it tries to fetch the billing plan
- Since plans weren't seeded, `fetchPlanBySlug('pro')` fails
- The error is caught and logged, but subscription is never saved
- The checkout route catches the error and continues (expecting webhook to handle it)
- But webhook also fails with the same error

**Fix Applied:**
- Billing plans are now seeded, so `assignSubscription()` should work
- However, existing subscriptions that failed to save need to be recovered

### 3. **Settings Page Timeout**
**Problem:** Settings page times out when trying to load, authentication fails.

**Root Cause:**
- `useOnboardingProtection` hook fetches profile from `user_settings` table
- The query hangs indefinitely (no timeout)
- This blocks the entire page from loading

**Fix Applied:**
- Added `Promise.race()` with 3-second timeout to profile fetch
- If timeout occurs, uses fallback profile data
- Page can now load even if profile fetch fails

### 4. **Authentication Inconsistencies**
**Problem:** User authentication state becomes inconsistent after checkout.

**Root Cause:**
- Multiple auth state checks happening simultaneously
- Profile fetch hanging causes auth state to appear invalid
- No proper error recovery

**Fix Applied:**
- Improved timeout handling in profile fetches
- Better error recovery with fallback data

## Next Steps Required

### 1. **Recovery Mechanism for Missing Subscriptions**
Since subscriptions may have been created in Stripe but not saved to the database, we need to:

1. **Check Stripe for existing subscriptions** for users who completed checkout
2. **Manually assign subscriptions** using the Stripe subscription data
3. **Create an API endpoint** to sync Stripe subscriptions to database

### 2. **Verify Current Subscription Status**
For the user who just completed payment:
- Check if subscription exists in `user_plan_subscriptions` table
- If not, check Stripe for the subscription
- If found in Stripe, manually create the database record

### 3. **Improve Error Handling**
- Surface subscription assignment errors to the user (currently silent)
- Add retry mechanism for failed subscription assignments
- Better logging and monitoring

### 4. **Database Verification**
Run this query to check if subscriptions exist:
```sql
SELECT 
  ups.id,
  ups.user_id,
  ups.status,
  ups.external_subscription_id,
  ups.external_customer_id,
  bpc.cycle,
  bp.slug,
  bp.name
FROM user_plan_subscriptions ups
JOIN billing_plan_cycles bpc ON bpc.id = ups.billing_plan_cycle_id
JOIN billing_plans bp ON bp.id = bpc.billing_plan_id
WHERE ups.user_id = 'fc647a96-4b93-43ae-a903-35dab01fc0e0';
```

## Files Modified

1. `supabase/migrations/20251114000000_ensure_billing_plans_seeded.sql` - New migration to seed billing plans
2. `doer/src/lib/useOnboardingProtection.ts` - Added timeout to profile fetch
3. `doer/src/app/checkout/page.tsx` - Already had timeouts and error handling

## Testing Checklist

- [ ] Verify billing plans exist in database
- [ ] Complete a new checkout flow and verify subscription is saved
- [ ] Check settings page loads without timeout
- [ ] Verify subscription appears in settings page
- [ ] Check Vercel logs for any remaining errors
- [ ] Test webhook handling for subscription updates

