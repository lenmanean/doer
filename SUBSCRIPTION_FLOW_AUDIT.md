# Complete Subscription Flow Audit

## Current Infrastructure Overview

### 1. Subscription Creation Flow
**File: `doer/src/app/checkout/page.tsx`**
1. User enters payment details
2. Setup intent confirms payment method
3. Calls `/api/checkout/create-subscription`
4. Receives `subscriptionId` and `clientSecret`
5. Confirms payment with `stripe.confirmCardPayment()`
6. If payment succeeds:
   - Waits 2 seconds
   - Calls `/api/subscription/sync-after-payment`
   - Invalidates cache
   - Redirects to success page

**File: `doer/src/app/api/checkout/create-subscription/route.ts`**
1. Validates user and plan details
2. Ensures Stripe customer exists
3. Checks for existing subscriptions (active, trialing, incomplete)
4. **IF EXISTING SUBSCRIPTION FOUND:**
   - Cancels old subscription in Stripe
   - **IMMEDIATELY marks old subscription as canceled in database**
   - Clears reference to create new one
5. Creates new subscription with `payment_behavior: 'default_incomplete'`
6. Gets invoice and payment intent
7. Returns `subscriptionId` and `clientSecret`

### 2. Payment Confirmation Flow
**File: `doer/src/app/checkout/page.tsx`**
- Payment confirmed on frontend
- Calls sync-after-payment endpoint

**File: `doer/src/app/api/subscription/sync-after-payment/route.ts`**
1. Retrieves subscription from Stripe
2. If incomplete, checks payment status
3. If payment succeeded:
   - Waits 3 seconds
   - Re-checks subscription status
   - Syncs to database

### 3. Webhook Processing Flow
**File: `doer/src/app/api/stripe/webhook/route.ts`**
- `checkout.session.completed`: Syncs subscription
- `customer.subscription.created`: Syncs subscription (SKIPS if canceled)
- `customer.subscription.updated`: Syncs subscription (SKIPS if canceled)
- `customer.subscription.deleted`: Invalidates cache
- `invoice.payment_succeeded`: Syncs subscription

### 4. Database Sync Flow
**File: `doer/src/lib/billing/subscription-sync.ts`**
1. Checks if subscription is incomplete with succeeded payment → treats as active
2. Calculates period dates if missing
3. Checks for existing subscription record
4. **IF NEW SUBSCRIPTION:**
   - If status is active/trialing:
     - Cancels other active/trialing subscriptions
     - Excludes recently canceled (within 5 seconds)
   - Inserts new subscription record
5. **IF EXISTING SUBSCRIPTION:**
   - Skips update if already canceled and trying to sync canceled
   - Otherwise updates record

### 5. UI Display Flow
**File: `doer/src/app/api/subscription/route.ts`**
- Queries Stripe directly via `getActiveSubscriptionFromStripe()`
- Returns subscription or null

**File: `doer/src/lib/stripe/subscriptions.ts`**
- Gets all subscriptions for customer
- Filters for active/trialing
- If none found, checks incomplete subscriptions with succeeded payments
- Treats incomplete with succeeded payment as active

## IDENTIFIED ISSUES

### Issue 1: Race Condition in Sync Logic
**Problem:** When syncing a new active subscription, it cancels OTHER active subscriptions. But if the old subscription's webhook fires AFTER the new subscription is synced, it can re-sync the old one as active and cancel the new one.

**Current Fix:** 
- Immediately mark old subscription as canceled in DB when canceling in Stripe
- Skip webhook processing for canceled subscriptions
- Don't update already-canceled subscriptions

**Remaining Problem:** The sync logic still has a window where this can happen.

### Issue 2: Incomplete Subscription Status
**Problem:** Subscription stays "incomplete" in Stripe even after payment succeeds.

**Current Fix:**
- Check payment status for incomplete subscriptions
- Treat incomplete with succeeded payment as active
- Sync-after-payment endpoint handles this

**Remaining Problem:** Stripe might not be updating the subscription status automatically.

### Issue 3: Both Subscriptions Being Canceled
**Problem:** Both Basic and Pro subscriptions end up as canceled in database.

**Root Cause Analysis Needed:**
- Is the sync logic canceling the wrong subscription?
- Is the webhook processing in wrong order?
- Is there a timing issue?

## RECOMMENDED FIX STRATEGY

### Option 1: Don't Cancel Old Subscription, Update It
Instead of canceling and creating new, UPDATE the existing subscription:
- Change price
- Update metadata
- Keep same subscription ID
- Avoids race conditions entirely

### Option 2: Use Stripe's Subscription Update API
Use `stripe.subscriptions.update()` instead of cancel + create:
- Updates existing subscription
- Handles proration automatically
- Maintains subscription history
- Less prone to race conditions

### Option 3: Add Transaction/Idempotency
- Use database transactions to ensure atomicity
- Add idempotency keys to prevent duplicate processing
- Lock subscription records during sync

## NEXT STEPS
1. Review which approach is best for our use case
2. Implement comprehensive fix
3. Add extensive logging to track subscription state changes
4. Test thoroughly

