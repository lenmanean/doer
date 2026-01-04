# Health Snapshot Setup - Complete ✅

## What Was Accomplished

### ✅ Migrations Pushed
1. **20250131000000_enable_pg_net_for_cron.sql** - Enables pg_net extension for HTTP requests
2. **20250131000001_add_capture_all_health_snapshots_function.sql** - Creates `capture_all_health_snapshots()` function
3. **20250131000002_fix_migration_history.sql** - Migration history maintenance

### ✅ Edge Function Deployed
- **Function:** `capture_health_snapshots`
- **Location:** `supabase/functions/capture_health_snapshots/index.ts`
- **Endpoint:** `https://xbzcyyukykxnrfgnhike.supabase.co/functions/v1/capture_health_snapshots`
- **Status:** ✅ Deployed successfully

### ✅ Cron Job Configuration
- **Job ID:** 6
- **Name:** `daily-health-snapshots`
- **Schedule:** `0 0 * * *` (Daily at midnight UTC)
- **Status:** Active
- **Method:** HTTP POST to Edge Function

## Verification Steps

### 1. Verify pg_net Extension
Run in Supabase SQL Editor:
```sql
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'pg_net';
```
**Expected:** Should return pg_net with a version number

### 2. Verify Database Function
```sql
SELECT proname, pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'capture_all_health_snapshots';
```
**Expected:** Should return the function definition

### 3. Test Database Function
```sql
SELECT * FROM capture_all_health_snapshots();
```
**Expected:** Returns JSON with:
- `success: true`
- `total_plans: <number>`
- `successful_snapshots: <number>`
- `failed_snapshots: <number>`

### 4. Verify Cron Job
```sql
SELECT jobid, schedule, jobname, active, command
FROM cron.job 
WHERE jobname = 'daily-health-snapshots';
```
**Expected:** Should show active = true

### 5. Check Recent Snapshots
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

### 6. Test Edge Function
You can test the Edge Function via:
- **Supabase Dashboard:** Functions → capture_health_snapshots → Invoke
- **cURL:**
```bash
curl -X POST https://xbzcyyukykxnrfgnhike.supabase.co/functions/v1/capture_health_snapshots \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## How It Works

1. **Cron Job** (pg_cron) runs daily at midnight UTC
2. **Cron Job** calls Edge Function via `net.http_post()`
3. **Edge Function** receives the request and calls `capture_all_health_snapshots()` RPC
4. **Database Function** loops through all active plans
5. **For each plan**, calls `capture_health_snapshot(user_id, plan_id)`
6. **Health snapshots** are stored in `health_snapshots` table

## Files Created

- `supabase/migrations/20250131000000_enable_pg_net_for_cron.sql`
- `supabase/migrations/20250131000001_add_capture_all_health_snapshots_function.sql`
- `supabase/migrations/20250131000002_fix_migration_history.sql`
- `supabase/functions/capture_health_snapshots/index.ts`
- `verify-health-snapshots.sql` (verification queries)
- `test-health-snapshots.js` (test script - requires env vars)
- `HEALTH_SNAPSHOT_SETUP.md` (documentation)

## Next Steps

1. ✅ Run verification queries in Supabase SQL Editor
2. ✅ Test the database function manually
3. ✅ Monitor the cron job execution (check logs after midnight UTC)
4. ✅ Verify snapshots are being created daily

## Troubleshooting

If the cron job fails:
- Check Edge Function logs in Supabase Dashboard
- Verify pg_net extension is enabled
- Check that active plans exist
- Verify the cron job is still active

The system is now fully set up and should automatically capture health snapshots daily! 🎉





















