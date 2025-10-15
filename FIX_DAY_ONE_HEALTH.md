# Fix: Day 1 Health Score Issue

## Problem
Brand new plans show **88% health** on Day 1 instead of 100% because penalties are applied immediately:
- Consistency gap penalty: -2 (today counted as a "missed" day)
- Progress lag penalty: -10 (0% completion rate on Day 1)

## Root Cause
The `v_plan_health` view was counting the current day when calculating penalties, which doesn't make sense for:
1. **Consistency gaps**: You can't have a "gap" on the current day
2. **Progress lag**: You can't be "behind" on the current day

## Solution
Updated the health calculation to only count **fully elapsed days** (excluding today) for penalty calculations.

## How to Apply the Fix

### Step 1: Run the Migration in SQL Editor

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `supabase/migrations/20251012120000_fix_day_one_penalties.sql`
5. Click **Run**

### Step 2: Verify the Fix

Run this query to check your health score:

```sql
SELECT * FROM public.get_plan_health_now(
  'YOUR_USER_ID'::uuid,
  'YOUR_PLAN_ID'::uuid
);
```

You should now see:
- **health_score**: 100 (on Day 1)
- **consistency_gap_penalty**: 0 (on Day 1)
- **progress_lag_penalty**: 0 (on Day 1)

## What Changed

### Before (Broken):
- **Consistency gaps**: Counted `ts.date <= CURRENT_DATE` (includes today)
- **Progress lag**: Counted `ts.date <= CURRENT_DATE` (includes today)
- **Result**: Day 1 penalties applied immediately

### After (Fixed):
- **Consistency gaps**: Counts only `ts.date < CURRENT_DATE` (excludes today)
- **Progress lag**: Counts only `ts.date < CURRENT_DATE` (excludes today)
- **Result**: Day 1 starts at 100% health

## Key Changes in the Migration

1. **Past Scheduled Days** (line 35):
   ```sql
   -- Changed from: ts.date <= CURRENT_DATE
   -- To: ts.date < CURRENT_DATE
   ```

2. **Overdue Penalty** (line 53):
   ```sql
   -- Changed from: ts.date < CURRENT_DATE (was already correct)
   -- Kept: ts.date < CURRENT_DATE
   ```

3. **Consistency Gap Penalty** (lines 62-67):
   ```sql
   -- Changed from: ts.date <= CURRENT_DATE and tc.scheduled_date <= CURRENT_DATE
   -- To: ts.date < CURRENT_DATE and tc.scheduled_date < CURRENT_DATE
   ```

4. **Progress Lag Penalty** (lines 70-77):
   ```sql
   -- Changed from: ts.date <= CURRENT_DATE
   -- To: ts.date < CURRENT_DATE
   ```

5. **Days with Completions** (lines 123-127):
   ```sql
   -- Changed from: tc.scheduled_date <= CURRENT_DATE
   -- To: tc.scheduled_date < CURRENT_DATE
   ```

## Expected Behavior After Fix

### Day 1 (First Day):
- ✅ Health score: **100%**
- ✅ No consistency gap penalty
- ✅ No progress lag penalty
- ✅ No overdue penalty

### Day 2 (If no tasks completed on Day 1):
- ⚠️ Health score: **88%**
- Consistency gap: -2 (Day 1 had tasks but no completions)
- Progress lag: -10 (completion rate < 70%)

### Day 2 (If tasks completed on Day 1):
- ✅ Health score: **100+%** (with bonuses)
- No penalties
- Bonuses for on-time/early completions

## Testing

You can test the fix with this query:

```sql
-- View your current health breakdown
SELECT 
  health_score,
  days_elapsed,
  consistency_gap_penalty,
  progress_lag_penalty,
  has_scheduled_tasks
FROM public.v_plan_health
WHERE user_id = 'YOUR_USER_ID'::uuid
  AND plan_id = 'YOUR_PLAN_ID'::uuid;
```

Expected output on Day 1:
```json
{
  "health_score": 100,
  "days_elapsed": 0,
  "consistency_gap_penalty": 0,
  "progress_lag_penalty": 0,
  "has_scheduled_tasks": true
}
```

## Related Files
- Migration: `supabase/migrations/20251012120000_fix_day_one_penalties.sql`
- Original health model: `supabase/migrations/20251011190000_vitality_degrading_health_model.sql`

---

**Status**: ✅ Ready to deploy via SQL Editor


