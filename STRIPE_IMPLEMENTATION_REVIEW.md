# Stripe Implementation Review

## Executive Summary

This document provides a comprehensive review of the Stripe integration in the Doer application. The implementation is generally well-structured with good separation of concerns, but there are several areas that need attention for production readiness, security, and reliability.

**Overall Assessment**: ⚠️ **Good foundation, but needs improvements in error handling, race condition prevention, and data consistency**

---

## 1. Initialization and Configuration

### ✅ Strengths
- Proper lazy initialization of Stripe client (allows build to succeed without keys)
- Environment variable validation in some places
- Retry logic wrapper (`stripeWithRetry`) for API calls

### ⚠️ Issues

#### 1.1 Inconsistent Stripe Client Initialization
**Location**: Multiple files create their own Stripe instances
- `doer/src/lib/stripe/subscriptions.ts` (line 8-12)
- `doer/src/lib/stripe/customer-profile.ts` (line 6-10)
- `doer/src/lib/stripe/auto-assign-basic.ts` (line 8-12)
- `doer/src/app/api/stripe/webhook/route.ts` (line 9-16)
- `doer/src/app/api/checkout/create-subscription/route.ts` (line 14-20)
- And many more...

**Problem**: Each file creates its own Stripe instance, which is inefficient and makes configuration management harder.

**Recommendation**: Create a centralized Stripe client singleton:
```typescript
// lib/stripe/client.ts
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia', // Pin to specific version
    })
  }
  return stripeInstance
}
```

#### 1.2 Missing API Version Pinning
**Problem**: No explicit API version specified, which can lead to breaking changes when Stripe updates.

**Recommendation**: Pin to a specific API version in Stripe initialization.

#### 1.3 Environment Variable Validation
**Location**: `doer/src/lib/config/env.ts` (lines 79-81)

**Issue**: Only validates `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_BASIC`, but not the Pro plan prices.

**Recommendation**: Validate all required Stripe environment variables at startup.

---

## 2. Customer Management

### ✅ Strengths
- `ensureStripeCustomer` function properly handles customer creation/retrieval
- Customer ID is stored in `user_settings` table
- Customer profile sync on user profile updates

### ⚠️ Issues

#### 2.1 Race Condition in Customer Creation
**Location**: `doer/src/lib/stripe/customers.ts` (lines 22-53)

**Problem**: No locking mechanism to prevent duplicate customer creation if multiple requests happen simultaneously.

**Recommendation**: Use database-level locking or check-then-create pattern:
```typescript
// Use Supabase transaction with row-level locking
const { data, error } = await supabase
  .from('user_settings')
  .select('stripe_customer_id')
  .eq('user_id', userId)
  .single()
  .forUpdate() // PostgreSQL row-level lock
```

#### 2.2 Missing Customer Deletion Handling
**Problem**: No handling for when a Stripe customer is deleted externally.

**Recommendation**: Add webhook handler for `customer.deleted` event to clean up local references.

#### 2.3 Customer Metadata Not Always Set
**Location**: `doer/src/lib/stripe/customers.ts` (line 38-41)

**Problem**: `userId` metadata is set, but `planSlug` and `billingCycle` are not consistently set on customer creation.

**Recommendation**: Ensure all relevant metadata is set on customer creation.

---

## 3. Subscription Handling

### ✅ Strengths
- Good subscription status mapping
- Handles incomplete subscriptions with payment checks
- Subscription cache for performance
- Dual-write pattern (immediate DB write + webhook backup)

### ⚠️ Critical Issues

#### 3.1 Race Condition in Subscription Updates
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (lines 185-305)

**Problem**: When updating an existing subscription, there's a window where:
1. Subscription is retrieved
2. Another request could modify it
3. Update is applied, potentially overwriting changes

**Recommendation**: Use Stripe's idempotency keys or optimistic locking:
```typescript
await stripe.subscriptions.update(subscription.id, {
  items: [...],
}, {
  idempotencyKey: `update-${subscription.id}-${Date.now()}`
})
```

#### 3.2 Incomplete Subscription Handling
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (lines 203-230)

**Problem**: When canceling incomplete subscriptions, the code marks them as canceled in the database, but there's no guarantee the webhook won't try to sync them again.

**Recommendation**: Add a flag or status to prevent re-syncing canceled incomplete subscriptions.

#### 3.3 Subscription Metadata Update Race Condition
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (lines 254-274)

**Problem**: Metadata is updated in a separate call after subscription update. If the second call fails, subscription exists with wrong metadata.

**Recommendation**: Use Stripe's `expand` parameter to ensure metadata is correct, or make metadata update atomic with subscription update (if Stripe allows).

#### 3.4 Multiple Active Subscriptions
**Location**: `doer/src/lib/billing/subscription-sync.ts` (lines 290-308)

**Problem**: Code cancels other active subscriptions when creating a new one, but this could fail silently or create race conditions.

**Recommendation**: 
1. Use database transaction to ensure atomicity
2. Add validation to prevent multiple active subscriptions
3. Consider using Stripe's subscription update instead of cancel+create

#### 3.5 Plan Inference Logic Duplication
**Location**: Multiple files have similar plan inference logic:
- `doer/src/lib/stripe/subscriptions.ts` (lines 52-118)
- `doer/src/lib/billing/subscription-sync.ts` (lines 48-125)

**Problem**: Duplicated logic increases maintenance burden and risk of inconsistencies.

**Recommendation**: Extract to a shared utility function.

#### 3.6 Missing Subscription Cancellation Webhook Handling
**Location**: `doer/src/app/api/stripe/webhook/route.ts` (lines 200-211)

**Problem**: `customer.subscription.deleted` event only invalidates cache but doesn't update database subscription status.

**Recommendation**: Update database subscription status to 'canceled' when deletion webhook is received.

#### 3.7 Subscription Period Date Handling
**Location**: `doer/src/lib/billing/subscription-sync.ts` (lines 224-243)

**Problem**: If period dates are missing or invalid, code calculates them, but this might not match Stripe's actual dates.

**Recommendation**: Always use Stripe's dates. If missing, log error and don't create subscription record until webhook provides correct dates.

---

## 4. Transaction/Payment Handling

### ✅ Strengths
- Comprehensive payment intent retrieval logic
- Handles $0 invoices correctly
- Good error messages for payment failures

### ⚠️ Critical Issues

#### 4.1 Payment Intent Creation Complexity
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (lines 512-663)

**Problem**: Extremely complex logic with multiple fallback strategies for payment intent retrieval. This suggests the primary flow isn't working correctly.

**Recommendation**: 
1. Investigate why payment intent isn't always created automatically
2. Simplify to use Stripe's recommended flow: `payment_behavior: 'default_incomplete'` should create payment intent automatically
3. Consider using Stripe Checkout Sessions instead of manual subscription creation

#### 4.2 Manual Payment Intent Creation
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (lines 527-556)

**Problem**: Creating payment intent manually for an invoice is not the recommended approach and can lead to synchronization issues.

**Recommendation**: Use Stripe's built-in payment intent creation. If payment intent is missing, it's likely a configuration issue that should be fixed rather than worked around.

#### 4.3 Payment Intent Status Not Checked
**Problem**: Code retrieves payment intent but doesn't always check if it's already succeeded before returning client secret.

**Recommendation**: Check payment intent status and handle already-succeeded payments appropriately.

#### 4.4 Missing Payment Method Validation
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (line 127)

**Problem**: Payment method is attached without checking if it's valid or already attached.

**Recommendation**: Validate payment method before attaching.

#### 4.5 Invoice Finalization Timing
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (lines 382-405)

**Problem**: Invoice finalization happens in the request flow, which can cause delays. If finalization fails, the whole request fails.

**Recommendation**: Consider handling invoice finalization asynchronously or in webhook.

---

## 5. Webhook Processing

### ✅ Strengths
- Proper signature verification
- Handles multiple event types
- Good error logging
- Cache invalidation on subscription changes

### ⚠️ Issues

#### 5.1 Missing Idempotency
**Location**: `doer/src/app/api/stripe/webhook/route.ts`

**Problem**: No idempotency checks. If webhook is delivered multiple times, subscription could be synced multiple times.

**Recommendation**: Implement idempotency using event ID:
```typescript
// Check if event already processed
const { data: existing } = await supabase
  .from('stripe_webhook_events')
  .select('id')
  .eq('stripe_event_id', event.id)
  .single()

if (existing) {
  logger.info('Webhook event already processed', { eventId: event.id })
  return NextResponse.json({ success: true })
}

// Process event...

// Store event ID
await supabase
  .from('stripe_webhook_events')
  .insert({ stripe_event_id: event.id, processed_at: new Date() })
```

#### 5.2 User ID Lookup Fallback Complexity
**Location**: `doer/src/app/api/stripe/webhook/route.ts` (lines 128-155, 240-270)

**Problem**: Complex fallback logic to find userId suggests metadata isn't always set correctly.

**Recommendation**: 
1. Ensure userId is always set in subscription metadata during creation
2. Make userId lookup failure a critical error, not a warning
3. Add validation to reject subscriptions without userId

#### 5.3 Missing Webhook Event Types
**Problem**: Not handling all relevant webhook events:
- `customer.subscription.trial_will_end` - for trial expiration warnings
- `invoice.upcoming` - for payment reminders
- `customer.updated` - for customer profile changes
- `payment_method.attached` - for payment method updates

**Recommendation**: Add handlers for these events as needed.

#### 5.4 Webhook Error Handling
**Location**: `doer/src/app/api/stripe/webhook/route.ts` (lines 310-316)

**Problem**: If webhook processing fails, Stripe will retry, but there's no mechanism to prevent infinite retries on permanent failures.

**Recommendation**: 
1. Return appropriate HTTP status codes (200 for success, 4xx for permanent failures, 5xx for retryable failures)
2. Log permanent failures separately
3. Consider dead-letter queue for failed webhooks

#### 5.5 Canceled Subscription Sync Prevention
**Location**: `doer/src/app/api/stripe/webhook/route.ts` (lines 114-123)

**Problem**: Code skips syncing canceled subscriptions, but this means if a subscription is canceled and then reactivated, it won't be synced until next update.

**Recommendation**: Sync canceled subscriptions but mark them appropriately in database.

---

## 6. Error Handling

### ⚠️ Issues

#### 6.1 Inconsistent Error Handling
**Problem**: Some functions throw errors, others return null, others log and continue.

**Recommendation**: Establish consistent error handling patterns:
- Use Result types for operations that can fail
- Always log errors with context
- Don't silently swallow errors

#### 6.2 Missing Error Recovery
**Location**: Multiple files

**Problem**: When errors occur (e.g., database write fails), there's no recovery mechanism.

**Recommendation**: Implement retry logic for transient failures and dead-letter queues for permanent failures.

#### 6.3 Error Messages Expose Internal Details
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (lines 849-857)

**Problem**: Some error messages include internal details like price IDs.

**Recommendation**: Sanitize error messages for users, log full details server-side.

---

## 7. Security

### ✅ Strengths
- Webhook signature verification
- User authentication checks
- Service role client for admin operations

### ⚠️ Issues

#### 7.1 Missing Rate Limiting
**Problem**: No rate limiting on subscription creation/update endpoints.

**Recommendation**: Add rate limiting to prevent abuse.

#### 7.2 User Verification in Webhooks
**Location**: `doer/src/app/api/stripe/webhook/route.ts`

**Problem**: Webhooks rely on metadata for user identification, which could be manipulated if webhook secret is compromised.

**Recommendation**: 
1. Always verify customer ID matches user_settings
2. Add additional validation checks
3. Consider using Stripe's customer portal for user-initiated changes

#### 7.3 Payment Method Security
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts` (line 127)

**Problem**: Payment method is attached without verifying it belongs to the customer.

**Recommendation**: Stripe handles this, but add explicit validation.

#### 7.4 Environment Variable Exposure Risk
**Problem**: Environment variables are accessed directly without validation in some places.

**Recommendation**: Use a configuration service that validates and provides typed access to environment variables.

---

## 8. Data Consistency

### ⚠️ Critical Issues

#### 8.1 Dual-Write Pattern Without Reconciliation
**Location**: Multiple files use dual-write (immediate DB write + webhook backup)

**Problem**: If immediate write succeeds but webhook fails (or vice versa), data can be inconsistent.

**Recommendation**: 
1. Implement reconciliation job that compares Stripe data with database
2. Use database as source of truth for reads, Stripe for writes
3. Add monitoring/alerting for inconsistencies

#### 8.2 Subscription Status Mismatch
**Problem**: Database subscription status might not match Stripe status due to:
- Webhook delivery delays
- Failed webhook processing
- Manual Stripe dashboard changes

**Recommendation**: 
1. Periodic sync job to reconcile status
2. Always query Stripe for subscription status (current approach is good)
3. Use database subscription records for history/audit only

#### 8.3 Missing Transaction Boundaries
**Location**: `doer/src/lib/billing/subscription-sync.ts` (lines 269-317)

**Problem**: Multiple database operations without transaction, so partial updates are possible.

**Recommendation**: Wrap in database transaction:
```typescript
await supabase.rpc('begin_transaction')
try {
  // All operations
  await supabase.rpc('commit_transaction')
} catch (error) {
  await supabase.rpc('rollback_transaction')
  throw error
}
```

---

## 9. Performance

### ✅ Strengths
- Subscription caching
- Retry logic with exponential backoff

### ⚠️ Issues

#### 9.1 Cache Invalidation Timing
**Location**: `doer/src/lib/cache/subscription-cache.ts`

**Problem**: Cache is invalidated on webhook, but there's a window where cached data might be stale.

**Recommendation**: Use shorter TTL for critical subscription data or implement cache versioning.

#### 9.2 Multiple Stripe API Calls
**Location**: `doer/src/app/api/checkout/create-subscription/route.ts`

**Problem**: Multiple sequential API calls could be parallelized.

**Recommendation**: Use `Promise.all()` where possible for independent operations.

---

## 10. Testing and Observability

### ⚠️ Issues

#### 10.1 Missing Test Coverage
**Problem**: No visible test files for Stripe integration.

**Recommendation**: Add unit tests for:
- Plan inference logic
- Subscription status mapping
- Customer creation
- Webhook processing

#### 10.2 Limited Logging Context
**Problem**: Some log statements don't include enough context for debugging.

**Recommendation**: Always include:
- User ID
- Subscription ID
- Customer ID
- Request ID (for tracing)

#### 10.3 Missing Metrics
**Problem**: No metrics for:
- Subscription creation success/failure rates
- Payment success/failure rates
- Webhook processing times
- API call latencies

**Recommendation**: Add metrics collection for monitoring.

---

## 11. Recommendations Summary

### Critical (Fix Immediately)
1. ✅ **Centralize Stripe client initialization** - Create singleton
2. ✅ **Add idempotency to webhook processing** - Prevent duplicate processing
3. ✅ **Fix race conditions in subscription updates** - Use idempotency keys
4. ✅ **Simplify payment intent handling** - Use Stripe's recommended flow
5. ✅ **Add database transactions** - Ensure atomicity of subscription sync operations

### High Priority
6. ✅ **Extract plan inference logic** - Remove duplication
7. ✅ **Add reconciliation job** - Ensure data consistency
8. ✅ **Improve error handling** - Consistent patterns and recovery
9. ✅ **Add rate limiting** - Prevent abuse
10. ✅ **Pin Stripe API version** - Prevent breaking changes

### Medium Priority
11. ✅ **Add missing webhook handlers** - Trial end, invoice upcoming, etc.
12. ✅ **Improve logging and metrics** - Better observability
13. ✅ **Add unit tests** - Increase confidence in changes
14. ✅ **Optimize API calls** - Parallelize where possible

### Low Priority
15. ✅ **Consider Stripe Checkout Sessions** - Simpler payment flow
16. ✅ **Add customer deletion handling** - Clean up on deletion
17. ✅ **Improve cache strategy** - Better TTL management

---

## 12. Code Quality Observations

### Positive
- Good separation of concerns
- Comprehensive error logging
- Retry logic implementation
- Cache implementation

### Areas for Improvement
- Code duplication (plan inference, status mapping)
- Complex payment intent retrieval logic (suggests underlying issue)
- Inconsistent error handling patterns
- Missing type safety in some places (use of `any`)

---

## Conclusion

The Stripe implementation has a solid foundation with good architectural decisions (caching, retry logic, dual-write pattern). However, there are several critical issues around race conditions, data consistency, and error handling that need to be addressed before production use at scale.

The most critical areas to address are:
1. Race conditions in subscription updates
2. Webhook idempotency
3. Payment intent handling complexity
4. Data consistency and reconciliation

With these fixes, the implementation will be production-ready and maintainable.
