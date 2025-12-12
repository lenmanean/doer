# Authentication Architecture

## Overview

This document describes the authentication patterns used across the application and best practices for implementing authentication in new routes.

## Authentication Layers

### 1. Middleware (`src/middleware.ts`)
- **Purpose**: Protects page routes (not API routes)
- **Method**: Session-based authentication only (cookies)
- **Behavior**: 
  - Allows all `/api/*` routes through without checking
  - Redirects unauthenticated users to `/login` for protected pages
  - Uses `createServerClient` from `@supabase/ssr`

### 2. API Route Authentication

The application supports two authentication methods for API routes:

#### A. API Token Authentication
- **Use Case**: External API integrations, programmatic access
- **Implementation**: `authenticateApiRequest()` from `@/lib/auth/api-token-auth`
- **Features**:
  - Token validation with PBKDF2 hashing
  - Scope-based permissions
  - Token expiration and revocation checks
  - Automatic credit service initialization

#### B. Session Authentication
- **Use Case**: Web UI requests from authenticated users
- **Implementation**: `createClient().auth.getUser()` from `@/lib/supabase/server`
- **Features**:
  - Cookie-based session validation
  - Automatic session refresh
  - Respects RLS policies

## Authentication Helpers

### `requireAuth()` / `requireAuthOrError()`
**Location**: `src/lib/api/auth-helpers.ts`

**Purpose**: Unified authentication for routes that need both API token and session auth support.

**Usage**:
```typescript
const authResult = await requireAuthOrError(request)
if (authResult instanceof Response) {
  return authResult // Unauthorized response
}
const { userId, user, isApiToken } = authResult
// Use userId for authorization checks
// user is optional (only available for session auth)
```

**Best Practices**:
- Always use `userId` for authorization checks (works for both auth methods)
- Only use `user` object when needed (e.g., for display purposes)
- `user` is only populated for session auth to avoid unnecessary admin API calls

### `authenticateApiRoute()`
**Location**: `src/lib/auth/api-route-auth.ts`

**Purpose**: Authentication with automatic credit service and credit reservation.

**Status**: Currently unused but available for routes that need:
- Credit service initialization
- Automatic credit reservation
- Unified API token + session auth

**Usage** (when needed):
```typescript
const authContext = await authenticateApiRoute(headers, {
  requiredScopes: ['plans.generate'],
  creditMetric: 'api_credits',
  creditCost: 5,
  routeName: 'plans.generate',
})
// authContext includes userId, creditService, and reserved flag
```

## Current Patterns in Use

### Pattern 1: Simple Session Auth (Most Common)
Used in: `profile`, `subscription`, `settings/*`, etc.

```typescript
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) {
  return unauthorizedResponse()
}
// Use user.id for authorization
```

### Pattern 2: API Token + Session Fallback (For Credit-Based Routes)
Used in: `clarify`, `plans/generate`, `tasks/ai-generate`, etc.

```typescript
let authContext: ApiAuthContext | null = null
try {
  authContext = await authenticateApiRequest(headers, { requiredScopes: [...] })
  // Use authContext.userId
} catch (authError) {
  if (authError instanceof ApiTokenError) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return unauthorizedResponse()
    // Use user.id
  } else {
    throw authError
  }
}
```

### Pattern 3: Unified Helper (Recommended for New Routes)
Used in: `plans/delete`

```typescript
const authResult = await requireAuthOrError(request)
if (authResult instanceof Response) return authResult
const { userId } = authResult
// Use userId for authorization
```

## Error Responses

All authentication errors should use standardized responses from `@/lib/api/error-responses`:

- `unauthorizedResponse(message?)` - 401 Unauthorized
- `apiTokenErrorResponse(message, status?)` - API token specific errors
- `forbiddenResponse(message?)` - 403 Forbidden (authenticated but no permission)

## Best Practices

1. **Always use `userId` for authorization checks**
   - Works for both API token and session auth
   - Avoids unnecessary user object fetching

2. **Only fetch full user object when needed**
   - Session auth provides user object automatically
   - API token auth only provides userId (fetch user only if needed)

3. **Use standardized error responses**
   - Consistent error format across all routes
   - Prevents information leakage

4. **Handle API token errors gracefully**
   - Return appropriate error messages
   - Fall back to session auth when appropriate

5. **Avoid double user fetching**
   - Store user object if fetched during auth
   - Reuse userId/user from auth context

## Security Considerations

1. **Never use admin API unnecessarily**
   - `getServiceRoleClient().auth.admin.*` should only be used when absolutely necessary
   - Prefer regular client with RLS policies

2. **Validate resource ownership**
   - Always verify resources belong to the authenticated user
   - Use `verifyResourceOwnership()` helper when available

3. **Scope-based permissions**
   - Use `requiredScopes` for API token routes
   - Validate scopes before processing requests

4. **Rate limiting and credits**
   - Use credit service for rate limiting
   - Reserve credits before expensive operations
   - Release credits on errors

## Migration Path

For routes currently using Pattern 2 (manual duplication), consider migrating to:
- Pattern 3 (`requireAuthOrError`) for simple routes
- `authenticateApiRoute()` for routes needing credit service

This will reduce code duplication and improve maintainability.

