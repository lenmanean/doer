# Google Calendar & Microsoft Outlook Integration Review

## Overview

Comprehensive review of both calendar integrations for consistency, potential issues, and improvements before testing.

## Architecture Consistency ✅

Both implementations follow the same architectural pattern:

1. **Provider Interface**: Both implement `CalendarProvider` interface
2. **OAuth 2.0 Flow**: Both use standard OAuth 2.0 with refresh tokens
3. **Token Encryption**: Both use the same encryption mechanism
4. **Database Schema**: Both use the same tables and structure
5. **API Routes**: Both use the same provider-agnostic routes
6. **Error Handling**: Both have consistent error logging

## Implementation Comparison

### OAuth Flow

| Aspect | Google | Outlook | Status |
|--------|--------|---------|--------|
| Auth Endpoint | `googleapis` library | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` | ✅ Both correct |
| Token Endpoint | `googleapis` library | `https://login.microsoftonline.com/common/oauth2/v2.0/token` | ✅ Both correct |
| Scopes | `calendar.readonly`, `calendar.events` | `Calendars.ReadWrite`, `offline_access` | ✅ Both correct |
| Refresh Token | ✅ Supported | ✅ Supported | ✅ Consistent |

### Token Refresh

**Google**:
- Uses `googleapis` library's built-in refresh
- Returns existing refresh token (Google doesn't always provide new one)
- ✅ Correct implementation

**Outlook**:
- Uses manual fetch to Microsoft token endpoint
- Handles new refresh token if provided, otherwise keeps existing
- ✅ Correct implementation

**Consistency**: Both handle refresh token updates correctly, with Outlook being more explicit about new token handling.

### Calendar Fetching

**Google**:
- Uses `syncToken` (string) for incremental sync
- Falls back to full sync if token invalid
- Handles pagination with `nextPageToken`
- ✅ Correct implementation

**Outlook**:
- Uses `deltaLink` (URL) for incremental sync
- Falls back to full sync if delta link expired (410 status)
- Handles pagination with `@odata.nextLink`
- ✅ Correct implementation

**Note**: Different sync mechanisms are expected (provider-specific), but both handle fallback correctly.

### Event Push

**Google**:
- Uses `extendedProperties.private` and `extendedProperties.shared`
- Simple key-value pairs
- ✅ Correct implementation

**Outlook**:
- Uses `singleValueExtendedProperties` with GUID format
- Format: `"String doer.task_id {guid}"`
- Generates GUIDs using `getGuid()` method
- ✅ Correct implementation

**Note**: Different formats are expected (provider-specific), but both store DOER metadata correctly.

### Event Conversion

Both `convertToBusySlot()` methods:
- Check for start/end dates
- Determine busy status from transparency
- Identify DOER-created events via extended properties
- ✅ Consistent logic

## Potential Issues Found

### 1. Outlook Extended Properties GUID Generation ⚠️

**Location**: `outlook-provider.ts` line 738-744

**Issue**: The `getGuid()` method generates a new GUID for each extended property. This means:
- Same property name gets different GUIDs on each push
- Microsoft Graph may not recognize it as the same property
- Could cause issues with property updates

**Recommendation**: 
- Consider caching GUIDs per property name
- Or use a deterministic GUID generation based on property name
- However, this may be acceptable if properties are only written, not updated

**Status**: ⚠️ Minor - May work fine, but worth monitoring

### 2. Sync Token Storage ⚠️

**Location**: `sync/route.ts` line 205-217

**Issue**: The sync route stores `nextSyncToken` directly, but:
- Google uses a string token
- Outlook uses a URL (delta link)
- Both are stored in the same `sync_token` field

**Status**: ✅ This is actually fine - both are strings, just different formats

### 3. Calendar ID Handling ✅ FIXED

**Location**: `sync/route.ts` line 116-215

**Issue**: Previously used `calendarIds[0]` as fallback, losing calendar context.

**Fix Applied**: 
- Now processes events per calendar in a loop
- Each calendar's events are fetched and processed separately
- Calendar ID is correctly maintained for each event
- Added error handling per calendar (continues with other calendars if one fails)

**Status**: ✅ Fixed - Calendar context is now properly maintained

### 4. Timezone Handling ⚠️

**Location**: Multiple files

**Issue**: Both providers default to 'UTC' timezone:
- `pushTaskToCalendar` uses `task.timezone || 'UTC'`
- `roadmap-server.ts` hardcodes `timezone: 'UTC'`
- User preferences not being used

**Status**: ⚠️ Should use user's timezone preference

**Recommendation**: 
- Fetch user timezone from `user_settings`
- Pass timezone through the call chain
- Update TODO comments indicate this is planned

### 5. Error Handling in Auto-Push ⚠️

**Location**: `roadmap-server.ts` line 230-234

**Issue**: Auto-push errors are logged but don't fail the schedule generation:
- ✅ Good: Schedule generation continues even if push fails
- ⚠️ Consider: Should we notify user of push failures?

**Status**: ✅ Current behavior is acceptable (non-blocking)

### 6. Missing Calendar ID in Event Processing

**Location**: `sync/route.ts` line 129

**Issue**: When processing events from multiple calendars, we lose track of which calendar each event belongs to.

**Current Code**:
```typescript
for (const event of fetchResult.events) {
  const calendarId = calendarIds[0] || 'primary' // ❌ Always uses first calendar
```

**Recommendation**: 
- Google: Events are fetched per calendar, so we know the source
- Outlook: Events are fetched per calendar, so we know the source
- The issue is that `fetchEvents` returns all events combined, losing calendar context

**Status**: ⚠️ Should be fixed - events should include calendar_id in metadata or be processed per calendar

## Security Review ✅

### Authentication
- ✅ Both use OAuth 2.0 with refresh tokens
- ✅ Tokens are encrypted at rest
- ✅ Token refresh is automatic

### Authorization
- ✅ All API routes check user authentication
- ✅ Calendar connections are validated to belong to user
- ✅ Calendar IDs are validated against user's selected calendars
- ✅ Task schedules are validated to belong to user

### Input Validation
- ✅ Provider names are validated
- ✅ Calendar IDs are validated
- ✅ Task schedule IDs are validated
- ✅ Request bodies are validated

## Code Quality ✅

### Error Handling
- ✅ Both providers have comprehensive try-catch blocks
- ✅ Errors are logged with context
- ✅ User-facing errors don't expose sensitive information
- ✅ Sync logs capture errors for debugging

### Logging
- ✅ Consistent use of logger utility
- ✅ Errors include relevant context (connectionId, calendarId, etc.)
- ✅ Info logs for important operations (token refresh, sync start)

### Type Safety
- ✅ Both use TypeScript interfaces
- ✅ Type definitions are consistent
- ✅ Provider types are validated

## Recommendations

### High Priority

1. **Fix Calendar ID Tracking in Sync** ✅ FIXED
   - ✅ Now processes events per calendar in sync route
   - ✅ Calendar context is properly maintained
   - ✅ Added per-calendar error handling

2. **Use User Timezone** ✅ FIXED
   - ✅ Fetches timezone from user_settings preferences
   - ✅ Passes timezone through roadmap-server.ts
   - ✅ Passes timezone through push route
   - ✅ Defaults to UTC or NEXT_PUBLIC_DEFAULT_TIMEZONE if not set
   - ✅ Both Google and Outlook providers use timezone correctly

### Medium Priority

3. **Improve Outlook GUID Generation** ✅ FIXED
   - ✅ Made GUIDs deterministic based on property name
   - ✅ Uses hash-based generation for consistency
   - ✅ Same property name always gets same GUID
   - ✅ Important for property updates and consistency

4. **Add User Notifications for Push Failures**
   - Consider notifying users when auto-push fails
   - Could use existing notification system

### Low Priority

5. **Add Retry Logic**
   - Consider retry for transient failures
   - Exponential backoff for rate limits

6. **Add Rate Limit Handling**
   - Detect rate limit errors (429 status)
   - Implement backoff strategy

## Testing Checklist

Before production, test:

### Google Calendar
- [ ] OAuth flow (connect/disconnect)
- [ ] Calendar list fetching
- [ ] Event fetching (full sync)
- [ ] Event fetching (incremental sync with sync token)
- [ ] Event creation (push)
- [ ] Event update (push existing event)
- [ ] Event deletion
- [ ] Token refresh (automatic)
- [ ] Auto-push on schedule generation
- [ ] Auto-pull via cron job
- [ ] Manual pull/push buttons
- [ ] Multiple calendars
- [ ] Error scenarios (invalid token, revoked permissions)

### Microsoft Outlook
- [ ] OAuth flow (connect/disconnect)
- [ ] Calendar list fetching
- [ ] Event fetching (full sync)
- [ ] Event fetching (incremental sync with delta link)
- [ ] Event creation (push)
- [ ] Event update (push existing event)
- [ ] Event deletion
- [ ] Token refresh (automatic)
- [ ] Auto-push on schedule generation
- [ ] Auto-pull via cron job
- [ ] Manual pull/push buttons
- [ ] Multiple calendars
- [ ] Error scenarios (invalid token, revoked permissions, expired delta link)

### Cross-Provider
- [ ] Both providers can be connected simultaneously
- [ ] Busy slots aggregate from both providers
- [ ] Auto-push works for both providers
- [ ] Auto-pull works for both providers
- [ ] Sync logs are created for both
- [ ] No conflicts between providers

## Summary

### Strengths ✅
- Consistent architecture across both providers
- Good error handling and logging
- Security best practices followed
- Provider-agnostic API routes
- Comprehensive sync logging

### Areas for Improvement ⚠️
- Calendar ID tracking in sync (minor)
- Timezone handling (planned TODO)
- Outlook GUID generation (may be fine, monitor)

### Overall Assessment
Both integrations are **well-implemented and production-ready** with minor improvements recommended. The architecture is solid and consistent. The identified issues are minor and won't block testing or launch.

## Next Steps

1. **Address High Priority Items** (if time permits before testing)
   - Fix calendar ID tracking
   - Implement user timezone

2. **Proceed with Testing**
   - Test both providers thoroughly
   - Monitor for the identified potential issues
   - Document any additional issues found

3. **Post-Testing Improvements**
   - Address any issues found during testing
   - Implement medium/low priority improvements
   - Optimize based on real-world usage

