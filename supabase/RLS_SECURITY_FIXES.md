# RLS Policies and Security Fixes

**Migration:** `20251112000000_fix_rls_policies_and_security.sql`  
**Date:** 2025-11-12  
**Purpose:** Address all RLS policies, dependencies, constraints, triggers, and foreign keys for the billing/usage system

## Issues Addressed

### 1. Missing RLS Policies

**Problem:** Several tables were marked as "Unrestricted" in Supabase Studio, meaning they lacked Row Level Security policies:
- `billing_plans` - No RLS enabled
- `billing_plan_cycles` - No RLS enabled  
- `user_plan_subscriptions` - No RLS enabled
- Views (`user_usage_summary`, `v_plan_health`) - Inherit RLS but needed verification

**Solution:**
- ✅ Enabled RLS on all billing tables
- ✅ Added public read policies for plan selection UI
- ✅ Added user-specific policies for subscriptions
- ✅ Added service_role policies for administrative access

### 2. RLS Policy Details

#### `billing_plans`
- **Public Read:** Anyone can view active billing plans (for plan selection)
- **Service Role:** Full access for management
- **Rationale:** Plans need to be publicly readable for users to select subscriptions

#### `billing_plan_cycles`
- **Public Read:** Anyone can view cycles for active plans
- **Service Role:** Full access for management
- **Rationale:** Cycles need to be publicly readable for plan selection UI

#### `user_plan_subscriptions`
- **User Access:** Users can view, insert, update, and delete their own subscriptions
- **Service Role:** Full access for management
- **Rationale:** Users need to manage their own subscriptions (cancel, view status, etc.)

#### Views
- **`user_usage_summary`**: 
  - Set `security_invoker=true` to ensure it runs with querying user's permissions
  - Inherits RLS from `plan_usage_balances` table (users can only see their own usage)
  - Revoked public access - only authenticated users can query
- **`v_plan_health`**: 
  - Already uses `security_invoker=true`
  - Inherits RLS from `plans` table (users can only see their own plans)
  
**Note:** Views in PostgreSQL don't support RLS policies directly. They inherit RLS from underlying tables when `security_invoker=true` is set, which ensures the view runs with the querying user's permissions.

### 3. Foreign Key Constraints

**Verified and Documented:**
- ✅ `user_plan_subscriptions.billing_plan_cycle_id` → `RESTRICT` (prevents deletion of cycles with active subscriptions)
- ✅ `plan_usage_balances.billing_plan_cycle_id` → `SET NULL` (allows historical records)
- ✅ `usage_ledger.billing_plan_cycle_id` → `SET NULL` (preserves audit trail)
- ✅ `api_tokens.billing_plan_cycle_id` → `SET NULL` (tokens can outlive cycles)

**Rationale:**
- `RESTRICT` on subscriptions prevents accidental deletion of cycles in use
- `SET NULL` on historical tables preserves data integrity while allowing cleanup

### 4. Missing Constraints

**Added:**
- ✅ `user_plan_subscriptions_period_check`: Ensures `current_period_start <= current_period_end`
- ✅ `user_plan_subscriptions_cancel_at_check`: Ensures `cancel_at >= current_period_start` (if provided)

**Rationale:** Prevents invalid date ranges in subscription records

### 5. Missing Triggers

**Added `updated_at` triggers for:**
- ✅ `billing_plans`
- ✅ `billing_plan_cycles`
- ✅ `user_plan_subscriptions`
- ✅ `plan_usage_balances`

**Rationale:** Ensures `updated_at` timestamps are automatically maintained

### 6. Performance Indexes

**Added:**
- ✅ `idx_user_plan_subscriptions_user_status`: Fast lookup of user subscriptions by status
- ✅ `idx_billing_plan_cycles_billing_plan_id`: Fast lookup of cycles for a plan
- ✅ `idx_billing_plans_active`: Partial index for active plans only

**Rationale:** Improves query performance for common access patterns

### 7. Permissions (GRANT statements)

**Granted:**
- ✅ `anon` and `authenticated` can SELECT from `billing_plans` and `billing_plan_cycles`
- ✅ `authenticated` can manage their own `user_plan_subscriptions`
- ✅ `service_role` has full access to all billing tables
- ✅ Views are accessible to `authenticated` and `service_role`

### 8. Function Security Verification

**Verified:**
- ✅ Usage management functions (`reserve_usage`, `commit_usage`, `release_usage`, `reset_usage_cycle`) have `SECURITY DEFINER`
- ✅ Functions run with elevated privileges to manage usage balances

## Security Model Summary

### Public Access (No Authentication Required)
- ✅ Read active billing plans
- ✅ Read billing plan cycles for active plans

### Authenticated User Access
- ✅ Full access to own data (plans, tasks, settings, etc.)
- ✅ View own usage balances and ledger
- ✅ Manage own subscriptions
- ✅ View own usage summary

### Service Role Access
- ✅ Full access to all tables
- ✅ Can manage billing plans and cycles
- ✅ Can manage usage balances and ledger
- ✅ Can manage all user subscriptions

## Dependencies

### Table Dependencies (Cascade Order)
1. `billing_plans` (no dependencies)
2. `billing_plan_cycles` (depends on `billing_plans`)
3. `user_plan_subscriptions` (depends on `billing_plan_cycles`, `auth.users`)
4. `plan_usage_balances` (depends on `billing_plan_cycles`, `auth.users`)
5. `api_tokens` (depends on `billing_plan_cycles`, `auth.users`)
6. `usage_ledger` (depends on `billing_plan_cycles`, `api_tokens`, `auth.users`)

### Function Dependencies
- Usage functions depend on `plan_usage_balances` table
- All functions use `SECURITY DEFINER` for elevated privileges
- Functions automatically create ledger entries

## Testing Checklist

After applying this migration, verify:

- [ ] Billing plans are publicly readable (test as anonymous user)
- [ ] Users can only see their own subscriptions
- [ ] Users can manage their own subscriptions (cancel, update)
- [ ] Service role can manage all billing data
- [ ] Foreign key constraints prevent invalid deletions
- [ ] Triggers update `updated_at` timestamps
- [ ] Indexes improve query performance
- [ ] Views respect RLS policies

## Rollback

If needed, rollback steps:
1. Drop new policies
2. Disable RLS on billing tables (if reverting)
3. Drop new constraints
4. Drop new triggers
5. Drop new indexes

**Note:** This migration is idempotent - it can be run multiple times safely.

## Related Migrations

- `20251111010000_add_billing_usage_and_api_tokens.sql` - Original billing system
- `20251111010100_add_unmetered_access_flag.sql` - Unmetered access feature
- `20251111010200_add_stripe_customer_id.sql` - Stripe integration

