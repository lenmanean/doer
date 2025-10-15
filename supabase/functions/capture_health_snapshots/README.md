# Health Snapshot Capture Edge Function

Automated daily health snapshot capture for all active plans.

## Purpose

This Supabase Edge Function runs daily to:
1. Query all active plans
2. Capture current health metrics for each plan
3. Store snapshots in the `health_snapshots` table
4. Log results for monitoring

## Deployment

### 1. Deploy the function

**Option A: Via Supabase Dashboard**
1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Create a new function**
3. Name it: `capture_health_snapshots`
4. Copy the contents of `index.ts` and paste into the editor
5. Click **Deploy**

**Option B: Via CLI (if available)**
```bash
supabase functions deploy capture_health_snapshots
```

### 2. Set up cron job

**In Supabase Dashboard → SQL Editor**, run:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily health snapshot capture at 00:00 UTC
SELECT cron.schedule(
  'daily-health-snapshots',           -- Job name
  '0 0 * * *',                        -- Cron expression: daily at 00:00 UTC
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

**Replace:**
- `YOUR_PROJECT_REF` with your Supabase project reference (found in Settings)
- `YOUR_ANON_KEY` with your Supabase anon key (found in Settings → API)

### 3. Verify cron job

**In Supabase Dashboard → SQL Editor**, run:

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- View cron job run history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## Manual Testing

### Option A: Via Supabase Dashboard
1. Go to **Edge Functions** → `capture_health_snapshots`
2. Click **Invoke** or **Test** button
3. Leave the body empty (or use `{}`)
4. Check the response and logs

### Option B: Via API Request
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/capture_health_snapshots' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

### Option C: Test RPC Function Directly in SQL Editor
```sql
-- Test the underlying RPC function for a specific plan
SELECT capture_health_snapshot(
  'user-uuid-here'::uuid,
  'plan-uuid-here'::uuid
);
```

## Response Format

### Success Response

```json
{
  "success": true,
  "captured": 5,
  "errors": 0,
  "total_plans": 5,
  "timestamp": "2025-10-12T00:00:00.000Z",
  "results": [
    {
      "success": true,
      "plan_id": "uuid-here",
      "health_score": 87.5
    }
  ]
}
```

### Error Response

```json
{
  "success": false,
  "error": "Failed to fetch active plans",
  "details": "error message here"
}
```

## Monitoring

The function logs detailed information to the console:
- Start timestamp
- Number of active plans found
- Success/error for each plan capture
- Final summary with counts

View logs in Supabase Dashboard:
- Functions → capture_health_snapshots → Logs

## Related Files

- **Migration**: `supabase/migrations/20251012000000_create_health_snapshots.sql`
  - Creates `health_snapshots` table
  - Creates `capture_health_snapshot()` RPC function
  
- **Analytics Library**: `doer/src/lib/analytics.ts`
  - `fetchHealthHistory()` - Query historical snapshots
  - `fetchWeeklyHealthAnalytics()` - Aggregate by week
  - `fetchHealthInsights()` - Trend analysis

## Technical Notes

- Uses service role key for admin access to all plans
- Idempotent: Updates existing snapshot if already captured today
- Unique constraint on `(plan_id, snapshot_date)` prevents duplicates
- Handles errors gracefully and continues processing other plans

