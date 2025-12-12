# Security Audit Report: Middleware & Database Querying

**Date:** 2025-01-31  
**Scope:** Comprehensive security review of authentication, authorization, and data access patterns

## Executive Summary

This audit reviews the entire authentication and authorization system to ensure:
- All protected routes require authentication
- All database queries properly enforce user isolation
- API routes have consistent authentication patterns
- RLS policies are correctly configured and enforced
- No security vulnerabilities exist in query patterns

---

## 1. Middleware Route Protection Audit

### Current Implementation
**File:** [`doer/src/middleware.ts`](doer/src/middleware.ts)

**Public Routes (Lines 86-111):**
- `/`, `/landing`, `/login`, `/pricing`, `/features`, `/about-us`, `/blog`, `/careers`, `/changelog`, `/community`, `/contact`, `/documentation`, `/feature-request`, `/help`, `/privacy`, `/responsible-use`, `/roadmap`, `/security`, `/solutions`, `/terms`, `/integrations`, `/checkout`, `/health`, `/motion-graphics-brief`

**Protected Routes (Default):**
- All routes NOT in public list require authentication
- `/api/*` routes excluded (handle own auth)
- `/auth/*` routes excluded

### Findings

#### ✅ Correctly Protected Routes
- `/schedule` - Protected by middleware
- `/dashboard` - Protected by middleware
- `/settings` - Protected by middleware
- `/onboarding/*` - Protected by middleware
- `/settings/*` - Protected by middleware (sub-routes inherit)

#### ⚠️ Potential Issues Found

1. **`/analytics`** - **ISSUE FOUND**
   - Status: Protected by middleware ✅
   - Page uses `useSupabase()` but doesn't verify auth before rendering
   - Risk: Low (middleware protects, but page should handle loading state better)

2. **`/data`** - **ISSUE FOUND**
   - Status: Protected by middleware ✅
   - Page only redirects to `/analytics`
   - Risk: Low (redirect happens, but unnecessary route)

3. **`/dashboard/integrations`** - **ISSUE FOUND**
   - Status: Protected by middleware ✅
   - Page only redirects to `/integrations`
   - Risk: Low (redirect happens, but unnecessary route)

4. **`/affiliates`** - **NEEDS REVIEW**
   - Status: NOT in public routes list, so protected by middleware
   - Page has no auth check (relies on middleware)
   - Question: Should this be public or protected?
   - Risk: Medium (if should be public, users can't access without login)

5. **`/report-misuse`** - **NEEDS REVIEW**
   - Status: NOT in public routes list, so protected by middleware
   - Page has no auth check (relies on middleware)
   - Question: Should this be public (for reporting abuse)?
   - Risk: Medium (if should be public, users can't report without login)

6. **`/checkout/success`** - **ISSUE FOUND**
   - Status: Protected by middleware ✅
   - Page has no auth verification before accessing query params
   - Risk: Low (middleware protects, but should verify user owns the subscription)

7. **`/test/assign-plan`** - **CRITICAL ISSUE**
   - Status: Protected by middleware ✅
   - This appears to be a test/debug route
   - Risk: **HIGH** - Should be removed or restricted to admin/service role only

### Recommendations

1. Add `/affiliates` to public routes if it should be accessible without login
2. Add `/report-misuse` to public routes if it should be accessible without login
3. Remove or restrict `/test/assign-plan` to admin/service role only
4. Add explicit auth checks in pages that rely on middleware (defense in depth)
5. Consider adding `/checkout/success` to public routes if users should access after payment

---

## 2. Page Component Authentication Review

### Protection Patterns Found

#### Pattern 1: `useOnboardingProtection()` Hook
**Used by:**
- `/settings` - ✅ Properly protected
- `/dashboard` - ✅ Properly protected

**Implementation:** [`doer/src/lib/useOnboardingProtection.ts`](doer/src/lib/useOnboardingProtection.ts)
- Verifies user authentication
- Fetches user profile
- Redirects to login if not authenticated
- Has timeout protection

#### Pattern 2: `useSupabase()` Hook Only
**Used by:**
- `/schedule` - ⚠️ Relies on middleware only
- `/analytics` - ⚠️ Relies on middleware only
- `/onboarding/complete` - ⚠️ Has client-side redirect but no server-side check

#### Pattern 3: No Protection Hook
**Used by:**
- `/affiliates` - ⚠️ No client-side check
- `/report-misuse` - ⚠️ No client-side check
- `/checkout/success` - ⚠️ No client-side check

### Findings

#### ✅ Properly Protected Pages
- `/settings` - Uses `useOnboardingProtection()`
- `/dashboard` - Uses `useOnboardingProtection()`

#### ⚠️ Pages with Insufficient Protection

1. **`/schedule`**
   - Only relies on middleware
   - No client-side auth verification
   - Queries data immediately without checking user
   - **Recommendation:** Add auth check before data queries

2. **`/analytics`**
   - Only relies on middleware
   - No client-side auth verification
   - **Recommendation:** Add loading state check for auth

3. **`/onboarding/complete`**
   - Has client-side redirect but runs after render
   - Could briefly show content to unauthenticated users
   - **Recommendation:** Add loading state that blocks render until auth confirmed

4. **`/affiliates`**
   - No auth check at all
   - **Recommendation:** Determine if should be public or protected

5. **`/report-misuse`**
   - No auth check at all
   - **Recommendation:** Determine if should be public or protected

6. **`/checkout/success`**
   - No auth verification
   - Accesses query params without verifying user owns subscription
   - **Recommendation:** Verify user authentication and subscription ownership

### Recommendations

1. Standardize on `useOnboardingProtection()` for all protected pages
2. Add loading states that prevent rendering until auth is confirmed
3. Add explicit auth checks before any data queries
4. Determine public vs protected status for `/affiliates` and `/report-misuse`

---

## 3. API Route Authentication Audit

### Authentication Patterns Found

#### Pattern 1: API Token + Session Fallback
**Used by:**
- `/api/clarify`
- `/api/plans/generate`
- `/api/plans/adjust-timeline`
- `/api/tasks/todo-list-analyze`
- `/api/tasks/ai-generate`

**Pattern:**
```typescript
try {
  authContext = await authenticateApiRequest(req.headers, { requiredScopes: [...] })
} catch (authError) {
  // Fall back to session auth
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

#### Pattern 2: Session Auth Only
**Used by:**
- `/api/tasks/time-schedule`
- `/api/profile`
- `/api/settings/*`
- `/api/subscription/*`

**Pattern:**
```typescript
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

#### Pattern 3: Public Routes (No Auth)
**Used by:**
- `/api/health`
- `/api/env-check`
- `/api/waitlist/*`
- `/api/newsletter/*`
- `/api/contact/sales`
- `/api/report-misuse`

### Findings

#### ✅ Properly Authenticated Routes
- `/api/tasks/time-schedule` - ✅ Checks auth
- `/api/profile` - ✅ Checks auth
- `/api/settings/*` - ✅ Checks auth
- `/api/subscription/*` - ✅ Checks auth
- `/api/plans/*` - ✅ Checks auth (API token or session)
- `/api/tasks/*` - ✅ Checks auth (API token or session)

#### ✅ Properly Verified User Ownership
- `/api/plans/[planId]/regenerate` - ✅ Verifies plan ownership (lines 46-51)
- `/api/plans/[planId]/clarify` - ✅ Verifies plan ownership (lines 43-48)
- `/api/plans/delete` - ✅ Verifies plan ownership (lines 49-54)
- `/api/plans/archive` - ✅ Uses RPC function that verifies ownership
- `/api/settings/api-tokens/[tokenId]` - ✅ Verifies token ownership (line 33)
- `/api/settings/delete-tasks` - ✅ Verifies task ownership (lines 32-36)
- `/api/settings/delete-plans` - ✅ Verifies plan ownership (lines 32-36)
- `/api/tasks/reschedule` - ✅ Verifies plan ownership if planId provided (lines 24-35)
- `/api/reschedules/accept` - ✅ Verifies proposal ownership (lines 30-31)
- `/api/reschedules/reject` - ✅ Verifies proposal ownership (lines 30-31)
- `/api/scheduling/history` - ✅ Verifies plan ownership (lines 26-31)

#### ⚠️ Routes Needing Review

1. **`/api/health`** - ✅ Correctly public (health check)
2. **`/api/env-check`** - ⚠️ Should verify this is safe to be public
3. **`/api/waitlist/*`** - ✅ Correctly public
4. **`/api/newsletter/*`** - ✅ Correctly public
5. **`/api/contact/sales`** - ✅ Correctly public
6. **`/api/report-misuse`** - ✅ Correctly public

#### ⚠️ Minor Issues Found

1. **Inconsistent Error Messages**
   - Some return `{ error: 'Unauthorized' }`
   - Some return `{ error: 'User not authenticated' }`
   - Some return `{ error: 'API_TOKEN_ERROR', message: '...' }`
   - **Risk:** Low (inconsistent but not a security issue)

2. **Duplicate Auth Checks**
   - Some routes check auth twice (once in try/catch, once after)
   - **Risk:** Low (redundant but not harmful)

### Recommendations

1. Create standardized API auth wrapper function
2. Standardize error messages across all routes
3. Remove duplicate auth checks where present
4. Continue verifying user ownership for all resource-based routes (currently well-implemented)

---

## 4. Database Query Pattern Analysis

### Query Patterns Found

#### Pattern 1: Direct Queries with User Filter
**Example:**
```typescript
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_id', user.id)
```

#### Pattern 2: Queries with Plan ID + User Filter
**Example:**
```typescript
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_id', user.id)
  .eq('plan_id', planId)
```

#### Pattern 3: Queries Accepting User-Provided IDs (Properly Verified)
**Example:**
```typescript
// In API route - GOOD PATTERN
const { planId } = await req.json()
const { data } = await supabase
  .from('plans')
  .select('*')
  .eq('id', planId)
  .eq('user_id', user.id)  // ✅ User ownership verified
  .single()
```

#### Pattern 4: Queries Using `.in()` with User Filter
**Example:**
```typescript
// GOOD PATTERN - Verified in delete-tasks route
const { data } = await supabase
  .from('tasks')
  .select('id')
  .eq('user_id', user.id)  // ✅ User filter first
  .in('id', task_ids)      // Then filter by IDs
```

### Findings

#### ✅ Properly Filtered Queries
- **API Routes:** All reviewed routes properly filter by `user_id`
  - `/api/plans/[planId]/*` - ✅ Verifies ownership before querying
  - `/api/settings/delete-tasks` - ✅ Filters by user_id before `.in()`
  - `/api/settings/delete-plans` - ✅ Filters by user_id before `.in()`
  - `/api/reschedules/accept` - ✅ Filters by user_id before `.in()`
  - `/api/reschedules/reject` - ✅ Filters by user_id before `.in()`

- **Page Components:** Most queries use hooks or API routes (good pattern)
  - `/schedule` - Uses `useSupabase()` hook (middleware protects)
  - `/dashboard` - Uses `useOnboardingProtection()` hook
  - `/settings` - Uses `useOnboardingProtection()` hook

#### ✅ No Issues Found
- All routes accepting resource IDs verify user ownership
- All `.in()` queries filter by user_id first
- RLS policies provide additional layer of protection

### Recommendations

1. ✅ Continue current pattern of verifying ownership before querying
2. Create query helper functions that automatically add user_id filter (optional improvement)
3. Document query patterns for consistency

---

## 5. RLS Policy Verification

### Current RLS Status

#### ✅ Tables with RLS Enabled
- `tasks` - ✅ RLS enabled
- `plans` - ✅ RLS enabled
- `task_schedule` - ✅ RLS enabled
- `task_completions` - ✅ RLS enabled
- `user_settings` - ✅ RLS enabled
- `onboarding_responses` - ✅ RLS enabled
- `health_snapshots` - ✅ RLS enabled
- `scheduling_history` - ✅ RLS enabled
- `api_tokens` - ✅ RLS enabled
- `user_plan_subscriptions` - ✅ RLS enabled
- `plan_usage_balances` - ✅ RLS enabled
- `usage_ledger` - ✅ RLS enabled
- `billing_plans` - ✅ RLS enabled (public read)
- `billing_plan_cycles` - ✅ RLS enabled (public read)

### RLS Policy Patterns

#### Pattern 1: User Isolation (Most Tables)
```sql
CREATE POLICY "Users can view their own X"
ON "public"."table_name"
FOR SELECT
USING ((select auth.uid()) = user_id);
```

#### Pattern 2: Public Read (Billing Tables)
```sql
CREATE POLICY "Public can view active billing plans"
ON "public"."billing_plans"
FOR SELECT
TO public
USING (active = true);
```

#### Pattern 3: Service Role Access
```sql
CREATE POLICY "Service role manages X"
ON "public"."table_name"
FOR ALL
TO service_role
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');
```

### Findings

#### ✅ Properly Configured
- All user data tables have RLS enabled
- Policies use optimized `(select auth.uid())` pattern
- Policies exist for SELECT, INSERT, UPDATE, DELETE operations
- Service role policies exist where needed

#### ⚠️ Areas to Verify

1. **Policy Completeness**
   - Need to verify all CRUD operations have policies
   - Some tables may only have SELECT policies

2. **Policy Performance**
   - Policies use `(select auth.uid())` which is good
   - Should verify indexes exist on `user_id` columns

3. **View Policies**
   - Views inherit RLS from underlying tables
   - Should verify `security_invoker=true` is set

### Recommendations

1. Audit all tables to ensure all CRUD operations have policies
2. Verify indexes exist on `user_id` columns for performance
3. Test RLS policies to ensure they work correctly
4. Document which tables are public vs user-isolated

---

## 6. Security Vulnerability Assessment

### IDOR (Insecure Direct Object Reference) Vulnerabilities

#### ✅ No Vulnerabilities Found

1. **Plan ID in URLs**
   - `/schedule?plan=<planId>` - ✅ Verified in `loadSettings` function (lines 46-51 in schedule/page.tsx)
   - `/api/plans/[planId]/*` - ✅ All routes verify plan ownership
   - **Status:** ✅ All properly protected

2. **Task ID Parameters**
   - API routes accepting `task_id` - ✅ All verify task ownership via user_id filter
   - `/api/settings/delete-tasks` - ✅ Verifies ownership (lines 32-36)
   - **Status:** ✅ All properly protected

3. **User ID Parameters**
   - Searched for routes accepting `user_id` as parameter
   - **Status:** ✅ No routes found accepting user_id (good - user_id always comes from auth)

4. **Array-based ID Queries**
   - `/api/settings/delete-tasks` - ✅ Filters by user_id before `.in()`
   - `/api/settings/delete-plans` - ✅ Filters by user_id before `.in()`
   - `/api/reschedules/accept` - ✅ Filters by user_id before `.in()`
   - **Status:** ✅ All properly protected

### Missing Authentication Checks

#### Found Issues
- ✅ All API routes check authentication
- ⚠️ Some pages rely solely on middleware (defense in depth - acceptable but could be improved)
  - `/schedule` - Relies on middleware only
  - `/analytics` - Relies on middleware only
  - `/onboarding/complete` - Has client-side check but could be improved

### Client-Side Only Authorization

#### Found Issues
- Some pages check auth client-side but middleware also protects
- **Status:** ✅ Acceptable (defense in depth), but could be standardized

### Information Disclosure

#### Error Messages Review
- Most error messages are generic (good)
- Some API routes return detailed errors but don't leak sensitive info
- **Status:** ✅ Generally good, but could be standardized

### Race Conditions

#### Potential Issues
- ✅ Auth checks happen before queries (good)
- Some routes check auth multiple times (redundant but safe)
- **Status:** ✅ No race condition vulnerabilities found

### Session Fixation

#### Current Implementation
- Supabase handles session management
- No custom session handling found
- **Status:** ✅ Safe (handled by Supabase)

### Test/Debug Routes

#### 🔴 Critical Issue Found

1. **`/test/assign-plan`** - **CRITICAL**
   - Allows assigning plans without Stripe checkout
   - Protected by middleware but accessible to any authenticated user
   - **Risk:** **HIGH** - Should be removed or restricted to admin/service role only
   - **Recommendation:** Remove this route or add admin-only check

---

## 7. Centralization Opportunities

### Current Issues

1. **Inconsistent API Auth Patterns**
   - Some use `authenticateApiRequest()`
   - Some use direct `getUser()`
   - Some use both (try/catch pattern)

2. **Inconsistent Page Protection**
   - Some use `useOnboardingProtection()`
   - Some use `useSupabase()` only
   - Some have no client-side check

3. **No Centralized Query Helpers**
   - Queries are written inline
   - No helpers that enforce user filtering
   - Risk of forgetting user_id filter

### Recommendations

1. **Create Standardized API Auth Wrapper**
   ```typescript
   // lib/auth/api-auth-wrapper.ts
   export async function requireAuth(req: NextRequest) {
     // Try API token first, fall back to session
     // Return user or throw error
   }
   ```

2. **Create Standardized Page Protection Hook**
   ```typescript
   // hooks/useAuthProtection.ts
   export function useAuthProtection() {
     // Standard auth check for all protected pages
     // Returns user, loading, error
   }
   ```

3. **Create Query Helpers**
   ```typescript
   // lib/supabase/query-helpers.ts
   export function queryUserData(table: string, userId: string) {
     // Returns query builder with user_id filter pre-applied
   }
   ```

4. **Document Authentication Patterns**
   - Create guide for API routes
   - Create guide for page components
   - Create guide for database queries

---

## Priority Action Items

### Critical (Fix Immediately)
1. 🔴 **Remove or restrict `/test/assign-plan` route**
   - Currently accessible to any authenticated user
   - Allows plan assignment without payment
   - **Action:** Remove route or add admin/service role check

### High Priority (Fix Soon)
1. ⚠️ **Determine public vs protected status for `/affiliates` and `/report-misuse`**
   - Currently protected but may need to be public
   - **Action:** Review business requirements and update middleware

2. ⚠️ **Add explicit auth checks to pages relying only on middleware**
   - `/schedule` - Add loading state that blocks render until auth confirmed
   - `/analytics` - Add loading state that blocks render until auth confirmed
   - **Action:** Add `useOnboardingProtection()` or similar hook

3. ⚠️ **Review `/api/env-check` route**
   - Currently public - verify it doesn't leak sensitive information
   - **Action:** Review route implementation

### Medium Priority (Improve)
1. ⚠️ **Standardize error messages across API routes**
   - Currently inconsistent (`Unauthorized` vs `User not authenticated`)
   - **Action:** Create standard error response helper

2. ⚠️ **Remove duplicate auth checks**
   - Some routes check auth multiple times
   - **Action:** Refactor to single auth check

3. ⚠️ **Create centralized query helpers**
   - Optional improvement for consistency
   - **Action:** Create helper functions that auto-add user_id filter

4. ⚠️ **Document authentication patterns**
   - Create guide for developers
   - **Action:** Write documentation

### Low Priority (Nice to Have)
1. ✅ **RLS policies are already optimized** (using `(select auth.uid())` pattern)
2. ⚠️ **Add comprehensive security tests**
   - Test IDOR protection
   - Test auth bypass attempts
   - **Action:** Create test suite

3. ⚠️ **Create security testing checklist**
   - For future audits
   - **Action:** Document testing procedures

---

## Next Steps

1. Review this report with the team
2. Prioritize fixes based on risk assessment
3. Implement fixes systematically
4. Re-audit after fixes are complete
5. Set up automated security testing

---

## Appendix: Files Reviewed

### Middleware
- `doer/src/middleware.ts`

### Pages
- `doer/src/app/schedule/page.tsx`
- `doer/src/app/dashboard/page.tsx`
- `doer/src/app/settings/page.tsx`
- `doer/src/app/analytics/page.tsx`
- `doer/src/app/data/page.tsx`
- `doer/src/app/dashboard/integrations/page.tsx`
- `doer/src/app/affiliates/page.tsx`
- `doer/src/app/report-misuse/page.tsx`
- `doer/src/app/checkout/success/page.tsx`
- `doer/src/app/onboarding/complete/page.tsx`

### API Routes (Sample)
- `doer/src/app/api/tasks/time-schedule/route.ts`
- `doer/src/app/api/plans/generate/route.ts`
- `doer/src/app/api/clarify/route.ts`

### Hooks
- `doer/src/lib/useOnboardingProtection.ts`
- `doer/src/components/providers/supabase-provider.tsx`

### Database
- `supabase/migrations/*.sql` (RLS policies)

