# Stripe Duplicate Customer/Subscription Fix Summary

## Problem
Multiple customer profiles and subscriptions were being created in Stripe for a single user due to race conditions and duplicate logic.

## Root Causes Identified

### 1. Duplicate Customer Creation
- **Issue**: `autoAssignBasicPlan` was creating customers directly instead of using `ensureStripeCustomer`
- **Location**: `doer/src/lib/stripe/auto-assign-basic.ts`
- **Impact**: Multiple concurrent calls could create multiple customers for the same user

### 2. Race Conditions in Customer Creation
- **Issue**: `ensureStripeCustomer` had no locking mechanism
- **Location**: `doer/src/lib/stripe/customers.ts`
- **Impact**: Two simultaneous requests could both see no customer and both create one

### 3. Race Conditions in Subscription Creation
- **Issue**: `autoAssignBasicPlan` checked for subscriptions but had a race window
- **Location**: `doer/src/lib/stripe/auto-assign-basic.ts`
- **Impact**: Multiple concurrent calls could all see no subscription and all create one

### 4. No Idempotency in Subscription Sync
- **Issue**: `syncSubscriptionSnapshot` didn't check for existing subscriptions before inserting
- **Location**: `doer/src/lib/billing/subscription-sync.ts`
- **Impact**: Webhook retries or concurrent syncs could create duplicate subscription records

## Fixes Implemented

### 1. Enhanced `ensureStripeCustomer` with Idempotency
**File**: `doer/src/lib/stripe/customers.ts`

**Changes**:
- Added Stripe idempotency key using `userId` to prevent duplicate customer creation
- Added customer verification to check if customer still exists in Stripe
- Improved error handling for idempotency key collisions
- Used upsert pattern for database updates to handle race conditions
- Added logging for race condition detection

**Key Features**:
- Idempotency key: `customer-${userId}` ensures same user always gets same customer
- Handles idempotency key collisions gracefully
- Uses database upsert to prevent duplicate customer IDs

### 2. Refactored `autoAssignBasicPlan` to Use `ensureStripeCustomer`
**File**: `doer/src/lib/stripe/auto-assign-basic.ts`

**Changes**:
- Removed duplicate customer creation logic
- Now uses `ensureStripeCustomer` for all customer operations
- Added double-check for existing subscriptions (Stripe + database)
- Added idempotency key for subscription creation
- Improved error handling for duplicate subscriptions

**Key Features**:
- Uses centralized customer creation (no duplication)
- Idempotency key: `basic-subscription-${userId}-${minute}` prevents duplicates within same minute
- Checks both Stripe and database before creating subscription
- Handles idempotency key collisions by finding existing subscription

### 3. Enhanced Subscription Sync with Duplicate Prevention
**File**: `doer/src/lib/billing/subscription-sync.ts`

**Changes**:
- Added check for existing subscription by `external_subscription_id` before insert
- Handles unique constraint violations gracefully
- Updates existing subscription instead of creating duplicate

**Key Features**:
- Checks for existing subscription before insert
- Updates if exists, inserts only if new
- Handles concurrent webhook calls safely

### 4. Added Database Unique Constraint
**File**: `supabase/migrations/20250120000000_add_unique_constraint_external_subscription_id.sql`

**Changes**:
- Added unique index on `external_subscription_id` (where not null)
- Cleans up existing duplicates before adding constraint
- Prevents duplicate subscription records at database level

**Key Features**:
- Database-level enforcement of uniqueness
- Cleans up existing duplicates automatically
- Only applies to non-null values (allows null for non-Stripe subscriptions)

## Testing Recommendations

1. **Concurrent Customer Creation**:
   - Test multiple simultaneous calls to `autoAssignBasicPlan` for same user
   - Verify only one customer is created in Stripe
   - Verify only one customer ID in database

2. **Concurrent Subscription Creation**:
   - Test multiple simultaneous calls to `autoAssignBasicPlan` for same user
   - Verify only one subscription is created in Stripe
   - Verify only one subscription record in database

3. **Webhook Retry Handling**:
   - Test webhook delivery multiple times for same event
   - Verify subscription is not duplicated in database
   - Verify idempotency is maintained

4. **Existing Duplicates**:
   - Run migration to clean up existing duplicates
   - Verify constraint prevents new duplicates
   - Monitor for any constraint violations

## Migration Steps

1. **Run Database Migration**:
   ```sql
   -- Migration will automatically clean up duplicates
   -- Then add unique constraint
   ```

2. **Deploy Code Changes**:
   - Deploy updated `customers.ts`
   - Deploy updated `auto-assign-basic.ts`
   - Deploy updated `subscription-sync.ts`

3. **Monitor**:
   - Check Stripe dashboard for duplicate customers/subscriptions
   - Monitor application logs for race condition warnings
   - Verify no new duplicates are created

## Prevention Measures

1. **Idempotency Keys**: All Stripe operations use idempotency keys
2. **Database Constraints**: Unique constraint prevents duplicates at DB level
3. **Double-Checking**: Code checks both Stripe and database before creating
4. **Centralized Logic**: Single source of truth for customer creation
5. **Error Handling**: Graceful handling of race conditions and duplicates

## Notes

- The idempotency key for subscriptions uses minute-level granularity to allow legitimate updates within the same minute
- Customer idempotency key uses userId only, ensuring same user always gets same customer
- Database constraint is partial (only on non-null values) to allow flexibility for non-Stripe subscriptions
- All changes are backward compatible and handle existing data gracefully
