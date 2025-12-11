# Secure Supabase Query Implementation

## Overview

This document describes the secure query wrapper implementation that ensures all Supabase queries are:
- **Authenticated**: User authentication is verified before every query
- **Resilient**: Automatic retry with exponential backoff for transient failures
- **Secure**: RLS policies are validated and enforced
- **Monitored**: Connection health checks and error tracking

## Architecture

### Core Components

1. **`secure-query.ts`**: Main secure query wrapper
2. **`useSecureQuery.ts`**: React hook for easy integration
3. **Connection Health Checks**: Monitor Supabase connection status
4. **RLS Verification**: Ensure Row Level Security policies are working

## Features

### 1. Authentication Verification

Every query verifies user authentication before execution:

```typescript
// Automatically verifies user is authenticated
const result = await secureQuery(async (client) => {
  return await client
    .from('user_settings')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle()
}, { requireAuth: true })
```

If authentication fails, the query returns an error immediately without attempting the query.

### 2. Retry Logic with Exponential Backoff

Automatic retry for transient failures:
- **Network errors**: Connection timeouts, network failures
- **Rate limiting**: HTTP 429 responses
- **Server errors**: HTTP 5xx responses

```typescript
const result = await secureQuery(queryFn, {
  maxRetries: 3,        // Maximum retry attempts
  retryDelay: 1000,     // Initial delay (1 second)
  maxRetryDelay: 10000, // Maximum delay (10 seconds)
})
```

Retry delays use exponential backoff with jitter to prevent thundering herd problems.

### 3. Timeout Protection

All queries have configurable timeouts to prevent hanging:

```typescript
const result = await secureQuery(queryFn, {
  timeout: 30000 // 30 second timeout
})
```

### 4. Error Classification

Errors are classified into:
- **Authentication errors**: Not retried, user must re-authenticate
- **Retryable errors**: Network issues, timeouts, server errors
- **Non-retryable errors**: Validation errors, permission denied (non-auth)

### 5. RLS Policy Verification

The system can verify that RLS policies are working correctly:

```typescript
import { verifyRLS } from '@/lib/supabase/secure-query'

const rlsCheck = await verifyRLS(userId)
if (!rlsCheck.valid) {
  console.error('RLS policy violation:', rlsCheck.error)
}
```

## Usage

### Basic Usage

```typescript
import { secureQuery } from '@/lib/supabase/secure-query'

const result = await secureQuery(async (client) => {
  return await client
    .from('plans')
    .select('id, name')
    .eq('user_id', userId)
}, {
  requireAuth: true,
  timeout: 10000,
  maxRetries: 2
})

if (result.error) {
  console.error('Query failed:', result.error.message)
  return
}

const plans = result.data
```

### Using the React Hook

```typescript
import { useSecureQuery } from '@/hooks/useSecureQuery'

function MyComponent() {
  const { query, user } = useSecureQuery()

  useEffect(() => {
    const loadData = async () => {
      const result = await query(async (client) => {
        return await client
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
      })

      if (result.error) {
        // Handle error
        return
      }

      // Use result.data
    }

    if (user) {
      loadData()
    }
  }, [user, query])
}
```

### Connection Health Check

```typescript
import { checkConnectionHealth } from '@/lib/supabase/secure-query'

const health = await checkConnectionHealth()
if (!health.healthy) {
  console.error('Connection unhealthy:', health.error)
} else {
  console.log('Connection healthy, latency:', health.latency, 'ms')
}
```

## Error Handling

### Authentication Errors

When authentication fails, the query immediately returns an error:

```typescript
const result = await secureQuery(queryFn, { requireAuth: true })

if (result.error) {
  if (result.error.message.includes('Authentication')) {
    // Redirect to login
    router.push('/login')
  }
}
```

### Network Errors

Network errors are automatically retried with exponential backoff:

```typescript
const result = await secureQuery(queryFn, {
  maxRetries: 3,
  onError: (error) => {
    // Called on each retry attempt
    console.warn('Retrying query:', error.message)
  }
})
```

### Custom Error Handling

```typescript
const result = await secureQuery(queryFn, {
  onError: (error) => {
    // Custom error handling
    if (error.message.includes('timeout')) {
      showToast('Connection timeout. Please try again.')
    } else if (error.message.includes('network')) {
      showToast('Network error. Please check your connection.')
    }
  }
})
```

## Security Considerations

### 1. Authentication Required by Default

All queries require authentication by default. To allow unauthenticated queries:

```typescript
const result = await secureQuery(queryFn, {
  requireAuth: false // Only for public data
})
```

### 2. RLS Policy Enforcement

The secure query wrapper doesn't bypass RLS policies. All queries are subject to Row Level Security policies defined in the database.

### 3. Error Message Sanitization

Error messages are sanitized to prevent information leakage:
- Database structure details are not exposed
- Internal error codes are not shown to users
- Only user-friendly error messages are returned

### 4. Connection Validation

Before executing queries, the system validates:
- User authentication status
- Session validity
- Connection health

## Migration Guide

### Before (Insecure)

```typescript
// ❌ No authentication check
// ❌ No retry logic
// ❌ No timeout protection
const { data, error } = await supabase
  .from('plans')
  .select('*')
  .eq('user_id', userId)
```

### After (Secure)

```typescript
// ✅ Authentication verified
// ✅ Automatic retry with backoff
// ✅ Timeout protection
// ✅ Proper error handling
const result = await secureQuery(
  async (client) => {
    return await client
      .from('plans')
      .select('*')
      .eq('user_id', userId)
  },
  {
    requireAuth: true,
    timeout: 10000,
    maxRetries: 2
  }
)

if (result.error) {
  // Handle error
  return
}

const plans = result.data
```

## Best Practices

1. **Always use `secureQuery` for authenticated queries**
2. **Set appropriate timeouts** based on query complexity
3. **Handle errors gracefully** with user-friendly messages
4. **Monitor connection health** in production
5. **Verify RLS policies** during development
6. **Use TypeScript types** for better type safety

## Performance Considerations

- **Retry delays**: Exponential backoff prevents overwhelming the server
- **Jitter**: Random jitter prevents synchronized retries
- **Timeout**: Prevents hanging queries from blocking the UI
- **Connection pooling**: Supabase client handles connection pooling automatically

## Monitoring

### Connection Health

Monitor connection health periodically:

```typescript
setInterval(async () => {
  const health = await checkConnectionHealth()
  if (!health.healthy) {
    // Alert monitoring system
    reportError('Supabase connection unhealthy')
  }
}, 60000) // Check every minute
```

### Error Tracking

Track query errors for monitoring:

```typescript
const result = await secureQuery(queryFn, {
  onError: (error) => {
    // Send to error tracking service
    errorTracker.captureException(error, {
      tags: { component: 'schedule-page' },
      extra: { userId, queryType: 'loadSettings' }
    })
  }
})
```

## Troubleshooting

### Query Timeouts

If queries are timing out:
1. Check network connectivity
2. Verify Supabase service status
3. Review query complexity (add indexes if needed)
4. Increase timeout if query is legitimately slow

### Authentication Failures

If authentication fails:
1. Verify user session is valid
2. Check if session expired
3. Ensure user is properly authenticated
4. Clear corrupted session data

### Connection Errors

If connection errors occur:
1. Check Supabase service status
2. Verify network connectivity
3. Review firewall/proxy settings
4. Check for rate limiting

## Future Enhancements

- [ ] Query result caching
- [ ] Request deduplication
- [ ] Automatic connection recovery
- [ ] Query performance metrics
- [ ] Advanced retry strategies

