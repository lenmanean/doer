<!-- 61d37526-0070-4e76-a194-0dfa73dc2041 6e69f063-d4fc-414b-86ea-3b84c4328d93 -->
# Fix Analytics Panels Tooltips and Descriptions

## Overview

The AnalyticsTabs component already exists with tabs and descriptions. Need to fix BarChart tooltip positioning and ensure description styling consistency.

## Changes Required

### 1. Fix BarChart Tooltip Positioning

**File**: `doer/src/components/ui/BarChart.tsx`

- Change tooltip positioning from `bottom` to `top` 
- Calculate position based on bar's top Y coordinate
- Position tooltip centered above the hovered bar (vertically centered above the bar)
- Calculate: `top = barTopY - (tooltipHeight / 2) - (barHeight / 2)` to center tooltip above bar
- Update both regular and stacked bar tooltip positioning
- Use `transform: translateX(-50%)` for horizontal centering

### 2. Ensure Description Consistency

**Files**:

- `doer/src/components/ui/AnalyticsTabs.tsx` - Update description styling to match page header
- `doer/src/components/ui/PlansPanel.tsx` - Update description styling to match page header
- `doer/src/components/ui/UserDataSummary.tsx` - Update description styling to match page header

- Change all descriptions to match page header style exactly: `text-[#d7d2cb]/70` (same as page header subtext)
- Keep appropriate spacing: `mt-2` for CardHeader contexts
- Ensure font size matches page header subtext (currently `text-sm` in page header, verify consistency)

### 3. Verify AnalyticsTabs Animations

**File**: `doer/src/components/ui/AnalyticsTabs.tsx`

- Verify smooth transition animations are working (already using AnimatePresence with motion.div)
- Ensure tab switching has proper fade and slide animations
- Check that the active tab indicator animation is smooth

## Implementation Details

### BarChart Tooltip Fix

- Calculate bar top position: `padding + barHeight - height` (for single bars) or `currentY` (for stacked bars)
- Position tooltip: `top: barTopY - tooltipHeight - 8px`
- Use `transform: translateX(-50%)` for horizontal centering
- Ensure tooltip appears above the bar, not way above the chart

### Description Styling

- All panel descriptions should use: `text-sm text-[#d7d2cb]/70`
- Spacing: `mt-2` for CardHeader contexts, `mt-1` for inline with titles
- Match the descriptive, helpful tone of the page header subtext

### To-dos

- [ ] Rename /health route to /data: move page.tsx file and update all route references
- [ ] Update Sidebar component to change 'Health' navigation item to 'Data' with BarChart3 icon
- [ ] Update middleware.ts to replace /health with /data in PROTECTED_PREFIXES
- [ ] Create ActivityHeatmap component with GitHub-style calendar grid, color intensity, hover tooltips, and click drill-down
- [ ] Create MetricCard component with value display, sparkline chart, hover enlargement, and color-coded status
- [ ] Create ProgressRing component with circular progress, animated fill, and hover breakdown display
- [ ] Create TrendChart component with line chart, interactive tooltips, and time range filters
- [ ] Create BarChart component with bar visualization, stacked bars support, hover tooltips, and click filtering
- [ ] Create PlansPanel component with collapsed/expanded states, plan list display, and navigation to plan details
- [ ] Create UserDataSummary component displaying total tasks, completions, completion rate, plans count, and streaks
- [ ] Build main data page layout integrating all components in the specified grid structure with proper spacing
- [ ] Add hover effects, click handlers, expand/collapse animations, and smooth transitions to all interactive elements
- [ ] Test and adjust responsive design for mobile, tablet, and desktop viewports