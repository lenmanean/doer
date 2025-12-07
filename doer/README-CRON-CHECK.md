# Checking for Cron Jobs

## Quick Method: Supabase SQL Editor (Recommended)
1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `check-cron-jobs.sql`
4. Run the queries

## Using psql (Command Line)

### Step 1: Get Your Database Connection String
1. Go to Supabase Dashboard > **Project Settings** > **Database**
2. Find the **Connection string** section
3. Copy the URI format (looks like: `postgresql://postgres:[PASSWORD]@db.xbzcyyukykxnrfgnhike.supabase.co:5432/postgres`)

### Step 2: Run the Query

**Windows (PowerShell/CMD):**
```powershell
$env:DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@db.xbzcyyukykxnrfgnhike.supabase.co:5432/postgres"
psql $env:DATABASE_URL -f check-cron-jobs.sql
```

**Windows (Batch):**
```batch
set DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.xbzcyyukykxnrfgnhike.supabase.co:5432/postgres
psql %DATABASE_URL% -f check-cron-jobs.sql
```

**Linux/Mac:**
```bash
export DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@db.xbzcyyukykxnrfgnhike.supabase.co:5432/postgres"
psql "$DATABASE_URL" -f check-cron-jobs.sql
```

### Alternative: Run Single Query
```bash
psql "$DATABASE_URL" -c "SELECT * FROM cron.job;"
```

## What the Queries Check
1. ✅ Verifies `pg_cron` extension is installed
2. ✅ Lists all cron jobs in the database
3. ✅ Specifically searches for health snapshot related jobs
4. ✅ Counts total and active cron jobs

## Expected Results
- If no cron jobs exist: Empty result set
- If health snapshot cron exists: You'll see a job with `capture_health_snapshot` in the command
