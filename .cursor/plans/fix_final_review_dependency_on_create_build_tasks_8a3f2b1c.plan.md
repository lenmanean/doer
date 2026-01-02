# Fix Final Review Dependency on Create/Build Tasks

## Issues Identified from Logs

### 1. **Critical: Final Review Scheduled Before Create Task**
- **Problem**: "Final review of slides and notes" (Task 6) scheduled at 11:00 AM, but "Create presentation slides" (Task 3) scheduled at 1:00 PM
- **Root Cause**: Dependency detection pattern missing - "final review" tasks should depend on "create" / "build" tasks when they reference the same artifact
- **Impact**: 
  - Logical violation: Can't review slides before they're created
  - Poor user experience: Tasks appear in wrong order
  - Dependency chain broken: Review should come after creation

### 2. **Missing Dependency Pattern**
- **Current**: Pattern exists for "test" -> "final review" (lines 1025-1042)
- **Missing**: Pattern for "create" / "build" -> "final review" when they reference the same thing
- **Example**: "Final review of slides" should depend on "Create slides"
- **Example**: "Final review of code" should depend on "Build application"

## Implementation Plan

### Phase 1: Add Dependency Pattern for Create/Build -> Final Review

**File**: `doer/src/lib/goal-analysis.ts` (after line 998, before line 1000)

1. **Add Pattern: Create/Build -> Final Review** (after line 998)
   - Pattern: "create" / "build" tasks should come before "final review" tasks when they reference the same artifact
   - Logic:
     - If task includes "create" or "build" and otherTask includes "final review"
     - Check if they reference the same artifact (e.g., both mention "slides", "code", "presentation", etc.)
     - Make final review depend on create/build
   - This ensures "Final review of slides" depends on "Create slides"

2. **Context Matching for Artifacts**
   - Extract artifact keywords from task names (slides, notes, code, presentation, etc.)
   - Only create dependency if both tasks reference the same artifact
   - This prevents false positives (e.g., "Final review of code" shouldn't depend on "Create slides")

## Testing Strategy

1. **Test Create -> Final Review Dependency**
   - Create scenario: "Create presentation slides" and "Final review of slides and notes"
   - Verify that final review depends on create slides
   - Verify that final review is scheduled after create slides

2. **Test Context Matching**
   - Verify that "Final review of slides" depends on "Create slides" (same artifact)
   - Verify that "Final review of code" doesn't depend on "Create slides" (different artifacts)

## Success Criteria

- ✅ Final review tasks depend on create/build tasks when they reference the same artifact
- ✅ Final review is scheduled after create/build tasks
- ✅ No false positives (different artifacts don't create dependencies)
- ✅ Logical ordering maintained: Create -> Review
