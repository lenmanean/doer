# Calendar Integrations - Fixes Applied

## Summary

All identified issues from the review have been addressed and committed to git.

## Fixes Applied

### 1. Calendar ID Tracking in Sync Route ✅

**Issue**: Events from multiple calendars were losing calendar context, defaulting to first calendar ID.

**Fix**: 
- Modified `sync/route.ts` to process events per calendar in a loop
- Each calendar's events are fetched and processed separately
- Calendar ID is correctly maintained for each event
- Added per-calendar error handling (continues with other calendars if one fails)

**Files Modified**:
- `doer/src/app/api/integrations/[provider]/sync/route.ts`

### 2. Timezone Handling ✅

**Issue**: Both providers defaulted to UTC, not using user timezone preferences.

**Fix**:
- Added timezone fetching from `user_settings.preferences.timezone`
- Updated `roadmap-server.ts` to fetch and use user timezone
- Updated `push/route.ts` to fetch and use user timezone
- Both Google and Outlook providers now use the provided timezone
- Defaults to `NEXT_PUBLIC_DEFAULT_TIMEZONE` or 'UTC' if not set

**Files Modified**:
- `doer/src/lib/roadmap-server.ts`
- `doer/src/app/api/integrations/[provider]/push/route.ts`
- `doer/src/lib/calendar/providers/google-provider.ts` (timezone variable extraction)
- `doer/src/lib/calendar/providers/outlook-provider.ts` (already had timezone variable)

**Note**: Timezone must be stored in `user_settings.preferences.timezone` for this to work. Currently defaults to UTC if not present.

### 3. Outlook GUID Generation ✅

**Issue**: Outlook extended properties used random GUIDs, causing potential issues with property updates.

**Fix**:
- Made GUID generation deterministic based on property name
- Uses hash-based generation for consistency
- Same property name always generates the same GUID
- Important for property updates and consistency

**Files Modified**:
- `doer/src/lib/calendar/providers/outlook-provider.ts`
  - Updated `getGuid()` method to accept property name parameter
  - Implemented deterministic hash-based GUID generation
  - Updated all calls to pass property name

## Testing Recommendations

After these fixes, test:

1. **Calendar ID Tracking**:
   - Connect multiple calendars
   - Sync events
   - Verify each event has correct `calendar_id` in database

2. **Timezone Handling**:
   - Set timezone in user settings (if available)
   - Generate a plan with scheduled tasks
   - Verify events are created with correct timezone
   - Check calendar events show correct local time

3. **Outlook GUID Consistency**:
   - Push tasks to Outlook calendar
   - Update tasks and push again
   - Verify extended properties are updated correctly (not duplicated)

## Commit Details

**Commit Message**:
```
Fix calendar integration issues: timezone handling, Outlook GUID generation, and calendar ID tracking

- Fixed calendar ID tracking in sync route to process events per calendar
- Added timezone support from user preferences (defaults to UTC if not set)
- Made Outlook extended property GUIDs deterministic based on property name
- Improved error handling per calendar in sync operations
- Updated roadmap-server and push route to use user timezone
- All fixes maintain consistency with existing Google/Outlook implementations
```

## Status

✅ All issues addressed
✅ Code committed to git
✅ Ready for testing


