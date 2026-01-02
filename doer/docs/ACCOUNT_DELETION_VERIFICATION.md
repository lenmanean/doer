# Account Deletion Verification Checklist

This document provides a comprehensive checklist for verifying that account deletion works correctly, including Stripe cleanup and database deletion.

## Pre-Deletion Setup

1. [ ] Create a test account in the application
2. [ ] Create a Stripe customer for the test account (via subscription or checkout)
3. [ ] Create an active subscription in Stripe
4. [ ] Add a payment method to the Stripe customer
5. [ ] Create some test data in DOER (plans, tasks, etc.)
6. [ ] Note the user ID and Stripe customer ID for verification

## During Deletion

1. [ ] Navigate to Settings > Delete Account
2. [ ] Verify the confirmation modal shows:
   - Warning about permanent deletion
   - List of what will be deleted
   - Information about Stripe data retention
   - Confirmation input field
3. [ ] Type "DELETE" to confirm
4. [ ] Click "Delete My Account"
5. [ ] Verify the request completes (should return success response)

## Post-Deletion Verification

### Stripe Dashboard Verification

1. [ ] Navigate to Stripe Dashboard > Customers
2. [ ] Search for the test customer ID
3. [ ] Verify customer shows `deleted: true` flag
4. [ ] Verify all subscriptions show status `canceled`
5. [ ] Verify no payment methods are listed for the customer
6. [ ] Verify customer metadata still contains `userId` (for audit trail)

**Screenshot locations:**
- Customer detail page showing `deleted: true`
- Subscriptions list showing all canceled
- Payment methods list (should be empty)

### Supabase Database Verification

1. [ ] Connect to Supabase database (via CLI or Dashboard)
2. [ ] Verify `auth.users` record is deleted:
   ```sql
   SELECT * FROM auth.users WHERE id = '<user_id>';
   -- Should return no rows
   ```
3. [ ] Verify `user_settings` record is deleted:
   ```sql
   SELECT * FROM user_settings WHERE user_id = '<user_id>';
   -- Should return no rows
   ```
4. [ ] Verify `user_plan_subscriptions` records are deleted:
   ```sql
   SELECT * FROM user_plan_subscriptions WHERE user_id = '<user_id>';
   -- Should return no rows
   ```
5. [ ] Verify `plan_usage_balances` records are deleted:
   ```sql
   SELECT * FROM plan_usage_balances WHERE user_id = '<user_id>';
   -- Should return no rows
   ```
6. [ ] Verify `usage_ledger` records are deleted:
   ```sql
   SELECT * FROM usage_ledger WHERE user_id = '<user_id>';
   -- Should return no rows
   ```
7. [ ] Verify all user plans are deleted:
   ```sql
   SELECT * FROM plans WHERE user_id = '<user_id>';
   -- Should return no rows
   ```
8. [ ] Verify all user tasks are deleted:
   ```sql
   SELECT * FROM tasks WHERE user_id = '<user_id>';
   -- Should return no rows
   ```
9. [ ] Verify `account_deletion_audit` record exists:
   ```sql
   SELECT * FROM account_deletion_audit WHERE user_id = '<user_id>';
   -- Should return one row with status 'completed' or 'partial'
   ```

### Audit Log Verification

1. [ ] Check `account_deletion_audit` table:
   ```sql
   SELECT 
     id,
     user_id,
     stripe_customer_id,
     status,
     stripe_cleanup_status,
     subscriptions_canceled,
     payment_methods_detached,
     customer_deleted,
     deletion_initiated_at,
     deletion_completed_at,
     error_details
   FROM account_deletion_audit
   WHERE user_id = '<user_id>';
   ```
2. [ ] Verify `status` is `'completed'` or `'partial'`
3. [ ] Verify `stripe_cleanup_status` is `'completed'` or `'skipped'`
4. [ ] Verify `customer_deleted` is `true` (if Stripe customer existed)
5. [ ] Verify `subscriptions_canceled` matches expected count
6. [ ] Verify `payment_methods_detached` matches expected count
7. [ ] Verify `deletion_completed_at` is set
8. [ ] Verify `error_details` is empty or contains expected errors

### Server Logs Verification

1. [ ] Check Vercel server logs (or your logging service)
2. [ ] Verify structured logs show:
   - `account_deletion` event with `step: 'subscription_cancel'` and `status: 'started'`
   - `account_deletion` event with `step: 'subscription_cancel'` and `status: 'completed'`
   - `account_deletion` event with `step: 'payment_method_detach'` and `status: 'completed'`
   - `account_deletion` event with `step: 'customer_delete'` and `status: 'completed'`
   - `account_deletion` event with `step: 'db_cleanup'` and `status: 'completed'`
   - `account_deletion` event with `step: 'auth_delete'` and `status: 'completed'`
3. [ ] Verify no errors in logs (except expected warnings for missing data)
4. [ ] Verify sensitive data (Stripe keys) are masked in logs

### Webhook Verification

1. [ ] Send a test webhook for the deleted customer:
   ```bash
   # Use Stripe CLI or webhook testing tool
   stripe trigger customer.subscription.updated --customer <customer_id>
   ```
2. [ ] Verify webhook handler logs show:
   - Customer is deleted
   - Webhook is ignored
   - No database updates occur

### User Experience Verification

1. [ ] Verify user is signed out after deletion
2. [ ] Verify user cannot log in with deleted account
3. [ ] Verify user receives success message (or partial success message if Stripe cleanup failed)
4. [ ] If partial success, verify message explains Stripe cleanup will be completed manually

## Edge Case Testing

### Test Case 1: User with No Stripe Customer

1. [ ] Create account without Stripe customer
2. [ ] Delete account
3. [ ] Verify:
   - Stripe cleanup is skipped
   - `stripe_cleanup_status` is `'skipped'`
   - DOER data is deleted
   - Account deletion succeeds

### Test Case 2: User with Multiple Subscriptions

1. [ ] Create account with multiple active subscriptions
2. [ ] Delete account
3. [ ] Verify:
   - All subscriptions are canceled
   - `subscriptions_canceled` count matches
   - Customer is deleted

### Test Case 3: User with Past-Due Subscription

1. [ ] Create account with past-due subscription
2. [ ] Delete account
3. [ ] Verify:
   - Past-due subscription is canceled
   - Customer is deleted

### Test Case 4: Stripe API Outage Simulation

1. [ ] Temporarily block Stripe API access (or use invalid key)
2. [ ] Attempt account deletion
3. [ ] Verify:
   - DOER deletion still succeeds
   - Audit log shows `stripe_cleanup_status: 'failed'`
   - User receives partial success message
   - Admin can retry cleanup via admin route

### Test Case 5: Idempotency

1. [ ] Delete account successfully
2. [ ] Attempt to delete again (if possible via admin route)
3. [ ] Verify:
   - Cleanup function handles already-deleted customer gracefully
   - No errors occur
   - Returns success status

## Admin Remediation Testing

1. [ ] Use admin route to retry Stripe cleanup:
   ```bash
   curl -X POST https://your-domain.com/api/admin/account-deletion/retry-stripe-cleanup \
     -H "Authorization: Bearer <ADMIN_API_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"userId": "<user_id>"}'
   ```
2. [ ] Verify:
   - Request requires admin authorization
   - Stripe cleanup is retried
   - Audit log is updated
   - Response shows cleanup results

## Feature Flag Testing

1. [ ] Set `ENABLE_STRIPE_ACCOUNT_DELETION=false`
2. [ ] Delete account
3. [ ] Verify:
   - Stripe cleanup is skipped
   - `stripe_cleanup_status` is `'skipped'`
   - DOER data is deleted
   - Account deletion succeeds

4. [ ] Set `ENABLE_STRIPE_ACCOUNT_DELETION=true`
5. [ ] Delete account
6. [ ] Verify:
   - Stripe cleanup runs
   - Customer is deleted
   - Full deletion succeeds

## Documentation

After verification, document:
- [ ] Screenshots of Stripe Dashboard showing deleted customer
- [ ] SQL query results showing deleted data
- [ ] Audit log entry details
- [ ] Any issues encountered and resolutions
- [ ] Performance metrics (deletion time, API call counts)

## Rollback Plan Verification

If issues are detected:
1. [ ] Disable feature flag immediately
2. [ ] Check audit logs for affected users
3. [ ] Use admin route to manually complete Stripe cleanup
4. [ ] Verify Stripe Dashboard shows correct state
5. [ ] Document issues and resolutions

