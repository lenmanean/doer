# Dashboard Transition Fix - Implementation Summary

## Problem Solved

Fixed the timeout issue when transitioning from the onboarding review page to the dashboard after accepting an AI-generated plan.

---

## Root Causes Identified

1. **Race Condition**: Dashboard tried to fetch data before auth session was fully initialized
2. **No Session Validation**: Review page redirected without verifying auth state
3. **Missing Timeout Handling**: API calls could hang indefinitely
4. **No Retry Logic**: Single network failures caused complete loading failure
5. **Poor Error UX**: No user-friendly error messages or recovery options

---

## Implementation Details

### 1. Health Check Endpoint
**File**: `doer/src/app/api/health/route.ts` (NEW)

- Lightweight endpoint to verify auth session validity
- Returns user ID if authenticated, error otherwise
- Used before heavy data fetching operations

```typescript
GET /api/health
Response: { healthy: true, userId: string, timestamp: string }
```

### 2. Review Page Session Validation
**File**: `doer/src/app/onboarding/review/page.tsx`

**Changes**:
- Added `supabase` import for session checking
- Modified `handleAcceptPlan()` to validate auth before redirect
- Calls `/api/health` endpoint to verify session
- Attempts session refresh if health check fails
- Adds 300ms delay to ensure session propagation
- Provides user-friendly error messages

**Key Code**:
```typescript
const handleAcceptPlan = async () => {
  // ✅ VALIDATE AUTH SESSION before redirecting
  const healthCheck = await fetch('/api/health')
  
  if (!healthCheck.ok) {
    // Try to refresh the session
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      alert('Your session has expired. Please sign in again.')
      router.push('/login')
      return
    }
  }
  
  // Add delay to ensure session propagation
  await new Promise(resolve => setTimeout(resolve, 300))
  
  router.push('/dashboard')
}
```

### 3. Dashboard Retry Logic & Error Handling
**File**: `doer/src/app/dashboard/page.tsx`

**Changes**:
- Added `loadPlansError` state for tracking errors
- Enhanced `loadPlans()` with:
  - **Exponential backoff retry** (up to 3 retries)
  - **15-second timeout** using AbortController
  - **Detailed logging** for debugging
  - **Error categorization** (timeout, network, other)
  - **User-friendly error messages**
- Modified plans loading effect to:
  - Wait for `providerLoading` to finish
  - Add 100ms delay before fetching
  - Ensure auth is fully initialized
- Added error UI with retry button in Goal Panel

**Key Code**:
```typescript
const loadPlans = async (retryCount = 0): Promise<boolean> => {
  const MAX_RETRIES = 3
  const TIMEOUT_MS = 15000
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    
    const response = await fetch('/api/plans/list', {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    // ... handle response
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError'
    const isNetworkError = error instanceof TypeError
    
    // Retry with exponential backoff
    if ((isTimeout || isNetworkError) && retryCount < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
      return loadPlans(retryCount + 1)
    }
    
    // Set user-friendly error message
    setLoadPlansError('...')
  }
}
```

**UI Error Display**:
```typescript
{loadPlansError ? (
  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
    {/* Error message display */}
  </div>
  <Button onClick={() => loadPlans(0)}>
    <RefreshCw /> Retry Loading Plans
  </Button>
) : loadingPlans ? (
  <Skeleton />
) : (
  {/* Normal content */}
)}
```

---

## Files Modified

1. ✅ `doer/src/app/api/health/route.ts` - NEW health check endpoint
2. ✅ `doer/src/app/onboarding/review/page.tsx` - Session validation before redirect
3. ✅ `doer/src/app/dashboard/page.tsx` - Retry logic and error handling

---

## Testing Checklist

### Manual Testing Steps:

1. **Normal Flow**:
   - ✅ Generate a plan via onboarding
   - ✅ Click "Accept Plan" on review page
   - ✅ Verify dashboard loads successfully
   - ✅ Verify active plan is displayed

2. **Session Expiry**:
   - ⏱️ Clear auth cookies
   - ⏱️ Click "Accept Plan"
   - ⏱️ Verify user is redirected to login

3. **Network Issues**:
   - ⏱️ Throttle network to simulate slow connection
   - ⏱️ Verify retry logic kicks in
   - ⏱️ Verify retry button appears after max retries

4. **Timeout Scenario**:
   - ⏱️ Add artificial delay to `/api/plans/list`
   - ⏱️ Verify timeout occurs after 15 seconds
   - ⏱️ Verify error message is user-friendly

5. **Recovery**:
   - ⏱️ After error appears, click "Retry Loading Plans"
   - ⏱️ Verify plans load successfully

---

## Additional Fix: AI Capacity Awareness

### Issue Found During Testing:
When testing with "Single Day Goal" from `TEST_GOAL_EXAMPLES.md`, the AI generated 270 minutes of tasks for a 1-day plan, but the realistic daily capacity is only 252 minutes (60% of 8-hour workday minus lunch).

### Solution:
Updated `doer/src/lib/ai.ts` prompt to include:
- ✅ Explicit daily capacity limit (250 minutes per day)
- ✅ Capacity formula for N-day plans (N × 250 minutes)
- ✅ Task duration guidelines (10-120 minutes per task)
- ✅ Example breakdown for 1-day presentation plan (200 minutes total)
- ✅ Critical warning for single-day plans to stay under 250 minutes

### Expected Result:
AI will now generate plans that fit within realistic daily capacity, preventing capacity validation errors.

---

## Benefits

✅ **Improved Reliability**: Automatic retry on transient failures
✅ **Better UX**: Clear error messages and recovery options
✅ **Reduced Support**: Users can self-recover from most issues
✅ **Better Debugging**: Detailed console logs for troubleshooting
✅ **Session Security**: Validates auth before sensitive operations

---

## Logging Output

When successful:
```
[Review] Validating auth session before dashboard redirect...
[Review] Health check passed: { healthy: true, userId: "..." }
[Review] Redirecting to dashboard...
[Dashboard] User authenticated, loading plans...
[Dashboard] Loading plans (attempt 1/4)...
[Dashboard] Plans loaded successfully: { count: 1, plans: [...] }
```

When retry occurs:
```
[Dashboard] Loading plans (attempt 1/4)...
[Dashboard] Error loading plans (attempt 1): AbortError
[Dashboard] Retrying in 1000ms...
[Dashboard] Loading plans (attempt 2/4)...
[Dashboard] Plans loaded successfully...
```

When error occurs:
```
[Dashboard] Loading plans (attempt 4/4)...
[Dashboard] Error loading plans (attempt 4): AbortError
Error displayed to user: "The dashboard is taking longer than expected to load..."
```

---

## Future Enhancements (Optional)

1. Add error boundary component to catch unexpected React errors
2. Implement optimistic UI updates
3. Add offline detection and messaging
4. Cache plans data for faster subsequent loads
5. Add Sentry or similar error tracking

---

## Related Documentation

- `DASHBOARD_TRANSITION_FIX.md` - Initial analysis
- `TEST_GOAL_EXAMPLES.md` - Test cases for AI plan generation


## Problem Solved

Fixed the timeout issue when transitioning from the onboarding review page to the dashboard after accepting an AI-generated plan.

---

## Root Causes Identified

1. **Race Condition**: Dashboard tried to fetch data before auth session was fully initialized
2. **No Session Validation**: Review page redirected without verifying auth state
3. **Missing Timeout Handling**: API calls could hang indefinitely
4. **No Retry Logic**: Single network failures caused complete loading failure
5. **Poor Error UX**: No user-friendly error messages or recovery options

---

## Implementation Details

### 1. Health Check Endpoint
**File**: `doer/src/app/api/health/route.ts` (NEW)

- Lightweight endpoint to verify auth session validity
- Returns user ID if authenticated, error otherwise
- Used before heavy data fetching operations

```typescript
GET /api/health
Response: { healthy: true, userId: string, timestamp: string }
```

### 2. Review Page Session Validation
**File**: `doer/src/app/onboarding/review/page.tsx`

**Changes**:
- Added `supabase` import for session checking
- Modified `handleAcceptPlan()` to validate auth before redirect
- Calls `/api/health` endpoint to verify session
- Attempts session refresh if health check fails
- Adds 300ms delay to ensure session propagation
- Provides user-friendly error messages

**Key Code**:
```typescript
const handleAcceptPlan = async () => {
  // ✅ VALIDATE AUTH SESSION before redirecting
  const healthCheck = await fetch('/api/health')
  
  if (!healthCheck.ok) {
    // Try to refresh the session
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      alert('Your session has expired. Please sign in again.')
      router.push('/login')
      return
    }
  }
  
  // Add delay to ensure session propagation
  await new Promise(resolve => setTimeout(resolve, 300))
  
  router.push('/dashboard')
}
```

### 3. Dashboard Retry Logic & Error Handling
**File**: `doer/src/app/dashboard/page.tsx`

**Changes**:
- Added `loadPlansError` state for tracking errors
- Enhanced `loadPlans()` with:
  - **Exponential backoff retry** (up to 3 retries)
  - **15-second timeout** using AbortController
  - **Detailed logging** for debugging
  - **Error categorization** (timeout, network, other)
  - **User-friendly error messages**
- Modified plans loading effect to:
  - Wait for `providerLoading` to finish
  - Add 100ms delay before fetching
  - Ensure auth is fully initialized
- Added error UI with retry button in Goal Panel

**Key Code**:
```typescript
const loadPlans = async (retryCount = 0): Promise<boolean> => {
  const MAX_RETRIES = 3
  const TIMEOUT_MS = 15000
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    
    const response = await fetch('/api/plans/list', {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    // ... handle response
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError'
    const isNetworkError = error instanceof TypeError
    
    // Retry with exponential backoff
    if ((isTimeout || isNetworkError) && retryCount < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
      return loadPlans(retryCount + 1)
    }
    
    // Set user-friendly error message
    setLoadPlansError('...')
  }
}
```

**UI Error Display**:
```typescript
{loadPlansError ? (
  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
    {/* Error message display */}
  </div>
  <Button onClick={() => loadPlans(0)}>
    <RefreshCw /> Retry Loading Plans
  </Button>
) : loadingPlans ? (
  <Skeleton />
) : (
  {/* Normal content */}
)}
```

---

## Files Modified

1. ✅ `doer/src/app/api/health/route.ts` - NEW health check endpoint
2. ✅ `doer/src/app/onboarding/review/page.tsx` - Session validation before redirect
3. ✅ `doer/src/app/dashboard/page.tsx` - Retry logic and error handling

---

## Testing Checklist

### Manual Testing Steps:

1. **Normal Flow**:
   - ✅ Generate a plan via onboarding
   - ✅ Click "Accept Plan" on review page
   - ✅ Verify dashboard loads successfully
   - ✅ Verify active plan is displayed

2. **Session Expiry**:
   - ⏱️ Clear auth cookies
   - ⏱️ Click "Accept Plan"
   - ⏱️ Verify user is redirected to login

3. **Network Issues**:
   - ⏱️ Throttle network to simulate slow connection
   - ⏱️ Verify retry logic kicks in
   - ⏱️ Verify retry button appears after max retries

4. **Timeout Scenario**:
   - ⏱️ Add artificial delay to `/api/plans/list`
   - ⏱️ Verify timeout occurs after 15 seconds
   - ⏱️ Verify error message is user-friendly

5. **Recovery**:
   - ⏱️ After error appears, click "Retry Loading Plans"
   - ⏱️ Verify plans load successfully

---

## Additional Fix: AI Capacity Awareness

### Issue Found During Testing:
When testing with "Single Day Goal" from `TEST_GOAL_EXAMPLES.md`, the AI generated 270 minutes of tasks for a 1-day plan, but the realistic daily capacity is only 252 minutes (60% of 8-hour workday minus lunch).

### Solution:
Updated `doer/src/lib/ai.ts` prompt to include:
- ✅ Explicit daily capacity limit (250 minutes per day)
- ✅ Capacity formula for N-day plans (N × 250 minutes)
- ✅ Task duration guidelines (10-120 minutes per task)
- ✅ Example breakdown for 1-day presentation plan (200 minutes total)
- ✅ Critical warning for single-day plans to stay under 250 minutes

### Expected Result:
AI will now generate plans that fit within realistic daily capacity, preventing capacity validation errors.

---

## Benefits

✅ **Improved Reliability**: Automatic retry on transient failures
✅ **Better UX**: Clear error messages and recovery options
✅ **Reduced Support**: Users can self-recover from most issues
✅ **Better Debugging**: Detailed console logs for troubleshooting
✅ **Session Security**: Validates auth before sensitive operations

---

## Logging Output

When successful:
```
[Review] Validating auth session before dashboard redirect...
[Review] Health check passed: { healthy: true, userId: "..." }
[Review] Redirecting to dashboard...
[Dashboard] User authenticated, loading plans...
[Dashboard] Loading plans (attempt 1/4)...
[Dashboard] Plans loaded successfully: { count: 1, plans: [...] }
```

When retry occurs:
```
[Dashboard] Loading plans (attempt 1/4)...
[Dashboard] Error loading plans (attempt 1): AbortError
[Dashboard] Retrying in 1000ms...
[Dashboard] Loading plans (attempt 2/4)...
[Dashboard] Plans loaded successfully...
```

When error occurs:
```
[Dashboard] Loading plans (attempt 4/4)...
[Dashboard] Error loading plans (attempt 4): AbortError
Error displayed to user: "The dashboard is taking longer than expected to load..."
```

---

## Future Enhancements (Optional)

1. Add error boundary component to catch unexpected React errors
2. Implement optimistic UI updates
3. Add offline detection and messaging
4. Cache plans data for faster subsequent loads
5. Add Sentry or similar error tracking

---

## Related Documentation

- `DASHBOARD_TRANSITION_FIX.md` - Initial analysis
- `TEST_GOAL_EXAMPLES.md` - Test cases for AI plan generation



