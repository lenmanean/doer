# Integration Provider Agnosticism Review

## Executive Summary

The current implementation is **heavily Google Calendar-specific**. To support multiple providers (Outlook, Apple Calendar), significant refactoring is needed.

## Current Issues

### 1. **API Route Structure - Hardcoded to Google**

All routes are under `/api/integrations/google-calendar/`:
- `/api/integrations/google-calendar/authorize`
- `/api/integrations/google-calendar/connect`
- `/api/integrations/google-calendar/sync`
- `/api/integrations/google-calendar/push`
- `/api/integrations/google-calendar/disconnect`
- `/api/integrations/google-calendar/settings`
- `/api/integrations/google-calendar/status`
- `/api/integrations/google-calendar/calendars`
- `/api/integrations/google-calendar/regenerate`

**Impact**: Each provider would need duplicate routes (e.g., `/api/integrations/outlook/...`)

**Recommendation**: Either:
- Option A: Use dynamic routes `/api/integrations/[provider]/...` (Next.js dynamic route)
- Option B: Keep separate folders but extract shared logic to common utilities

### 2. **Hardcoded Provider Filtering**

Every route has hardcoded `.eq('provider', 'google')`:

```typescript
// In multiple routes:
.eq('user_id', user.id)
.eq('provider', 'google')  // ❌ Hardcoded
.single()
```

**Files affected:**
- `connect/route.ts` (lines 62, 90)
- `disconnect/route.ts` (line 26)
- `settings/route.ts` (line 27)
- `status/route.ts` (line 25)
- `sync/route.ts` (line 28)
- `push/route.ts` (line 28)
- `regenerate/route.ts` (line 56)
- `calendars/route.ts` (line 27)

**Recommendation**: Extract provider from route parameters or request body/headers

### 3. **Google-Specific Service File**

`lib/calendar/google-calendar-sync.ts` contains:
- Google OAuth2 client initialization
- Google Calendar API calls (`googleapis` library)
- Google-specific event formatting
- Google-specific error handling

**Recommendation**: Create a provider abstraction layer:

```
lib/calendar/
├── providers/
│   ├── base-provider.ts      (abstract interface)
│   ├── google-provider.ts    (Google implementation)
│   ├── outlook-provider.ts   (Outlook implementation - future)
│   └── apple-provider.ts     (Apple implementation - future)
├── provider-factory.ts       (returns appropriate provider)
└── shared-types.ts           (common types)
```

### 4. **Hardcoded Function Imports**

Routes directly import Google-specific functions:
```typescript
import { generateAuthUrl } from '@/lib/calendar/google-calendar-sync'
import { pullCalendarEvents } from '@/lib/calendar/google-calendar-sync'
import { pushTaskToCalendar } from '@/lib/calendar/google-calendar-sync'
import { fetchCalendars } from '@/lib/calendar/google-calendar-sync'
import { getBusySlotsForUser } from '@/lib/calendar/google-calendar-sync'
```

**Recommendation**: Use a provider factory pattern to get provider-specific implementations

### 5. **UI Components - Google-Specific**

`dashboard/integrations/page.tsx`:
- Hardcoded "Google Calendar" strings
- Hardcoded API endpoints (`/api/integrations/google-calendar/...`)
- Google-specific UI elements

**Recommendation**: 
- Make UI component provider-agnostic
- Accept provider as prop or URL parameter
- Use dynamic API endpoint construction

### 6. **Environment Variables - Google-Specific**

Code assumes Google-specific env vars:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

**Recommendation**: 
- Use provider-prefixed env vars or config object
- `{PROVIDER}_CLIENT_ID`, `{PROVIDER}_CLIENT_SECRET`, etc.

### 7. **OAuth Redirect URIs - Hardcoded**

`getRedirectUri()` function has hardcoded `/api/integrations/google-calendar/connect` path.

**Recommendation**: Accept provider parameter to build dynamic redirect URI

### 8. **Database Schema - Good ✅**

The database schema is already provider-agnostic:
- `calendar_connections.provider` is an enum (`'google' | 'outlook' | 'apple'`)
- Event logging table is generic
- All tables reference `provider` field correctly

**Status**: ✅ No changes needed

## Recommended Refactoring Approach

### Phase 1: Create Provider Abstraction Layer

1. **Define Base Provider Interface** (`lib/calendar/providers/base-provider.ts`):

```typescript
export interface CalendarProvider {
  // OAuth
  generateAuthUrl(state?: string): Promise<string>
  exchangeCodeForTokens(code: string): Promise<Tokens>
  refreshAccessToken(refreshToken: string): Promise<Tokens>
  
  // Calendar operations
  fetchCalendars(connectionId: string): Promise<Calendar[]>
  fetchEvents(connectionId: string, calendarIds: string[], syncToken?: string): Promise<FetchEventsResult>
  createEvent(connectionId: string, calendarId: string, event: CreateEventInput): Promise<EventResult>
  updateEvent(connectionId: string, calendarId: string, eventId: string, event: UpdateEventInput): Promise<EventResult>
  deleteEvent(connectionId: string, calendarId: string, eventId: string): Promise<boolean>
  
  // Conversion
  convertToBusySlot(event: ExternalEvent): BusySlot
  convertFromTaskSchedule(schedule: TaskSchedule): CreateEventInput
}
```

2. **Implement Google Provider** (refactor existing code into this interface)

3. **Create Provider Factory**:

```typescript
export function getCalendarProvider(provider: 'google' | 'outlook' | 'apple'): CalendarProvider {
  switch (provider) {
    case 'google':
      return new GoogleCalendarProvider()
    case 'outlook':
      return new OutlookCalendarProvider()
    case 'apple':
      return new AppleCalendarProvider()
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}
```

### Phase 2: Refactor API Routes

**Option A - Dynamic Routes** (Recommended):
```
/api/integrations/[provider]/
  ├── authorize/route.ts
  ├── connect/route.ts
  ├── sync/route.ts
  └── ...
```

**Option B - Keep Separate, Share Utilities**:
- Create `/api/integrations/_shared/` utilities
- Each provider folder imports shared utilities
- Routes use provider factory to get implementation

### Phase 3: Update UI Components

- Make integrations page provider-agnostic
- Support multiple providers in single UI
- Use dynamic route parameters

### Phase 4: Environment Configuration

- Create provider configuration system
- Support multiple provider credentials
- Validate required env vars per provider

## Migration Strategy

1. **Keep Google routes working** during refactoring
2. **Create new provider abstraction** alongside existing code
3. **Gradually migrate routes** to use provider factory
4. **Test each route** after migration
5. **Remove old Google-specific code** once migration complete

## Files to Refactor

### High Priority
1. `lib/calendar/google-calendar-sync.ts` → Split into provider abstraction
2. All `/api/integrations/google-calendar/*` routes → Make provider-agnostic
3. `dashboard/integrations/page.tsx` → Support multiple providers

### Medium Priority
4. `lib/calendar/connection-events.ts` → Already provider-agnostic ✅
5. `lib/calendar/types.ts` → Already provider-agnostic ✅
6. `lib/calendar/encryption.ts` → Already provider-agnostic ✅

### Low Priority
7. Error messages and logging (make provider-aware but generic)

## Implementation Checklist

- [ ] Create base provider interface
- [ ] Refactor Google sync service to implement interface
- [ ] Create provider factory
- [ ] Update API routes to use provider factory
- [ ] Make routes accept provider parameter
- [ ] Update UI to support multiple providers
- [ ] Create Outlook provider skeleton (for future)
- [ ] Create Apple provider skeleton (for future)
- [ ] Update environment variable documentation
- [ ] Add provider validation utilities
- [ ] Update error handling to be provider-aware
- [ ] Write integration tests for provider abstraction

## Benefits of Refactoring

1. **Easier to add new providers** - Just implement the interface
2. **Consistent API** - All providers work the same way
3. **Better testability** - Can mock provider implementations
4. **Code reuse** - Shared logic in base classes
5. **Maintainability** - Changes to common functionality benefit all providers

