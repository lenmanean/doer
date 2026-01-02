# Account Deletion Implementation Documentation

## Overview

This document describes the implementation of Stripe customer data cleanup and account deletion handling for DOER. The implementation ensures GDPR compliance, resilience, and auditability while respecting Stripe's deletion constraints.

**Production Readiness**: ✅ This implementation is production-ready and works with **live Stripe keys** (`sk_live_*`). The code does not distinguish between test and live keys - it works identically with both. Only the integration tests are restricted to test mode to prevent accidental execution with live data.

## Architecture

### Deletion Flow

The account deletion process follows this order:

1. **Stripe Cleanup** (if enabled and customer exists):
   - Cancel all active subscriptions
   - Detach all payment methods
   - Delete/tombstone customer

2. **DOER Database Cleanup**:
   - Delete all user data (plans, tasks, schedules, etc.)
   - Delete billing records (subscriptions, usage balances, etc.)
   - Delete user settings

3. **Auth Deletion**:
   - Delete Supabase auth user (cascades handle remaining references)

### Key Components

#### 1. Stripe Cleanup Function
**File:** `doer/src/lib/stripe/account-deletion.ts`

The `cleanupStripeBillingData` function is idempotent and handles:
- Multiple subscriptions cancellation
- Payment method detachment
- Customer deletion (tombstone)
- Error handling and retry logic
- Safe re-entry (can be run multiple times)

#### 2. Account Deletion Route
**File:** `doer/src/app/api/settings/delete-account/route.ts`

Main deletion endpoint that:
- Orchestrates Stripe cleanup and database deletion
- Creates audit log entries
- Handles partial failures gracefully
- Returns appropriate user-facing messages

#### 3. Webhook Handler Updates
**File:** `doer/src/app/api/stripe/webhook/route.ts`

Updated to:
- Check if customers are deleted before processing webhooks
- Ignore webhooks for deleted customers
- Handle `customer.deleted` events

#### 4. Audit Logging
**Table:** `account_deletion_audit`

Tracks:
- Deletion initiation and completion
- Stripe cleanup status
- Counts of canceled subscriptions and detached payment methods
- Error details
- IP address and user agent

## Stripe Constraints

### What Can Be Deleted

- **Customer** (tombstone): `stripe.customers.del()` marks customer as deleted
- **Subscriptions**: Can be canceled immediately
- **Payment Methods**: Can be detached from customer

### What Cannot Be Deleted

- **Invoices**: Required for tax/accounting compliance
- **Payment Intents**: Required for dispute resolution
- **Charges**: Required for financial records
- **Tax Records**: Required for compliance

### Customer Deletion Behavior

When a customer is deleted in Stripe:
- Customer object is marked `deleted: true`
- Customer remains retrievable (tombstone)
- All payment methods are automatically detached
- Financial records are retained for compliance

## Feature Flag

The implementation uses a feature flag for gradual rollout:

- **Environment Variable**: `ENABLE_STRIPE_ACCOUNT_DELETION`
- **Default**: `false` (disabled)
- **When enabled**: Stripe cleanup runs before database deletion
- **When disabled**: Only DOER database deletion runs

## Error Handling

### Partial Failures

If Stripe cleanup fails but DOER deletion succeeds:
- User receives partial success message
- Audit log shows `stripe_cleanup_status: 'failed'`
- Admin can retry cleanup via admin route
- User account is still deleted from DOER

### Idempotency

All operations are idempotent:
- Re-running cleanup on already-deleted customer succeeds
- Already-canceled subscriptions are skipped
- Already-detached payment methods are skipped

## Admin Remediation

**Route:** `POST /api/admin/account-deletion/retry-stripe-cleanup`

Allows admins to manually retry Stripe cleanup for users:
- Requires `ADMIN_API_KEY` authorization
- Accepts `userId` or `stripeCustomerId`
- Updates audit log with retry results
- Returns detailed cleanup results

## Testing

### Unit Tests
**File:** `doer/tests/account-deletion.test.ts`

Tests cover:
- Idempotency scenarios
- Multiple subscriptions handling
- Payment method detachment
- Error handling
- Edge cases

### Integration Tests
**File:** `doer/tests/integration/stripe-deletion.test.ts`

Requires Stripe test mode API key:
- Creates real test customers
- Tests full cleanup flow
- Verifies Stripe state after deletion

### Verification Checklist
**File:** `doer/docs/ACCOUNT_DELETION_VERIFICATION.md`

Comprehensive checklist for manual verification:
- Stripe Dashboard verification
- Supabase database verification
- Audit log verification
- Webhook handling verification

## Database Schema

### New Table: `account_deletion_audit`

```sql
CREATE TABLE account_deletion_audit (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  deletion_initiated_at timestamptz NOT NULL,
  deletion_completed_at timestamptz,
  status text NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed', 'partial'
  stripe_cleanup_status text, -- 'pending', 'completed', 'failed', 'skipped'
  subscriptions_canceled integer DEFAULT 0,
  payment_methods_detached integer DEFAULT 0,
  customer_deleted boolean DEFAULT false,
  redaction_job_id text,
  error_details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Indexes:**
- `user_id` for lookups
- `stripe_customer_id` for Stripe-related queries
- `deletion_initiated_at` for time-based queries
- `status` for status filtering

**RLS Policies:**
- Users can read their own audit records
- Service role can manage all records

## Privacy Policy Updates

The privacy policy has been updated to explain:
- Stripe data retention policy
- What data is deleted vs. retained
- Link to Stripe's privacy policy

## User Communication

### Delete Account Confirmation Modal

Updated to include:
- Warning about permanent deletion
- List of what will be deleted
- Information about Stripe data retention
- Confirmation requirement

### Success Messages

- **Full Success**: "Account and all data have been permanently deleted."
- **Partial Success**: "Your account has been deleted. We encountered an issue removing your billing information from Stripe. Our team will complete this process manually."

## Security Considerations

1. **Stripe Secret Key**: Never logged, masked in error messages
2. **Admin Routes**: Protected by `ADMIN_API_KEY` environment variable
3. **Audit Logging**: All deletion actions are logged with IP and user agent
4. **Rate Limiting**: Should be implemented on delete route (1 per hour per user)

## Rollout Plan

1. **Stage 1 (Internal Testing)**: Feature flag enabled for test accounts only
2. **Stage 2 (Beta)**: Feature flag enabled for 10% of users (via user ID hash)
3. **Stage 3 (Production)**: Feature flag enabled for all users

## Monitoring

Monitor:
- Deletion success rate
- Stripe cleanup failure rate
- Partial deletion rate
- Audit log entries
- Error logs

## Troubleshooting

### Stripe Cleanup Fails

1. Check audit log for error details
2. Use admin route to retry cleanup
3. Verify Stripe API status
4. Check Stripe customer state in dashboard

### Webhook Issues

1. Check if customer is deleted
2. Verify webhook handler logs
3. Check for race conditions
4. Verify webhook event ordering

## Future Enhancements

- GDPR redaction job support (optional)
- Automated retry mechanism for failed cleanups
- Admin dashboard for deletion management
- Rate limiting implementation
- Email notifications for partial failures

