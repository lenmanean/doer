# AI Code Audit Report
**Date:** 2025-11-16  
**Scope:** OpenAI/AI-related code, plan generation, task generation, rescheduling

## Executive Summary
This audit identified several issues: legacy code references, duplicate authentication logic, unused functions, and unnecessary fallback code. Most issues are minor but should be cleaned up for maintainability.

---

## Issues Found

### 🔴 CRITICAL ISSUES

#### 1. **Legacy Category References in `adjust-timeline/route.ts`**
**Location:** `src/app/api/plans/adjust-timeline/route.ts:176, 224`
**Issue:** The `redistributeTasksAcrossTimeline` function references `task.category` which was removed from the system. Categories (A, B, C) were part of the legacy milestone system.
**Impact:** The function will fail or return incorrect data when processing tasks.
**Fix Required:** Remove category references and update the prompt/fallback logic.

```typescript
// Line 176 - References non-existent category
${tasks.map((task, i) => `${i + 1}. ${task.name} (${task.estimated_duration_minutes} min, Category ${task.category})`).join('\n')}

// Line 224 - Fallback uses category
category: task.category,
```

#### 2. **Legacy Milestone Reference in `smart-scheduler.ts`**
**Location:** `src/lib/smart-scheduler.ts:207`
**Issue:** Query selects `milestone_id` field, but milestones were removed from the system (see comments on lines 143, 153).
**Impact:** Unnecessary database field being queried, potential confusion.
**Fix Required:** Remove `milestone_id` from the select statement.

```typescript
// Line 207
.select('id, name, estimated_duration_minutes, complexity_score, milestone_id, priority, idx')
// Should be:
.select('id, name, estimated_duration_minutes, complexity_score, priority, idx')
```

---

### 🟡 MODERATE ISSUES

#### 3. **Duplicate Authentication Logic in `adjust-timeline/route.ts`**
**Location:** `src/app/api/plans/adjust-timeline/route.ts:51-65`
**Issue:** Authentication is checked twice - once in the try/catch block (lines 17-49) and again after (lines 51-65). The second check is redundant.
**Impact:** Unnecessary code execution, potential confusion.
**Fix Required:** Remove the duplicate authentication check (lines 51-65) since `authContext` is already established.

#### 4. **Unused Function: `shiftMilestoneDates`**
**Location:** `src/lib/smart-scheduler.ts:278+`
**Issue:** Function exists but milestones are removed. Function is likely never called.
**Fix Required:** Verify it's unused and remove if confirmed.

#### 5. **Empty Lines at End of File**
**Location:** `src/app/api/plans/adjust-timeline/route.ts:233-259`
**Issue:** 27 empty lines at end of file.
**Fix Required:** Remove trailing empty lines.

---

### 🟢 MINOR ISSUES / CODE QUALITY

#### 6. **Missing Import Statement**
**Location:** `src/app/api/plans/generate/route.ts:5`
**Issue:** Line 5 has an incomplete import statement: `'@/lib/date-utils'`
**Fix Required:** Complete or remove the import.

#### 7. **Potential Unused Variable**
**Location:** `src/app/api/plans/generate/route.ts:17`
**Issue:** `sessionUser` variable may not be necessary if user is always available from authContext.
**Fix Required:** Review if this variable is actually needed.

---

## Code Usage Analysis

### ✅ ACTIVE AI FUNCTIONS (All Used)

1. **`evaluateGoalFeasibility`** - Used in `/api/clarify`
2. **`analyzeClarificationNeeds`** - Used in `/api/clarify`
3. **`generateRoadmapContent`** - Used in `/api/plans/generate`
4. **`redistributeTasksAcrossTimeline`** - Used in `/api/plans/adjust-timeline` (but has issues)
5. **AI task generation** - Used in `/api/tasks/ai-generate`
6. **Todo list analysis** - Used in `/api/tasks/todo-list-analyze`

### ✅ ACTIVE SCHEDULING FUNCTIONS

1. **`generateTaskSchedule`** - Used in `/api/plans/generate` via `roadmap-server.ts`
2. **`timeBlockScheduler`** - Used in `roadmap-server.ts` and `smart-scheduler.ts`
3. **`analyzeAndReschedule`** - Used for automatic rescheduling
4. **`redistributeTasks`** - Used in `smart-scheduler.ts` (internal function)

---

## Recommendations

### Priority 1 (Fix Immediately)
1. Remove category references from `redistributeTasksAcrossTimeline`
2. Remove `milestone_id` from smart-scheduler query
3. Fix duplicate authentication in `adjust-timeline/route.ts`

### Priority 2 (Clean Up)
4. Remove unused `shiftMilestoneDates` function (if confirmed unused)
5. Clean up empty lines in `adjust-timeline/route.ts`
6. Fix incomplete import in `plans/generate/route.ts`

### Priority 3 (Code Quality)
7. Review `sessionUser` variable usage
8. Consider extracting common authentication pattern to shared utility

---

## Files Requiring Changes

1. `src/app/api/plans/adjust-timeline/route.ts` - Multiple issues
2. `src/lib/smart-scheduler.ts` - Remove milestone_id reference
3. `src/app/api/plans/generate/route.ts` - Fix import statement

---

## Summary

**Total Issues Found:** 7
- Critical: 2
- Moderate: 3
- Minor: 2

**Overall Assessment:** The codebase is generally clean, but has some legacy references that need removal. The AI functions are all actively used and properly structured. Main cleanup needed is removing references to deprecated milestone/category system.

