# Security Pattern Documentation

**Date:** 2025-01-31  
**Purpose:** Standard patterns for authentication, authorization, and data access

---

## 1. API Route Authentication Patterns

### Pattern 1: Session Authentication (Most Common)

**Use When:**
- Standard API routes that require user authentication
- Routes that don't need API token support

**Implementation:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  
  // Authenticate user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  // Verify user owns resource if accepting resource ID
  const body = await req.json()
  const { resourceId } = body
  
  if (resourceId) {
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, user_id')
      .eq('id', resourceId)
      .eq('user_id', user.id)  // ✅ Always verify ownership
      .single()
    
    if (resourceError || !resource) {
      return NextResponse.json(
        { error: 'Resource not found or access denied' },
        { status: 404 }
      )
    }
  }
  
  // Process request...
}
```

### Pattern 2: API Token + Session Fallback

**Use When:**
- Routes that support both API tokens and session auth
- Routes that need API access

**Implementation:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authenticateApiRequest } from '@/lib/auth/api-route-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let user: any = null
  
  // Try API token first
  try {
    const authContext = await authenticateApiRequest(
      req.headers,
      { requiredScopes: ['read', 'write'] }
    )
    user = authContext.user
  } catch (authError) {
    // Fall back to session auth
    const supabase = await createClient()
    const { data: { user: sessionUser }, error: userError } = 
      await supabase.auth.getUser()
    
    if (userError || !sessionUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    user = sessionUser
  }
  
  // Process request with authenticated user...
}
```

### Pattern 3: Public Route (No Auth)

**Use When:**
- Health checks
- Public forms (contact, waitlist, etc.)
- Public data endpoints

**Implementation:**
```typescript
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // No auth check needed
  // But still validate input and sanitize output
  
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
}
```

---

## 2. Page Component Protection Patterns

### Pattern 1: Using `useOnboardingProtection()` Hook (Recommended)

**Use When:**
- Protected pages that need user profile
- Pages that should redirect if not authenticated

**Implementation:**
```typescript
'use client'

import { useOnboardingProtection } from '@/lib/useOnboardingProtection'

export default function ProtectedPage() {
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  
  // Hook handles:
  // - Authentication check
  // - Profile loading
  // - Redirect to login if not authenticated
  // - Loading states
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  if (!user) {
    return null // Hook will redirect
  }
  
  return (
    <div>
      {/* Page content */}
    </div>
  )
}
```

### Pattern 2: Using `useSupabase()` Hook (For Simple Pages)

**Use When:**
- Pages that only need user object
- Pages that don't need profile data

**Implementation:**
```typescript
'use client'

import { useSupabase } from '@/components/providers/supabase-provider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SimpleProtectedPage() {
  const router = useRouter()
  const { user, loading, sessionReady } = useSupabase()
  const [isReady, setIsReady] = useState(false)
  
  useEffect(() => {
    if (loading || !sessionReady) return
    
    if (!user) {
      router.push('/login')
      return
    }
    
    setIsReady(true)
  }, [user, loading, sessionReady, router])
  
  if (loading || !isReady) {
    return <LoadingSpinner />
  }
  
  return (
    <div>
      {/* Page content */}
    </div>
  )
}
```

---

## 3. Database Query Patterns

### Pattern 1: Querying User Data (Always Filter by user_id)

**Implementation:**
```typescript
// ✅ GOOD: Always filter by user_id
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_id', user.id)  // ✅ Always include this
  .order('created_at', { ascending: false })

// ❌ BAD: Missing user_id filter
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  // Missing .eq('user_id', user.id)
```

### Pattern 2: Verifying Resource Ownership

**Implementation:**
```typescript
// ✅ GOOD: Verify ownership before querying
const { data: plan, error: planError } = await supabase
  .from('plans')
  .select('id, user_id, name')
  .eq('id', planId)
  .eq('user_id', user.id)  // ✅ Verify ownership
  .single()

if (planError || !plan) {
  return NextResponse.json(
    { error: 'Plan not found or access denied' },
    { status: 404 }
  )
}

// Now safe to use plan data
```

### Pattern 3: Querying with Arrays (Always Filter by user_id First)

**Implementation:**
```typescript
// ✅ GOOD: Filter by user_id before .in()
const { data: tasks, error } = await supabase
  .from('tasks')
  .select('id')
  .eq('user_id', user.id)  // ✅ Filter first
  .in('id', taskIds)        // Then filter by IDs

// ❌ BAD: Missing user_id filter
const { data: tasks, error } = await supabase
  .from('tasks')
  .select('id')
  .in('id', taskIds)  // Could access other users' tasks
```

### Pattern 4: Using `.maybeSingle()` (Still Filter by user_id)

**Implementation:**
```typescript
// ✅ GOOD: Filter by user_id even with .maybeSingle()
const { data: settings, error } = await supabase
  .from('user_settings')
  .select('preferences')
  .eq('user_id', user.id)  // ✅ Always include
  .maybeSingle()

// Note: RLS provides additional protection, but defense in depth is best
```

---

## 4. RLS Policy Patterns

### Pattern 1: User Isolation (Most Common)

**Implementation:**
```sql
-- Enable RLS
ALTER TABLE "public"."table_name" ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "Users can view their own data"
ON "public"."table_name"
FOR SELECT
USING (((select auth.uid()) = "user_id"));

-- INSERT policy
CREATE POLICY "Users can insert their own data"
ON "public"."table_name"
FOR INSERT
WITH CHECK (((select auth.uid()) = "user_id"));

-- UPDATE policy
CREATE POLICY "Users can update their own data"
ON "public"."table_name"
FOR UPDATE
USING (((select auth.uid()) = "user_id"));

-- DELETE policy
CREATE POLICY "Users can delete their own data"
ON "public"."table_name"
FOR DELETE
USING (((select auth.uid()) = "user_id"));
```

**Note:** Use `(select auth.uid())` instead of `auth.uid()` for better performance.

### Pattern 2: Public Read, Service Role Write

**Implementation:**
```sql
-- Public read access
CREATE POLICY "Public can view active items"
ON "public"."table_name"
FOR SELECT
TO public
USING (active = true);

-- Service role full access
CREATE POLICY "Service role manages all items"
ON "public"."table_name"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## 5. Error Handling Patterns

### Standard Error Responses

**Implementation:**
```typescript
// Unauthorized (401)
return NextResponse.json(
  { error: 'Unauthorized' },
  { status: 401 }
)

// Not Found (404)
return NextResponse.json(
  { error: 'Resource not found or access denied' },
  { status: 404 }
)

// Bad Request (400)
return NextResponse.json(
  { error: 'Invalid request', details: '...' },
  { status: 400 }
)

// Internal Server Error (500)
return NextResponse.json(
  { error: 'Internal server error' },
  { status: 500 }
)
```

**Best Practices:**
- Don't leak sensitive information in error messages
- Use generic messages for security errors
- Log detailed errors server-side only

---

## 6. Security Checklist

### For New API Routes:
- [ ] Check authentication (session or API token)
- [ ] Verify user ownership if accepting resource IDs
- [ ] Filter queries by `user_id`
- [ ] Use standard error responses
- [ ] Don't leak sensitive information

### For New Pages:
- [ ] Use `useOnboardingProtection()` or similar hook
- [ ] Add loading states
- [ ] Handle unauthenticated users
- [ ] Verify data belongs to user before displaying

### For New Database Queries:
- [ ] Always include `.eq('user_id', user.id)` filter
- [ ] Verify ownership before querying with resource IDs
- [ ] Filter by `user_id` before using `.in()` with arrays
- [ ] Use `.maybeSingle()` only when appropriate

### For New RLS Policies:
- [ ] Enable RLS on all user data tables
- [ ] Use `(select auth.uid())` pattern for performance
- [ ] Create policies for all CRUD operations
- [ ] Test policies to ensure they work correctly

---

## 7. Common Mistakes to Avoid

### ❌ Don't Accept user_id as Parameter
```typescript
// ❌ BAD
const { userId } = await req.json()
// Always get user_id from auth, never from request
```

### ❌ Don't Query Without user_id Filter
```typescript
// ❌ BAD
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('id', taskId)
  // Missing .eq('user_id', user.id)
```

### ❌ Don't Trust Client-Side Auth Only
```typescript
// ❌ BAD
if (!user) {
  return <div>Please login</div>
}
// Always verify server-side too
```

### ❌ Don't Leak Information in Errors
```typescript
// ❌ BAD
return NextResponse.json({
  error: `User ${userId} does not have access to plan ${planId}`
})

// ✅ GOOD
return NextResponse.json({
  error: 'Resource not found or access denied'
})
```

---

## 8. Testing Security

### Test Cases to Implement:

1. **IDOR Protection:**
   - Try accessing another user's plan
   - Try accessing another user's tasks
   - Verify 404 responses

2. **Auth Bypass:**
   - Try accessing protected routes without auth
   - Verify redirects to login
   - Try accessing API routes without auth
   - Verify 401 responses

3. **RLS Enforcement:**
   - Try querying other users' data directly
   - Verify empty results
   - Try updating other users' data
   - Verify errors

---

## Summary

- **Always** verify authentication in API routes
- **Always** filter queries by `user_id`
- **Always** verify resource ownership before operations
- **Always** use RLS policies as defense in depth
- **Never** accept `user_id` as parameter
- **Never** leak sensitive information in errors
- **Never** trust client-side auth only




















