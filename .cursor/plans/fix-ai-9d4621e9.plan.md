<!-- 9d4621e9-34c2-434a-af94-abea0c9842d6 d4f7e4ad-4d97-4223-9ff8-5dd5cc7659a3 -->
# Comprehensive AI Plan Generator & Scheduler Fix

## Overview

Complete audit and remediation of the AI plan generation system, addressing unused code, scheduling inefficiencies, AI prompt issues, and time calculation bugs identified in test results.

---

## Phase 1: Code Cleanup - Remove Unused Functions

### Issue

Two functions in `doer/src/lib/ai.ts` are defined but never used anywhere in the codebase:

- `validateGoalFeasibility` (lines 79-123)
- `analyzeClarificationNeeds` (lines 20-74)

### Actions

1. **Remove `validateGoalFeasibility` function** (lines 76-123)

      - Not imported or called anywhere
      - Goal feasibility is implicitly validated through timeline limits

2. **Remove `analyzeClarificationNeeds` function** (lines 17-74)

      - Not imported or called anywhere
      - Clarification analysis is handled directly in `/api/clarify` endpoint

3. **Update file documentation** if needed

**File**: `doer/src/lib/ai.ts`

---

## Phase 2: Fix AI Priority Assignment Logic

### Issue

AI is assigning priorities incorrectly for time-sensitive tasks:

- Tech setup tasks (should be done day-of or day-before) getting Priority 1
- Foundational tasks (like research) not consistently getting Priority 1

**Example from test**: "Set up interview space" and "Run tech check" were Priority 1 but should be Priority 2-3 (done closer to interview day).

### Solution

Enhance AI prompt to distinguish between:

- **Foundational dependencies** (Priority 1): Must be done first because others depend on them
- **Time-sensitive tasks** (Priority 2-3): Should be done at specific times relative to deadline
- **Preparation tasks** (Priority 2): Important but not blocking

### Actions

Update `generateRoadmapContent` prompt in `doer/src/lib/ai.ts` (lines 208-228):

**Current**:

```
PRIORITY ASSIGNMENT (1-4):
• Priority 1 (Critical): Foundation tasks that block other work...
```

**Enhanced**:

```
PRIORITY ASSIGNMENT (1-4):
• Priority 1 (Critical): ONLY for foundational dependencies - tasks that MUST be done before others can start
 - Example: "Research company" comes before "Prepare talking points" 
 - Example: "Learn basics" before "Practice advanced techniques"
 - NOT for time-sensitive tasks that should happen near deadline

• Priority 2 (High): Important preparatory work and core tasks
 - Time-sensitive tasks that should happen 1-2 days before deadline
 - Example: "Set up interview space" (do closer to interview, not first day)
 - Example: "Tech check" (do day before event, not days earlier)

• Priority 3 (Medium): Valuable enhancing tasks
 - Optional improvements, practice sessions, polish

• Priority 4 (Low): Nice-to-have additions
 - Documentation, extra polish, optional features

CRITICAL RULES:
1. If Task B needs output from Task A → Task A MUST be Priority 1, Task B is Priority 2+
2. If Task X should happen near deadline → Priority 2-3, NOT Priority 1
3. Setup/prep tasks for events → Schedule 1 day before, Priority 2-3
4. Practice/review tasks → Priority 3-4 (flexible timing)
```

**File**: `doer/src/lib/ai.ts` (lines 208-228)

---

## Phase 3: Optimize Scheduler Backfilling Algorithm

### Issue

Scheduler is not effectively utilizing earlier days' available capacity:

- Day 1: Only 95/252 minutes used (38% utilization)
- Day 2: 200/252 minutes used (79% utilization)

Current backfilling allows Priority 3+ tasks to deviate, but Priority 1-2 tasks stay locked to target days.

### Solution

Implement intelligent backfilling that respects priorities while maximizing capacity usage.

### Actions

1. **Modify target day calculation** in `doer/src/lib/time-block-scheduler.ts` (lines 243-261)

**Current logic**: Distributes tasks evenly based on priority ranges (P1: 0-30%, P2: 30-60%, etc.)

**Enhanced logic**:

```typescript
// Calculate target day but allow more flexibility for capacity balancing
const getTargetDayRange = (priority: number): { start: number; end: number; flexible: boolean } => {
  const total = Math.max(totalActiveDays, 1)
  switch (priority) {
    case 1:
      // P1: First 40% of timeline, very flexible for backfill
      return { 
        start: 0, 
        end: Math.max(1, Math.ceil(total * 0.40)),
        flexible: true // Can move within entire first half
      }
    case 2:
      // P2: First 70% of timeline, flexible for backfill
      return { 
        start: 0, 
        end: Math.max(1, Math.ceil(total * 0.70)),
        flexible: true // Can backfill to earlier days
      }
    case 3:
      // P3: Any day, very flexible
      return { 
        start: 0, 
        end: total,
        flexible: true
      }
    case 4:
      // P4: Any day, completely flexible
      return { 
        start: 0, 
        end: total,
        flexible: true
      }
  }
}
```

2. **Add capacity-aware day selection** (new logic after line 500)
```typescript
// Sort search days by available capacity (prioritize days with more space)
// This enables backfilling - fill earlier days if they have capacity
const searchDays = Array.from(searchDaysSet).sort((a, b) => {
  // First: Respect target day proximity for P1-P2
  if (task.priority <= 2) {
    const aDist = Math.abs(a - targetDay)
    const bDist = Math.abs(b - targetDay)
    if (Math.abs(aDist - bDist) > 1) {
      return aDist - bDist // Prefer closer days
    }
  }
  
  // Second: Prefer days with more available capacity (enables backfilling)
  const aConfig = dayConfigs[a]
  const bConfig = dayConfigs[b]
  const aUsed = dayScheduled.get(a) || 0
  const bUsed = dayScheduled.get(b) || 0
  const aAvailable = (aConfig?.dailyCapacity || 0) - aUsed
  const bAvailable = (bConfig?.dailyCapacity || 0) - bUsed
  
  return bAvailable - aAvailable // Prefer day with MORE available capacity
})
```


**File**: `doer/src/lib/time-block-scheduler.ts` (lines 243-500)

---

## Phase 4: Fix Lunch Break Handling in findBestTimeSlot

### Issue

Tasks scheduled at 11:40 are being moved to 13:00 without clear logging.

**From test logs**:

```
findBestTimeSlot -> 11:40
But actual placement: 13:00
```

This suggests lunch break (12:00-13:00) is being handled but not logged clearly.

### Solution

Add lunch break skip logic and comprehensive logging to `findBestTimeSlot`.

### Actions

Enhance `findBestTimeSlot` in `doer/src/lib/time-block-scheduler.ts` (lines 717-765):

```typescript
function findBestTimeSlot(
  dayIndex: number,
  alreadyScheduled: number,
  duration: number,
  dayConfig: DayScheduleConfig,
  currentTime?: Date,
  currentDate?: Date
): string | null {
  // ... existing effectiveStartMinutes logic ...

  const workdayStartMinutes = dayConfig.startHour * 60 + dayConfig.startMinute
  const candidateStartMinutes = Math.max(effectiveStartMinutes, workdayStartMinutes + alreadyScheduled)
  
  // NEW: Check if candidate overlaps with lunch
  const lunchStartMinutes = dayConfig.lunchStartHour * 60
  const lunchEndMinutes = dayConfig.lunchEndHour * 60
  const candidateEndMinutes = candidateStartMinutes + duration
  
  let finalStartMinutes = candidateStartMinutes
  
  // If task would overlap with lunch, skip to after lunch
  if (candidateStartMinutes < lunchEndMinutes && candidateEndMinutes > lunchStartMinutes) {
    console.log(`    ⏸️  Task would overlap lunch (${formatTime(dayConfig.lunchStartHour, 0)}-${formatTime(dayConfig.lunchEndHour, 0)}), moving to after lunch`)
    finalStartMinutes = lunchEndMinutes
  }
  
  const workdayEndMinutes = dayConfig.endHour * 60
  if (finalStartMinutes + duration > workdayEndMinutes) {
    console.log(`    ❌ Task (${duration}min) would exceed workday end (${formatTime(dayConfig.endHour, 0)})`)
    return null
  }

  const startHour = Math.floor(finalStartMinutes / 60)
  const startMinute = finalStartMinutes % 60
  const timeStr = formatTime(startHour, startMinute)
  
  if (finalStartMinutes !== candidateStartMinutes) {
    console.log(`    findBestTimeSlot: ${formatTime(Math.floor(candidateStartMinutes/60), candidateStartMinutes%60)} → ${timeStr} (adjusted for lunch)`)
  } else {
    console.log(`    findBestTimeSlot → ${timeStr} (effectiveStart: ${effectiveStartMinutes}min, alreadyScheduled: ${alreadyScheduled}min)`)
  }
  
  return timeStr
}
```

**File**: `doer/src/lib/time-block-scheduler.ts` (lines 717-765)

---

## Phase 5: Improve AI Prompt for Multi-Day Plans

### Issue

AI needs better guidance for distributing tasks across multi-day timelines to prevent front-loading.

### Actions

Add distribution guidance to `generateRoadmapContent` prompt in `doer/src/lib/ai.ts` (after line 206):

```
MULTI-DAY PLAN DISTRIBUTION:
• For 2+ day plans, distribute tasks to avoid front-loading
• Day 1: Foundational work (Priority 1-2 tasks that enable others)
• Middle days: Core execution (Priority 2-3 tasks)
• Final day: Completion tasks, final prep, time-sensitive items
• Example 2-day interview prep:
 - Day 1: Resume update, portfolio work, research (foundational)
 - Day 2: Practice interviews, tech setup, final review (execution + time-sensitive)
• Balance workload: Aim for 60-80% capacity each day, not 100% on one day
```

**File**: `doer/src/lib/ai.ts` (after line 206)

---

## Phase 6: Documentation & Validation

### Actions

1. **Create comprehensive documentation**: `doer/AI_SCHEDULER_ARCHITECTURE.md`

      - Document priority system and when to use each level
      - Explain backfilling algorithm
      - Provide examples of good vs bad priority assignments
      - Document lunch break handling
      - Explain capacity calculations

2. **Add validation logging** to plan generation route

      - Log AI priority distribution (how many P1, P2, P3, P4)
      - Log task distribution across days
      - Log capacity utilization per day

3. **Update test examples** in `doer/TEST_GOAL_EXAMPLES.md`

      - Add "expected priority assignments" for each test case
      - Add "expected day distribution" sections

---

## Testing Checklist

After implementation, test with:

1. **Original failing case**: 2-day interview prep

      - Verify backfilling moves tasks to Day 1
      - Verify tech setup tasks are Priority 2-3, not Priority 1
      - Verify Day 1 utilization >60%

2. **Single-day goal**: Presentation prep

      - Verify total duration <250 minutes
      - Verify all tasks scheduled on same day
      - Verify lunch breaks respected

3. **Multi-day complex goal**: 7-day learning plan

      - Verify tasks distributed across all days
      - Verify foundational tasks on early days
      - Verify practice/review tasks on later days

4. **Time-sensitive goal**: Event planning

      - Verify setup tasks scheduled closer to event
      - Verify preparation tasks scheduled early

---

## Files Modified

1. `doer/src/lib/ai.ts` - Remove unused functions, enhance priority prompt, add distribution guidance
2. `doer/src/lib/time-block-scheduler.ts` - Optimize backfilling, fix lunch break handling, improve logging
3. `doer/AI_SCHEDULER_ARCHITECTURE.md` - NEW: Comprehensive documentation
4. `doer/TEST_GOAL_EXAMPLES.md` - Add expected outcomes for test cases

---

## Success Criteria

- ✅ No unused functions in ai.ts
- ✅ AI assigns priorities based on dependencies, not timing
- ✅ Scheduler utilizes >60% of available capacity on each day
- ✅ Lunch breaks are clearly logged and handled
- ✅ Multi-day plans show balanced distribution
- ✅ All test cases from TEST_GOAL_EXAMPLES.md pass
- ✅ Comprehensive documentation exists

### To-dos

- [ ] Fix time-block scheduler to respect single-day plans and prevent date overflow
- [ ] Add pre-scheduling capacity validation to detect infeasible plans early
- [ ] Enforce priority-based scheduling order (Priority 1 before Priority 2)
- [ ] Extract plan generation logic to dedicated service layer for better separation of concerns
- [ ] Refactor API route to use transactional stored procedure instead of sequential inserts
- [ ] Add comprehensive validation before AI generation to catch issues early
- [ ] Implement cleanup function to remove orphaned data when plan generation fails
- [ ] Enhance error messages with specific codes and actionable guidance
- [ ] Create comprehensive integration tests for plan generation edge cases
- [ ] Re-test with original user inputs from AI Test Results to verify fixes
- [ ] Execute database migrations using 'supabase db push --yes' from supabase folder
- [ ] Remove unused validateGoalFeasibility and analyzeClarificationNeeds functions from ai.ts
- [ ] Enhance AI priority assignment prompt to distinguish foundational vs time-sensitive tasks
- [ ] Modify scheduler target day calculation and add capacity-aware day selection for better backfilling
- [ ] Add lunch break skip logic and comprehensive logging to findBestTimeSlot function
- [ ] Add multi-day plan distribution guidance to AI prompt
- [ ] Create AI_SCHEDULER_ARCHITECTURE.md with comprehensive system documentation
- [ ] Add priority distribution and capacity utilization logging to plan generation route
- [ ] Test with 2-day interview prep, single-day presentation, 7-day learning plan, and event planning goals