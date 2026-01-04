# Trello Integration Deep Review Report

**Date:** 2025-01-02  
**Reviewer:** AI Assistant  
**Scope:** Comprehensive review of Trello integration implementation

---

## Executive Summary

This comprehensive review identified **11 issues** (6 critical, 2 high priority, 2 medium priority, 1 low priority) that prevent the Trello integration from functioning properly in production. 

**Critical Findings:**
- **4 missing API routes** that the frontend expects to exist (projects, settings, disconnect, sync-completion)
- **2 missing integration points** where Trello sync hooks are not called (reschedule sync, completion sync)

The most severe issues are missing API routes that will cause 404 errors in the UI, preventing users from:
- Loading and selecting Trello boards
- Saving integration settings
- Disconnecting the integration
- Syncing task completion status
- Syncing reschedule proposals

---

## Critical Issues (Must Fix Before Production)

### 🔴 CRITICAL ISSUE #1: Missing Sync-Completion API Route

**Location:** `doer/src/app/api/integrations/trello/sync-completion/route.ts` (FILE DOES NOT EXIST)

**Problem:**
- Todoist has `/api/integrations/todoist/sync-completion`
- Asana has `/api/integrations/asana/sync-completion`
- **Trello is missing this route entirely**
- `roadmap-client.ts` calls sync-completion endpoints for Todoist and Asana, but not Trello

**Impact:**
- Task completion/uncompletion in DOER will NOT sync to Trello
- Users will see tasks marked complete in DOER but not in Trello
- Breaks the core functionality of the integration

**Evidence:**
```typescript
// doer/src/lib/roadmap-client.ts:499-525
// Sync completion status to Todoist if linked and auto_completion_sync is enabled
try {
  await fetch('/api/integrations/todoist/sync-completion', { ... })
}

// Sync completion status to Asana if linked and auto_completion_sync is enabled
try {
  await fetch('/api/integrations/asana/sync-completion', { ... })
}

// ❌ MISSING: No call to Trello sync-completion
```

**Fix Required:**
1. Create `doer/src/app/api/integrations/trello/sync-completion/route.ts`
2. Mirror the structure of `asana/sync-completion/route.ts`
3. Call `syncTaskCompletionToTrello` from sync-hooks
4. Add call in `roadmap-client.ts` to sync completion to Trello

---

### 🔴 CRITICAL ISSUE #2: Missing Disconnect API Route

**Location:** `doer/src/app/api/integrations/trello/disconnect/route.ts` (FILE DOES NOT EXIST)

**Problem:**
- Todoist has `/api/integrations/todoist/disconnect`
- **Trello is missing this route entirely**
- Users cannot disconnect their Trello integration

**Impact:**
- Users cannot remove their Trello connection
- Violates user data control expectations
- May cause issues if users want to reconnect with different account

**Evidence:**
```bash
# Todoist has disconnect route
doer/src/app/api/integrations/todoist/disconnect/route.ts ✅

# Trello missing disconnect route
doer/src/app/api/integrations/trello/disconnect/route.ts ❌ NOT FOUND
```

**Fix Required:**
1. Create `doer/src/app/api/integrations/trello/disconnect/route.ts`
2. Mirror the structure of `todoist/disconnect/route.ts`
3. Delete connection from `task_management_connections` table
4. Cascade will handle deleting related links

---

### 🔴 CRITICAL ISSUE #3: Missing Reschedule Sync Call

**Location:** `doer/src/lib/task-auto-rescheduler.ts:1237-1250`

**Problem:**
- When applying reschedule proposals, Todoist and Asana sync hooks are called
- **Trello sync hook is NOT called**
- Reschedule proposals will not sync to Trello

**Impact:**
- When users approve AI reschedule proposals, Trello cards won't be updated
- Tasks will be rescheduled in DOER but remain on old dates in Trello
- Breaks synchronization between DOER and Trello

**Evidence:**
```typescript
// doer/src/lib/task-auto-rescheduler.ts:1222-1250
// Sync reschedule to Todoist if linked
try {
  const { syncTaskRescheduleToTodoist } = await import('@/lib/task-management/sync-hooks')
  await syncTaskRescheduleToTodoist(...)
}

// Sync reschedule to Asana if linked
try {
  const { syncTaskRescheduleToAsana } = await import('@/lib/task-management/sync-hooks')
  await syncTaskRescheduleToAsana(...)
}

// ❌ MISSING: No call to syncTaskRescheduleToTrello
```

**Fix Required:**
1. Add Trello reschedule sync call after Asana sync in `applyRescheduleProposal`
2. Import `syncTaskRescheduleToTrello` from sync-hooks
3. Call with same parameters as Todoist/Asana

---

### 🔴 CRITICAL ISSUE #4: Missing Completion Sync Call in roadmap-client

**Location:** `doer/src/lib/roadmap-client.ts:499-525`

**Problem:**
- `updateTaskCompletionUnified` calls sync-completion endpoints for Todoist and Asana
- **Trello sync-completion endpoint is NOT called**
- Even if the route existed, it wouldn't be called

**Impact:**
- Task completion changes won't sync to Trello
- Users marking tasks complete in DOER won't see them move to "Done" list in Trello
- Breaks core integration functionality

**Evidence:**
```typescript
// doer/src/lib/roadmap-client.ts:499-525
// Sync completion status to Todoist if linked and auto_completion_sync is enabled
try {
  await fetch('/api/integrations/todoist/sync-completion', { ... })
}

// Sync completion status to Asana if linked and auto_completion_sync is enabled
try {
  await fetch('/api/integrations/asana/sync-completion', { ... })
}

// ❌ MISSING: No call to Trello sync-completion endpoint
```

**Fix Required:**
1. Add Trello sync-completion fetch call after Asana call
2. Use same pattern as Todoist/Asana (best-effort, catch errors)
3. Call `/api/integrations/trello/sync-completion`

---

## High Priority Issues

### 🟠 HIGH PRIORITY ISSUE #5: Type Safety Issues in Sync Hooks

**Location:** `doer/src/lib/task-management/sync-hooks.ts:456, 567`

**Problem:**
- Using `as any` for `link.task_management_connections` type casting
- Same issue that was fixed in Asana integration
- No runtime type checking

**Impact:**
- Potential runtime errors if connection structure changes
- Type safety violations
- Inconsistent with fixed Asana implementation

**Evidence:**
```typescript
// doer/src/lib/task-management/sync-hooks.ts:456
const connection = link.task_management_connections as any
if (!connection || connection.provider !== 'trello') {
  return
}

// doer/src/lib/task-management/sync-hooks.ts:567
const connection = link.task_management_connections as any
if (!connection || connection.provider !== 'trello' || !connection.auto_completion_sync) {
  return
}
```

**Fix Required:**
1. Replace `as any` with proper type checking
2. Use `Array.isArray()` check like Asana fix
3. Extract connection with proper type assertion

---

### 🟠 HIGH PRIORITY ISSUE #6: reopenTask Type Casting Pattern

**Location:** `doer/src/lib/task-management/sync-hooks.ts:592`

**Problem:**
- Using `Partial<TrelloProvider>` and `typeof` check for `reopenTask`
- Same pattern that was fixed in Asana (changed to direct import cast)
- Inconsistent with fixed Asana implementation

**Impact:**
- Unnecessary type checking overhead
- Inconsistent codebase patterns
- Type safety concerns

**Evidence:**
```typescript
// doer/src/lib/task-management/sync-hooks.ts:592
const trelloProvider = provider as Partial<TrelloProvider>

if (typeof trelloProvider.reopenTask === 'function') {
  const result = await trelloProvider.reopenTask(...)
}
```

**Fix Required:**
1. Change to direct import cast like Asana: `import('./providers/trello-provider').TrelloProvider`
2. Remove `typeof` check (TrelloProvider always implements reopenTask)
3. Call `reopenTask` directly

---

## Medium Priority Issues

### 🟡 MEDIUM PRIORITY ISSUE #7: Missing API Request Timeout

**Location:** `doer/src/lib/task-management/providers/trello-provider.ts:281-336`

**Problem:**
- `makeApiRequest` method doesn't have a timeout
- Asana provider has 30-second timeout using `AbortController`
- Trello requests can hang indefinitely

**Impact:**
- API requests can hang if Trello is slow or unresponsive
- No protection against network issues
- Inconsistent with Asana implementation

**Evidence:**
```typescript
// doer/src/lib/task-management/providers/trello-provider.ts:296-302
const response = await fetch(url.toString(), {
  ...options,
  headers: {
    'Content-Type': 'application/json',
    ...options.headers,
  },
})
// ❌ No timeout mechanism
```

**Fix Required:**
1. Add `AbortController` with 30-second timeout
2. Pass `signal` to fetch options
3. Clear timeout on success/error
4. Handle `AbortError` specifically

---

### 🟡 MEDIUM PRIORITY ISSUE #8: Due Date Format Verification

**Location:** `doer/src/lib/task-management/providers/trello-provider.ts:499-507`

**Problem:**
- Comment says "Trello accepts ISO format" but no verification
- Trello API expects ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
- Current implementation passes `dueDate` or `dueDateTime` directly
- Need to ensure proper ISO format conversion

**Impact:**
- Potential API errors if date format is incorrect
- Cards may not have due dates set correctly
- Inconsistent behavior

**Evidence:**
```typescript
// doer/src/lib/task-management/providers/trello-provider.ts:499-507
// Format due date (Trello accepts ISO format)
const dueDate = task.dueDateTime || task.dueDate

// Create card
const cardData: Partial<TrelloCard> = {
  name: task.taskName,
  desc: description || undefined,
  idList: listId,
  due: dueDate || undefined,  // ❌ May not be proper ISO format
  idLabels: labelIds.length > 0 ? labelIds : undefined,
}
```

**Fix Required:**
1. Verify Trello API documentation for exact date format requirements
2. Add date format conversion if needed (ensure ISO 8601)
3. Handle both date-only (YYYY-MM-DD) and datetime (ISO 8601) formats
4. Test with various date inputs

---

## Low Priority Issues

### 🔵 LOW PRIORITY ISSUE #9: Missing Error Handling for Connection Data

**Location:** `doer/src/lib/task-management/sync-hooks.ts:456, 567`

**Problem:**
- Similar to Asana fix, should use `Array.isArray()` check for nested relations
- Supabase can return arrays or single objects for nested relations
- Current code assumes single object

**Impact:**
- Potential runtime errors if Supabase returns array
- Inconsistent with Asana implementation

**Fix Required:**
1. Add `Array.isArray()` check before accessing connection
2. Extract connection with proper handling: `Array.isArray(connectionData) ? connectionData[0] : connectionData`
3. Match pattern used in Asana fixes

---

## Additional Critical Issues Found (Frontend/Backend Review)

### 🔴 CRITICAL ISSUE #5: Missing Projects API Route

**Location:** `doer/src/app/api/integrations/trello/projects/route.ts` (FILE DOES NOT EXIST)

**Problem:**
- Frontend calls `/api/integrations/${provider}/projects` at line 304 of `[provider]/page.tsx`
- Todoist has `/api/integrations/todoist/projects`
- Asana has `/api/integrations/asana/projects`
- **Trello is missing this route entirely**

**Impact:**
- Users cannot see or select Trello boards in the UI
- Default project selection dropdown will fail
- Settings page will show "No projects found" error

**Evidence:**
```typescript
// doer/src/app/integrations/[provider]/page.tsx:304
const response = await fetch(`/api/integrations/${provider}/projects`)
// ❌ This will 404 for Trello
```

**Fix Required:**
1. Create `doer/src/app/api/integrations/trello/projects/route.ts`
2. Mirror structure of `todoist/projects/route.ts` or `asana/projects/route.ts`
3. Call `provider.getProjects(connection.id)` to fetch Trello boards

---

### 🔴 CRITICAL ISSUE #6: Missing Settings API Route

**Location:** `doer/src/app/api/integrations/trello/settings/route.ts` (FILE DOES NOT EXIST)

**Problem:**
- Frontend calls `/api/integrations/${provider}/settings` at line 1115 of `[provider]/page.tsx`
- Todoist has `/api/integrations/todoist/settings` (GET and POST)
- Asana has `/api/integrations/asana/settings` (GET and POST)
- **Trello is missing this route entirely**

**Impact:**
- Users cannot update default project, auto-push, or auto-completion sync settings
- Settings changes will fail with 404 error
- UI will show error toasts when trying to save settings

**Evidence:**
```typescript
// doer/src/app/integrations/[provider]/page.tsx:1115
const response = await fetch(`/api/integrations/${provider}/settings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    default_project_id: projectId,
    auto_push_enabled: autoPush,
    auto_completion_sync: autoCompletionSync,
  }),
})
// ❌ This will 404 for Trello
```

**Fix Required:**
1. Create `doer/src/app/api/integrations/trello/settings/route.ts`
2. Implement GET handler to retrieve current settings
3. Implement POST handler to update settings (default_project_id, auto_push_enabled, auto_completion_sync)
4. Mirror structure of `todoist/settings/route.ts` or `asana/settings/route.ts`

---

## Summary of Required Fixes

### Critical (Must Fix):
1. ✅ Create `/api/integrations/trello/sync-completion/route.ts`
2. ✅ Create `/api/integrations/trello/disconnect/route.ts`
3. ✅ Create `/api/integrations/trello/projects/route.ts`
4. ✅ Create `/api/integrations/trello/settings/route.ts`
5. ✅ Add Trello reschedule sync call in `task-auto-rescheduler.ts`
6. ✅ Add Trello completion sync call in `roadmap-client.ts`

### High Priority:
7. ✅ Fix type safety issues in sync hooks (replace `as any`)
8. ✅ Fix `reopenTask` type casting pattern (direct import cast)

### Medium Priority:
9. ✅ Add API request timeout to Trello provider
10. ✅ Verify and fix due date format for Trello API

### Low Priority:
11. ✅ Add error handling for connection data (Array.isArray check)

---

## Files That Need Changes

1. `doer/src/app/api/integrations/trello/sync-completion/route.ts` - **CREATE NEW**
2. `doer/src/app/api/integrations/trello/disconnect/route.ts` - **CREATE NEW**
3. `doer/src/app/api/integrations/trello/projects/route.ts` - **CREATE NEW**
4. `doer/src/app/api/integrations/trello/settings/route.ts` - **CREATE NEW**
5. `doer/src/lib/task-auto-rescheduler.ts` - **MODIFY**
6. `doer/src/lib/roadmap-client.ts` - **MODIFY**
7. `doer/src/lib/task-management/sync-hooks.ts` - **MODIFY**
8. `doer/src/lib/task-management/providers/trello-provider.ts` - **MODIFY**

---

## Testing Checklist

After fixes are applied, test:
- [ ] **Frontend UI:**
  - [ ] Projects/boards load correctly in dropdown
  - [ ] Default project selection works
  - [ ] Settings can be saved (auto-push, auto-completion sync)
  - [ ] Disconnect button works
  - [ ] "Push Tasks" button works
  - [ ] "Sync Plan" button works
- [ ] **Backend Functionality:**
  - [ ] Task completion syncs to Trello (moves card to "Done" list)
  - [ ] Task uncompletion syncs to Trello (moves card back from "Done" list)
  - [ ] Reschedule proposals update Trello card due dates
  - [ ] Users can disconnect Trello integration
  - [ ] API requests timeout after 30 seconds
  - [ ] Due dates are formatted correctly in Trello
  - [ ] Type safety is maintained (no `as any` casts)
  - [ ] Error handling works for edge cases

---

## Frontend UI Review

### ✅ Frontend Integration Points (Working):
- ✅ Trello is recognized as task management integration (`isTaskManagementIntegration` check includes 'trello')
- ✅ Frontend calls correct status endpoint (`/api/integrations/trello/status`)
- ✅ Frontend has UI for project selection, auto-push, and auto-completion sync toggles
- ✅ Frontend has "Push Tasks" and "Sync Plan" buttons
- ✅ Frontend has disconnect button that calls `/api/integrations/${provider}/disconnect`
- ✅ Frontend attempts to load projects via `/api/integrations/${provider}/projects`
- ✅ Frontend attempts to save settings via `/api/integrations/${provider}/settings`

### ❌ Frontend Issues (Backend Missing):
- ❌ Projects API route missing (frontend will 404 when loading boards)
- ❌ Settings API route missing (frontend will 404 when saving settings)
- ❌ Disconnect API route missing (frontend will 404 when disconnecting)
- ❌ Sync-completion not called from `roadmap-client.ts` (frontend doesn't trigger completion sync)

### Frontend Code Locations:
- **Integration Page**: `doer/src/app/integrations/[provider]/page.tsx`
  - Line 88: `isTaskManagementIntegration` includes 'trello' ✅
  - Line 304: Calls `/api/integrations/${provider}/projects` ❌ (route missing)
  - Line 333: Calls `/api/integrations/${provider}/status` ✅
  - Line 596: Calls `/api/integrations/${provider}/disconnect` ❌ (route missing)
  - Line 1003: Calls `/api/integrations/${provider}/sync` ✅
  - Line 930: Calls `/api/integrations/${provider}/push` ✅
  - Line 1115: Calls `/api/integrations/${provider}/settings` ❌ (route missing)

- **Roadmap Client**: `doer/src/lib/roadmap-client.ts`
  - Line 502: Calls Todoist sync-completion ✅
  - Line 516: Calls Asana sync-completion ✅
  - **Missing**: Trello sync-completion call ❌

- **Task Auto-Rescheduler**: `doer/src/lib/task-auto-rescheduler.ts`
  - Line 1224: Calls Todoist reschedule sync ✅
  - Line 1239: Calls Asana reschedule sync ✅
  - **Missing**: Trello reschedule sync call ❌

---

## Conclusion

The Trello integration has **6 critical issues** that prevent core functionality from working:
1. Missing sync-completion API route
2. Missing disconnect API route
3. Missing projects API route (prevents UI from loading boards)
4. Missing settings API route (prevents UI from saving settings)
5. Missing reschedule sync call in task-auto-rescheduler
6. Missing completion sync call in roadmap-client

Additionally, there are **5 high/medium/low priority issues** related to code quality, type safety, and error handling.

**The integration is incomplete and will not function as expected without these fixes.** Users will experience:
- 404 errors when trying to load boards
- 404 errors when trying to save settings
- 404 errors when trying to disconnect
- Tasks not syncing completion status
- Reschedule proposals not updating Trello cards

All critical issues must be fixed before production deployment.

