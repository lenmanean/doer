# Manual Plans Implementation

**Date:** October 12, 2025  
**Status:** ✅ Complete

## Overview

Manual plans have been fully implemented, allowing users to create and manage their own roadmaps with complete control over milestones and tasks. This feature complements the existing AI-generated plans and gives users the flexibility to choose their planning approach.

## Implementation Details

### 1. Database Changes

#### Migration: `20251012190000_add_plan_type_field.sql`

Added a `plan_type` field to the `plans` table to distinguish between AI-generated and manually created plans:

```sql
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'ai'
CHECK (plan_type IN ('ai', 'manual'));
```

- **Default Value:** `'ai'` for backward compatibility
- **Constraint:** Only allows `'ai'` or `'manual'` values
- **Existing Data:** All existing plans were updated to have `plan_type = 'ai'`

### 2. Type System Updates

Updated `doer/src/lib/types.ts` to include the new fields:

```typescript
export interface Plan {
  // ... existing fields
  plan_type: 'ai' | 'manual' // NEW
  archived_at?: string        // NEW (from multiple plans support)
}
```

### 3. API Endpoints

#### A. Create Manual Plan: `/api/plans/manual/route.ts`

Creates a new manual plan with basic information:

**Request:**
```json
{
  "goal_text": "Learn Web Development",
  "goal_description": "Master frontend and backend technologies",
  "start_date": "2025-10-15",
  "end_date": "2025-12-31"
}
```

**Features:**
- Validates date ranges (end date must be after start date)
- Automatically pauses any existing active plan
- Sets plan status to `'active'` and plan_type to `'manual'`
- Calculates timeline duration in days
- Returns plan ID for milestone/task creation

#### B. Add Milestones: `/api/plans/manual/milestones/route.ts`

Adds milestones to a manual plan:

**Request:**
```json
{
  "plan_id": "uuid",
  "milestones": [
    {
      "name": "Complete HTML & CSS",
      "rationale": "Foundation of web development",
      "target_date": "2025-11-01"
    }
  ]
}
```

**Features:**
- Validates plan ownership
- Only allows adding to manual plans
- Automatically assigns milestone indices
- Returns created milestone IDs for task association

#### C. Add Tasks: `/api/plans/manual/tasks/route.ts`

Adds tasks to a manual plan:

**Request:**
```json
{
  "plan_id": "uuid",
  "tasks": [
    {
      "name": "Learn HTML basics",
      "category": "milestone_task",
      "milestone_id": "milestone-uuid"
    },
    {
      "name": "Daily coding practice",
      "category": "daily_task"
    }
  ]
}
```

**Features:**
- Validates plan ownership
- Supports both milestone tasks and daily tasks
- Automatically generates task schedules using existing scheduler
- Returns created task IDs

### 4. User Interface

#### A. Manual Plan Creation Flow

**Entry Points:**
1. From dashboard → "Manage Plans" → "Create New Plan" → Select "Manual Plan"
2. Direct navigation to `/onboarding/manual`

**Page:** `doer/src/app/onboarding/manual/page.tsx`

**Features:**
- Clean, modern UI matching app design system [[memory:8724600]]
- Form fields for:
  - Goal title (required)
  - Goal description (optional)
  - Start date (required, date picker)
  - End date (required, date picker with validation)
- Real-time error display
- Loading states during submission
- Automatic navigation to milestone builder on success

#### B. Milestone & Task Builder

**Page:** `doer/src/app/onboarding/manual/milestones/page.tsx`

**Features:**
- **Milestones Section:**
  - Add/remove multiple milestones
  - Fields for name, description, and target date
  - Target date validation (must be within plan date range)
  - Minimum 1 milestone required
  
- **Tasks Section:**
  - Add/remove multiple tasks
  - Select task category (daily task or milestone task)
  - Associate milestone tasks with specific milestones
  - Minimum 1 task required
  
- **UI/UX:**
  - Gradient icons for visual hierarchy
  - Smooth animations and transitions [[memory:8821127]]
  - Real-time validation
  - Loading states
  - Error handling with user-friendly messages
  - Completes setup and navigates to dashboard

### 5. Plan Type Selection Modal

**Component:** `doer/src/components/ui/PlanTypeSelectionModal.tsx`

**Features:**
- Beautiful gradient cards for each plan type
- Hover animations and transitions
- Feature comparison:
  - **AI Plan:** Smart generation, personalized tasks, adaptive timeline
  - **Manual Plan:** Complete control, custom milestones, flexible setup
- Integrated into `SwitchPlanModal` for seamless plan creation

### 6. Integration Points

#### Updated Files:
1. **AI Plan Generation** (`doer/src/app/api/plans/generate/route.ts`)
   - Now sets `plan_type: 'ai'` for all AI-generated plans
   
2. **Switch Plan Modal** (`doer/src/components/ui/SwitchPlanModal.tsx`)
   - Shows `PlanTypeSelectionModal` when creating new plans
   - Routes to appropriate flow based on selection
   
3. **Dashboard** (`doer/src/app/dashboard/page.tsx`)
   - Supports both AI and manual plans equally
   - "Manage Plans" button opens `SwitchPlanModal`

## User Flow

### Creating a Manual Plan

```
Dashboard
  ↓
Click "Manage Plans"
  ↓
SwitchPlanModal opens
  ↓
Click "Create New Plan"
  ↓
PlanTypeSelectionModal appears
  ↓
Select "Manual Plan"
  ↓
Manual Plan Creation Page (/onboarding/manual)
  ├─ Enter goal title
  ├─ Enter goal description (optional)
  ├─ Select start date
  └─ Select end date
  ↓
Click "Continue to Milestones"
  ↓
Milestone Builder Page (/onboarding/manual/milestones)
  ├─ Add milestones
  │   ├─ Name
  │   ├─ Description
  │   └─ Target date
  └─ Add tasks
      ├─ Name
      ├─ Category (daily/milestone)
      └─ Associated milestone (if milestone task)
  ↓
Click "Complete Setup"
  ↓
Plan Created & Navigate to Dashboard
```

## Technical Considerations

### 1. Data Consistency
- Manual plans use the same database schema as AI plans
- Task scheduling uses the existing `generateTaskSchedule` function
- Milestone and task completion tracking works identically

### 2. Validation
- Client-side validation for immediate feedback
- Server-side validation for security
- Date validation ensures logical date ranges
- Plan ownership verification on all mutations

### 3. User Experience
- No "Coming Soon" notices - feature is production-ready [[memory:8861052]]
- Smooth transitions between pages
- Clear error messages
- Loading states for all async operations
- Maintains design consistency with rest of app

### 4. Future-Proof Design
- Supports variable durations (any number of days) [[memory:8861044]]
- Flexible milestone structure
- Extensible task system
- Plan type field allows for future plan types

## Testing Checklist

- [x] Database migration runs successfully
- [x] Type system updated correctly
- [x] API endpoints validate inputs
- [x] API endpoints enforce security (user ownership)
- [x] Plan type selection modal displays correctly
- [x] Manual plan creation form validates inputs
- [x] Milestone builder allows add/remove operations
- [x] Task builder allows add/remove operations
- [x] Task-to-milestone association works
- [x] Plan creation completes successfully
- [x] Navigation flow works end-to-end
- [x] Dashboard displays manual plans correctly
- [x] No linter errors

## Migration Instructions

### 1. Run Database Migration

```bash
# Navigate to project directory
cd doer

# Run the migration
supabase migration up
```

This will:
- Add the `plan_type` field to `plans` table
- Set all existing plans to `plan_type = 'ai'`
- Add check constraint for valid plan types

### 2. Verify Migration

```sql
-- Check that plan_type column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'plans' AND column_name = 'plan_type';

-- Verify all existing plans have plan_type = 'ai'
SELECT COUNT(*), plan_type 
FROM plans 
GROUP BY plan_type;
```

### 3. Test Manual Plan Creation

1. Log into the application
2. Navigate to Dashboard
3. Click "Manage Plans" → "Create New Plan"
4. Select "Manual Plan"
5. Fill in goal details
6. Add milestones and tasks
7. Complete setup
8. Verify plan appears in dashboard

## Summary

Manual plans are now fully functional and production-ready. Users can:
- ✅ Choose between AI and manual plan creation
- ✅ Create custom roadmaps with full control
- ✅ Add multiple milestones with target dates
- ✅ Create daily tasks and milestone-specific tasks
- ✅ Manage multiple plans (AI and manual) simultaneously
- ✅ Switch between plans seamlessly

The implementation maintains consistency with existing features while providing a flexible, user-friendly interface for manual plan creation. All code follows the existing patterns and design system, ensuring maintainability and extensibility.

