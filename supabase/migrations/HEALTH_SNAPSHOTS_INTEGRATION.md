# Health Snapshots System Integration Guide

Complete implementation of automated health snapshot capture and analytics.

## 📋 Overview

This system provides:
- ✅ Automated daily health snapshot capture via Supabase Edge Function
- ✅ Historical health data persistence in `health_snapshots` table
- ✅ Client-side analytics functions for health trends and insights
- ✅ Integration with existing `get_plan_health_now()` function

## 🗂️ Components Created

### 1. Database Migration
**File**: `supabase/migrations/20251012000000_create_health_snapshots.sql`

Creates:
- `health_snapshots` table with unique constraint on `(plan_id, snapshot_date)`
- `capture_health_snapshot(p_user_id, p_plan_id)` RPC function
- Row Level Security policies
- Indexes for efficient querying

### 2. Supabase Edge Function
**File**: `supabase/functions/capture_health_snapshots/index.ts`

Automated function that:
- Queries all active plans
- Calls `capture_health_snapshot()` for each plan
- Logs results to console
- Returns JSON with capture count
- Designed for daily cron execution at 00:00 UTC

### 3. Client Analytics Library
**File**: `doer/src/lib/analytics.ts` (updated)

Added three new functions:
- `fetchHealthHistory(userId, planId, days)`
- `fetchWeeklyHealthAnalytics(userId, planId, weeks)`
- `fetchHealthInsights(userId, planId)`

All existing functions preserved (including `fetchHealthMetrics()`).

## 🚀 Deployment Steps

### Step 1: Run Migration

**In Supabase Dashboard → SQL Editor:**

Copy and paste the entire contents of `supabase/migrations/20251012000000_create_health_snapshots.sql` into the SQL editor and run it.

This will:
- Create the `health_snapshots` table
- Create the `capture_health_snapshot()` RPC function
- Set up Row Level Security
- Create indexes

### Step 2: Deploy Edge Function

**Option A: Using Supabase Dashboard**
1. Go to Edge Functions in your Supabase Dashboard
2. Create a new function named `capture_health_snapshots`
3. Copy the contents of `supabase/functions/capture_health_snapshots/index.ts`
4. Paste into the function editor and deploy

**Option B: Manual Deployment (if needed)**
The edge function code is ready in `supabase/functions/capture_health_snapshots/index.ts` for when you set it up.

### Step 3: Configure Cron Job

**In Supabase Dashboard → SQL Editor:**

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily health snapshot capture at 00:00 UTC
SELECT cron.schedule(
  'daily-health-snapshots',
  '0 0 * * *',
  $$
    SELECT
      net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/capture_health_snapshots',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
  $$
);
```

## 📊 Usage Examples

### Example 1: Fetch Last 7 Days of Health Data

```typescript
import { fetchHealthHistory } from '@/lib/analytics'

// In your React component or API route
const userId = 'user-uuid-here'
const planId = 'plan-uuid-here'

const history = await fetchHealthHistory(userId, planId, 7)

// Returns array of snapshots:
// [
//   {
//     snapshot_date: '2025-10-05',
//     health_score: 95,
//     progress: 75,
//     consistency: 80,
//     efficiency: 90,
//     ...
//   },
//   ...
// ]
```

### Example 2: Get Weekly Analytics for Charts

```typescript
import { fetchWeeklyHealthAnalytics } from '@/lib/analytics'

const weeklyData = await fetchWeeklyHealthAnalytics(userId, planId, 4)

// Returns array of weekly aggregates:
// [
//   {
//     week_start: '2025-10-08',  // Sunday
//     avg_health_score: 92.5,
//     avg_progress: 78.3,
//     avg_consistency: 85.0,
//     total_late_penalty: -15,
//     total_ontime_bonus: 8,
//     days_in_week: 7
//   },
//   ...
// ]
```

### Example 3: Display Health Insights

```typescript
import { fetchHealthInsights } from '@/lib/analytics'

const insights = await fetchHealthInsights(userId, planId)

// Returns trend analysis:
// {
//   trend: 'improving',  // or 'declining' or 'neutral'
//   message: 'Your health has improved by 12.5% over the last week',
//   change: 12.5
// }

// Display in UI
if (insights.trend === 'improving') {
  return <div className="text-green-600">{insights.message}</div>
}
```

### Example 4: Combine with Real-Time Metrics

```typescript
import { fetchHealthMetrics, fetchHealthHistory } from '@/lib/analytics'

// Get current health
const currentHealth = await fetchHealthMetrics(userId, planId)

// Get historical context
const history = await fetchHealthHistory(userId, planId, 30)

// Display dashboard with current + historical
return (
  <div>
    <h2>Current Health: {currentHealth.healthScore}%</h2>
    <HealthChart data={history} />
  </div>
)
```

## 🔄 Integration with Existing System

### Preserves Current Functionality

✅ `fetchHealthMetrics()` continues to work as before  
✅ Uses existing `get_vitality_now()` / `get_plan_health_now()` functions  
✅ No breaking changes to existing code  
✅ All deprecated functions remain for backward compatibility  

### New Capabilities

✨ Historical health tracking  
✨ Weekly aggregation and trend analysis  
✨ Comparative insights (improving/declining)  
✨ Penalty and bonus breakdown over time  

## 🧪 Testing

### Step 1: Test RPC Function

**In Supabase Dashboard → SQL Editor:**

First, find an active plan to test with:
```sql
-- Find an active plan
SELECT id, user_id FROM plans WHERE status = 'active' LIMIT 1;
```

Then test the snapshot capture:
```sql
-- Replace with actual UUIDs from above query
SELECT capture_health_snapshot(
  'user-uuid-here'::uuid,
  'plan-uuid-here'::uuid
);
```

### Step 2: Verify Snapshot Was Created

**In Supabase Dashboard → SQL Editor:**

```sql
-- View captured snapshots
SELECT 
  snapshot_date,
  health_score,
  progress,
  consistency,
  efficiency,
  created_at
FROM health_snapshots
WHERE plan_id = 'plan-uuid-here'
ORDER BY snapshot_date DESC
LIMIT 10;
```

### Step 3: Test Edge Function (Optional)

If you've deployed the edge function, test it manually:

**In Supabase Dashboard → Edge Functions:**
- Find `capture_health_snapshots` function
- Click "Invoke" or use the test feature

**Or via API request:**
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/capture_health_snapshots' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

### Step 4: Check Cron Job Status

**In Supabase Dashboard → SQL Editor:**

```sql
-- List all cron jobs
SELECT * FROM cron.job WHERE jobname = 'daily-health-snapshots';

-- View recent runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-health-snapshots')
ORDER BY start_time DESC 
LIMIT 5;
```

## 📈 Database Schema

### health_snapshots Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References auth.users |
| `plan_id` | uuid | References plans |
| `snapshot_date` | date | Date of snapshot |
| `health_score` | numeric | Overall health (0-100) |
| `has_scheduled_tasks` | boolean | Gray state indicator |
| `progress` | numeric | Progress percentage |
| `consistency` | numeric | Consistency percentage |
| `efficiency` | numeric | Efficiency percentage (nullable) |
| `total_tasks` | integer | Total task count |
| `total_completions` | integer | Completion count |
| `days_elapsed` | integer | Days since plan start |
| `current_streak_days` | integer | Current streak |
| `late_completion_penalty` | numeric | Late penalties |
| `overdue_penalty` | numeric | Overdue penalties |
| `consistency_gap_penalty` | numeric | Gap penalties |
| `progress_lag_penalty` | numeric | Lag penalties |
| `ontime_completion_bonus` | numeric | On-time bonuses |
| `early_completion_bonus` | numeric | Early bonuses |
| `streak_bonus` | numeric | Streak bonuses |
| `created_at` | timestamptz | Capture timestamp |

**Unique Constraint**: `(plan_id, snapshot_date)`

## 🔐 Security

- Row Level Security enabled on `health_snapshots` table
- Users can only view their own snapshots
- Edge function uses service role key for admin access
- RPC functions use `SECURITY DEFINER` for controlled access

## 🎯 Next Steps

1. **Deploy the migration** to create the table and RPC function
2. **Deploy the edge function** for automated capture
3. **Configure the cron job** for daily execution
4. **Test manually** to verify everything works
5. **Build UI components** using the new analytics functions

## 📝 Notes

- Snapshots are idempotent: re-running for the same date updates the existing snapshot
- Sunday-start week grouping is handled in JavaScript (not SQL)
- Efficiency can be NULL until completions exist
- All numeric fields use explicit casts for type safety
- COALESCE defaults applied consistently

## 🆘 Troubleshooting

### No snapshots appearing?

1. Check if cron job is scheduled: `SELECT * FROM cron.job`
2. Check cron job runs: `SELECT * FROM cron.job_run_details`
3. Manually trigger edge function to test
4. Check Supabase function logs

### Edge function errors?

1. Verify environment variables are set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
2. Check function logs in Supabase Dashboard
3. Test RPC function directly in SQL editor
4. Verify active plans exist: `SELECT * FROM plans WHERE status = 'active'`

### Analytics functions returning empty?

1. Ensure snapshots have been captured
2. Check date ranges match your data
3. Verify user_id and plan_id are correct
4. Check Supabase client connection

