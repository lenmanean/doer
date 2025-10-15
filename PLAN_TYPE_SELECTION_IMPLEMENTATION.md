# Plan Type Selection Modal Implementation

## Overview
Added a new modal that allows users to choose between creating an **AI Plan** or a **Manual Plan** when clicking "+ Create New Goal" in the goal selection panel.

## Changes Made

### 1. New Component: `PlanTypeSelectionModal.tsx`
**Location:** `doer/src/components/ui/PlanTypeSelectionModal.tsx`

A beautiful, animated modal featuring:
- **Two distinct plan options** presented as interactive cards
- **AI Plan Card** (orange/purple/pink gradient):
  - Sparkles icon
  - Describes AI-generated personalized roadmaps
  - Features: Smart milestone generation, personalized task breakdown, adaptive timeline planning
  
- **Manual Plan Card** (blue/cyan/teal gradient):
  - Calendar icon
  - Describes user-controlled manual creation
  - Features: Complete creative control, custom milestone creation, flexible timeline setup

**Design Features:**
- Smooth hover animations with scale and lift effects
- Gradient overlays that intensify on hover
- Arrow icons that slide in on hover
- Consistent with existing UI theme
- High z-index (z-[110-111]) to appear above the SwitchPlanModal

### 2. Updated Component: `SwitchPlanModal.tsx`
**Location:** `doer/src/components/ui/SwitchPlanModal.tsx`

**Changes:**
- Added import for `PlanTypeSelectionModal`
- Added state: `showPlanTypeModal` to control the new modal
- Added handler: `handleSelectAIPlan()` - navigates to `/onboarding`
- Added handler: `handleSelectManualPlan()` - navigates to `/onboarding/manual`
- Updated "+ Create New Goal" button to open the plan type selection modal
- Rendered the `PlanTypeSelectionModal` at the bottom of the component

### 3. New Page: Manual Onboarding
**Location:** `doer/src/app/onboarding/manual/page.tsx`

A placeholder page for manual plan creation featuring:
- Back navigation button
- Goal title input field
- Goal description textarea (optional)
- Start date and end date pickers
- Info box explaining next steps
- Coming soon notice (since manual plan creation is not yet fully implemented)
- Consistent styling with the rest of the application

### 4. Updated Exports
**Location:** `doer/src/components/ui/index.ts`

- Exported `PlanTypeSelectionModal` for easy importing across the app

## User Flow

1. User clicks on their profile/plan switcher in the dashboard
2. The `SwitchPlanModal` opens showing current goals
3. User clicks "+ Create New Goal" button
4. The `PlanTypeSelectionModal` appears on top
5. User selects either:
   - **AI Plan** → Redirected to `/onboarding` (existing AI-powered onboarding flow)
   - **Manual Plan** → Redirected to `/onboarding/manual` (new manual plan creation page)

## Future Work

The manual plan creation flow is currently a placeholder. Future implementation should include:
- Full milestone creation UI
- Task addition and management
- Drag-and-drop timeline customization
- Integration with the existing plan database schema
- Validation and error handling
- Progress saving and draft functionality

## Visual Design

The modal follows the application's design system:
- Dark theme with `#0a0a0a` background
- Glass morphism effect with backdrop blur
- Smooth spring animations from Framer Motion
- Consistent typography using `#d7d2cb` text color
- Gradient accents matching the brand colors
- Hover states with smooth transitions (matching user preference for fluid animations)

## Technical Details

- Built with React and TypeScript
- Uses Framer Motion for animations
- Responsive design (mobile-friendly with grid layout)
- Proper z-index layering for multiple modals
- No external dependencies beyond existing project packages

## Testing

To test the implementation:
1. Run the development server: `npm run dev`
2. Navigate to the dashboard
3. Click on the plan switcher/profile area
4. Click "+ Create New Goal"
5. Verify the plan type selection modal appears
6. Test both AI and Manual plan options
7. Verify navigation works correctly

## Status

✅ Plan Type Selection Modal - **Complete**
✅ Integration with SwitchPlanModal - **Complete**
✅ AI Plan Navigation - **Complete** (uses existing onboarding)
⚠️ Manual Plan Creation - **Placeholder** (UI created, full implementation pending)





