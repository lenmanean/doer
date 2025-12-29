# Health Snapshot Setup

## Summary

This setup enables daily health snapshots for all active plans via a cron job.

## Components Created

### 1. Database Function
**File:** `supabase/migrations/20250131000001_add_capture_all_health_snapshots_function.sql`

Function: `capture_all_health_snapshots()`
- Loops through all active plans
- Captures health snapshot for each plan
- Returns summary with success/failure counts

### 2. Supabase Edge Function
**File:** `supabase/functions/capture_health_snapshots/index.ts`

Edge Function endpoint: `/functions/v1/capture_health_snapshots`
- Called by the pg_cron job daily at midnight
- Uses service role to bypass RLS
- Calls the database function to capture all snapshots

### 3. Required Extension
**File:** `supabase/migrations/20250131000000_enable_pg_net_for_cron.sql`

Enables `pg_net` extension for HTTP requests from cron jobs.

## Setup Steps

### Step 1: Enable pg_net Extension

Run this SQL in Supabase SQL Editor (if migration push fails):

```sql
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
```

### Step 2: Push Migrations

```bash
cd doer
supabase db push --yes
```

If migration history conflicts occur, you may need to:
1. Run the SQL directly in Supabase SQL Editor
2. Or repair migration history first

### Step 3: Deploy Edge Function

```bash
cd doer
supabase functions deploy capture_health_snapshots
```

### Step 4: Verify Cron Job

The cron job should already exist (Job ID: 6). Verify it's working:

```sql
SELECT * FROM cron.job WHERE jobname = 'daily-health-snapshots';
```

## Testing

### Test the Database Function
```sql
SELECT * FROM capture_all_health_snapshots();
```

### Test the Edge Function
```bash
curl -X POST https://xbzcyyukykxnrfgnhike.supabase.co/functions/v1/capture_health_snapshots \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Check Recent Snapshots
```sql
SELECT 
  plan_id,
  user_id,
  snapshot_date,
  health_score,
  has_scheduled_tasks,
  created_at
FROM health_snapshots
ORDER BY created_at DESC
LIMIT 10;
```

## Cron Job Details

- **Schedule:** `0 0 * * *` (Daily at midnight UTC)
- **Status:** Active
- **Method:** HTTP POST to Edge Function
- **Endpoint:** `/functions/v1/capture_health_snapshots`

## Troubleshooting

### Error: schema "net" does not exist
- Solution: Enable pg_net extension (Step 1)

### Edge Function not found
- Solution: Deploy the Edge Function (Step 3)

### No snapshots being created
- Check cron job is active: `SELECT * FROM cron.job WHERE jobname = 'daily-health-snapshots';`
- Check Edge Function logs in Supabase Dashboard
- Verify active plans exist: `SELECT COUNT(*) FROM plans WHERE status = 'active';`
















