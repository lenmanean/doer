# API Improvements Guide

**Date:** 2025-01-31  
**Purpose:** Guide for using standardized API helpers and patterns

---

## Overview

This guide documents the new standardized helpers and patterns for API routes. These improvements provide:

- ✅ Consistent error responses
- ✅ Reduced code duplication
- ✅ Automatic user filtering in queries
- ✅ Simplified authentication handling

---

## New Helper Libraries

### 1. Error Responses (`@/lib/api/error-responses`)

Standardized error response functions for consistent API error handling.

**Available Functions:**
- `unauthorizedResponse(message?)` - 401 Unauthorized
- `forbiddenResponse(message?)` - 403 Forbidden
- `notFoundResponse(resource?)` - 404 Not Found
- `badRequestResponse(message, details?)` - 400 Bad Request
- `internalServerErrorResponse(message?)` - 500 Internal Server Error
- `rateLimitExceededResponse(message?)` - 429 Too Many Requests
- `successResponse(data, status?)` - Success response

**Example:**
```typescript
import { unauthorizedResponse, notFoundResponse, successResponse } from '@/lib/api/error-responses'

// Instead of:
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// Use:
return unauthorizedResponse()

// Instead of:
return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

// Use:
return notFoundResponse('Plan')

// Instead of:
return NextResponse.json({ data: result }, { status: 200 })

// Use:
return successResponse({ data: result })
```

---

### 2. Auth Helpers (`@/lib/api/auth-helpers`)

Simplified authentication handling with support for both API tokens and session auth.

**Available Functions:**
- `requireAuth(req, options?)` - Returns AuthContext or null
- `requireAuthOrError(req, options?)` - Returns AuthContext or error response
- `verifyResourceOwnership(supabase, table, resourceId, userId, selectFields?)` - Verify resource ownership

**Example:**
```typescript
import { requireAuthOrError } from '@/lib/api/auth-helpers'

export async function POST(req: NextRequest) {
  // Single line auth check
  const authResult = await requireAuthOrError(req)
  if (authResult instanceof Response) {
    return authResult // Already an error response
  }
  const { user, isApiToken } = authResult
  
  // Use user...
}
```

**With API Token Support:**
```typescript
// Supports both API tokens and session auth automatically
const authResult = await requireAuthOrError(req, {
  requiredScopes: ['read', 'write'], // For API tokens
  allowApiToken: true // Default: true
})
```

---

### 3. Query Helpers (`@/lib/supabase/query-helpers`)

Helper functions that automatically enforce user filtering to prevent data leaks.

**Available Functions:**
- `queryUserData(supabase, table, userId)` - Query builder with user_id filter
- `queryUserPlanData(supabase, table, userId, planId?)` - Query builder with user_id and plan_id filters
- `verifyUserOwnershipArray(supabase, table, userId, ids, selectFields?)` - Verify array of IDs
- `getUserResource(supabase, table, userId, resourceId, selectFields?)` - Get single resource with ownership check

**Example:**
```typescript
import { getUserResource, verifyUserOwnershipArray } from '@/lib/supabase/query-helpers'

// Instead of:
const { data: plan, error } = await supabase
  .from('plans')
  .select('id, user_id, name')
  .eq('id', planId)
  .eq('user_id', user.id)
  .single()

if (error || !plan) {
  return notFoundResponse('Plan')
}

// Use:
const plan = await getUserResource(
  supabase,
  'plans',
  user.id,
  planId,
  'id, user_id, name'
)

if (!plan) {
  return notFoundResponse('Plan')
}

// For arrays:
const tasks = await verifyUserOwnershipArray(
  supabase,
  'tasks',
  user.id,
  taskIds,
  'id, name'
)

if (tasks.length !== taskIds.length) {
  return forbiddenResponse('Some tasks not found or access denied')
}
```

---

## Migration Guide

### Before (Old Pattern)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const body = await req.json()
    const { resourceId } = body

    if (!resourceId) {
      return NextResponse.json({ error: 'Resource ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, user_id')
      .eq('id', resourceId)
      .eq('user_id', user.id)
      .single()

    if (resourceError || !resource) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Process...
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

### After (New Pattern)

```typescript
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuthOrError } from '@/lib/api/auth-helpers'
import { badRequestResponse, notFoundResponse, internalServerErrorResponse, successResponse } from '@/lib/api/error-responses'
import { getUserResource } from '@/lib/supabase/query-helpers'

export async function POST(req: NextRequest) {
  try {
    // Authenticate (single line)
    const authResult = await requireAuthOrError(req)
    if (authResult instanceof Response) return authResult
    const { user } = authResult

    const supabase = await createClient()
    const body = await req.json()
    const { resourceId } = body

    if (!resourceId) {
      return badRequestResponse('Resource ID required')
    }

    // Verify ownership (single line)
    const resource = await getUserResource(
      supabase,
      'resources',
      user.id,
      resourceId,
      'id, user_id'
    )

    if (!resource) {
      return notFoundResponse('Resource')
    }

    // Process...
    return successResponse({ success: true })
  } catch (error) {
    return internalServerErrorResponse()
  }
}
```

**Benefits:**
- ✅ 50% less code
- ✅ Consistent error messages
- ✅ Automatic user filtering
- ✅ Less chance of bugs

---

## Best Practices

### 1. Always Use Helpers for Auth

```typescript
// ✅ GOOD
const authResult = await requireAuthOrError(req)
if (authResult instanceof Response) return authResult
const { user } = authResult

// ❌ BAD
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 2. Always Use Helpers for Resource Verification

```typescript
// ✅ GOOD
const plan = await getUserResource(supabase, 'plans', user.id, planId)
if (!plan) return notFoundResponse('Plan')

// ❌ BAD
const { data: plan } = await supabase
  .from('plans')
  .select('*')
  .eq('id', planId)
  // Missing user_id filter!
```

### 3. Always Use Standardized Error Responses

```typescript
// ✅ GOOD
return unauthorizedResponse()
return notFoundResponse('Plan')
return badRequestResponse('Invalid input')

// ❌ BAD
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

### 4. Use Query Helpers for Arrays

```typescript
// ✅ GOOD
const tasks = await verifyUserOwnershipArray(
  supabase,
  'tasks',
  user.id,
  taskIds
)
if (tasks.length !== taskIds.length) {
  return forbiddenResponse('Some tasks not found')
}

// ❌ BAD
const { data: tasks } = await supabase
  .from('tasks')
  .select('id')
  .in('id', taskIds)
  // Missing user_id filter!
```

---

## Updated Routes

The following routes have been updated to use the new patterns:

1. ✅ `/api/settings/delete-tasks` - Uses helpers
2. ✅ `/api/plans/delete` - Uses helpers
3. ✅ `/api/settings/api-tokens/[tokenId]` - Uses helpers

**Note:** Other routes can be gradually migrated as they are updated. The old patterns still work, but new code should use the helpers.

---

## Future Improvements

1. **Gradual Migration:** Update remaining routes to use helpers
2. **Type Safety:** Add TypeScript types for common resource types
3. **Validation:** Add request validation helpers
4. **Rate Limiting:** Integrate rate limiting helpers

---

## Questions?

If you have questions about using these helpers, refer to:
- `doer/src/lib/api/error-responses.ts` - Error response implementations
- `doer/src/lib/api/auth-helpers.ts` - Auth helper implementations
- `doer/src/lib/supabase/query-helpers.ts` - Query helper implementations






















