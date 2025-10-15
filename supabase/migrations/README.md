# Database Migrations

This directory contains SQL migration files for the Doer application database schema.

## Migration Naming Convention

Migrations follow the format: `YYYYMMDDHHMMSS_description.sql`

Example: `20251011120000_create_get_task_completion_status.sql`

## Migration History

### October 11, 2025 - Database Function Alignment & Realtime Sync Stabilization

This series of migrations fixes critical infrastructure issues identified during the system audit:

#### 20251011120000_create_get_task_completion_status.sql
**Purpose:** Create missing RPC function called by frontend code

- Adds `get_task_completion_status(user_id, plan_id, date)` function
- Returns task completion status for all tasks scheduled on a specific date
- Fixes runtime errors in `roadmap-client.ts` that was calling non-existent function

**Impact:** Enables roadmap page to correctly fetch and display task completion status

---

#### 20251011120500_sync_realtime_channels.sql
**Purpose:** Unify realtime notification channels

- Updates `refresh_plan_state()` to emit on `plan_update` channel (was `plan_state_updated`)
- Updates `notify_plan_update()` trigger to emit on `plan_update` channel
- Standardizes all realtime notifications under single channel name

**Impact:** Fixes realtime synchronization between frontend and database. All components now listen to the same channel, ensuring instant UI updates after task completions.

---

#### 20251011121000_add_milestone_fill_trigger.sql
**Purpose:** Ensure data integrity for task completions

- Creates `auto_fill_milestone_in_completion()` trigger function
- Automatically populates `milestone_id` in `task_completions` table
- Pulls milestone_id from associated task record

**Impact:** Maintains referential integrity for health metrics calculations and prevents incomplete completion records.

---

#### 20251011121500_drop_legacy_analytics.sql
**Purpose:** Remove deprecated analytics infrastructure

- Drops `generate_daily_analytics_snapshots()` function (unused)
- Drops `update_analytics_snapshots()` trigger function (unused)
- Drops `analytics_snapshots` table (replaced by live views)
- Drops `_backup_analytics_snapshots` table (backup of removed table)

**Impact:** Cleans up database, removes dead code that referenced non-existent structures. Analytics now use live views (`v_plan_health`, `v_user_progress`) and `get_vitality_now()` RPC function.

**Note:** `analytics_*_7d` views are preserved for legacy debugging purposes and can be removed in future if confirmed unused.

---

#### 20251011122000_verification_queries.sql
**Purpose:** Verification queries for manual testing

- Contains SQL queries to verify all migrations applied correctly
- Not executed automatically; for manual testing only
- Includes checks for function existence, trigger setup, and legacy cleanup

**Usage:** Run queries manually in Supabase SQL Editor to verify migration success.

---

#### 20251011150000_fix_task_completions_duplicates.sql
**Purpose:** Initial fix for duplicate task completion records

**⚠️ SUPERSEDED by 20251011160000** - This migration added a UNIQUE constraint on `(user_id, task_id, scheduled_date)` which was later found to be insufficient. The constraint still allowed the same task to be completed multiple times with different scheduled_dates (Dashboard using today vs Roadmap using actual schedule date). See migration 20251011160000 for the complete fix.

---

#### 20251011160000_fix_task_completion_logic.sql
**Purpose:** Complete fix for task completion tracking issues

- Cleans up completion records with invalid scheduled_dates (not matching task_schedule)
- **Updates UNIQUE constraint** to `(user_id, task_id, plan_id)` - removes scheduled_date
- **Recreates v_user_progress view** with correct counting logic (DISTINCT task_ids)
- Prevents same task from being completed multiple times with different dates

**Impact:** 
- Fixes milestone showing 100% complete when only 50% done
- Prevents duplicate completions from Dashboard vs Roadmap pages
- Ensures task counts are accurate (no inflation)
- Guarantees consistency between Dashboard and Roadmap

**Background:** Three issues were discovered:
1. Dashboard was using today's date while Roadmap used task_schedule date → same task completed twice
2. UNIQUE constraint allowed this because it included scheduled_date
3. v_user_progress view counted ALL combinations instead of unique tasks

**Frontend Changes:** Dashboard now uses task_schedule date instead of today's date (dashboard/page.tsx line 356-360)

---

#### 20251011170000_create_vitality_functions.sql
**Purpose:** Create missing get_vitality_now RPC and v_plan_health view for dashboard metrics

- Creates `v_plan_health` view with progress, consistency, efficiency calculations
- Creates `get_vitality_now()` RPC function to return vitality metrics
- Provides health score (0-100) based on task completion patterns

**Impact:** Enables dashboard health orb to display real-time plan vitality metrics

---

#### 20251011190000_vitality_degrading_health_model.sql
**Purpose:** Replace progress-based metrics with degrading health bar model

**⚠️ IMPORTANT: This migration introduces a paradigm shift in health calculations**

**New Model:** Plans start at 100% health (green) and degrade with poor habits, recover with good habits

**Degradation Factors:**
- Late completions: -5 points per task
- Overdue tasks: -3 points per day per task
- Consistency gaps: -2 points per day with no completions
- Progress lag: -10 points if behind expected rate

**Recovery Factors:**
- On-time completions: +2 points per task
- Early completions: +4 points per task
- Daily streak bonus: +1 point per day

**Database Changes:**
- Updates `v_plan_health` view to calculate health_score (0-100) using penalty/bonus system
- Creates `get_plan_health_now()` RPC function (recommended)
- Keeps `get_vitality_now()` as backward-compatible alias
- Adds `has_scheduled_tasks` flag for gray state detection (no tasks scheduled yet)

**Frontend Impact:**
- Dashboard shows green orb at 100% initially
- Orb degrades to orange/red with poor habits
- Gray state only when no tasks scheduled
- `/vitality` renamed to `/health` route
- Sidebar updated to show "Health" instead of "Vitality"

**Migration Status:** Code includes backward compatibility fallback. Application works with or without migration applied.

---

## Current Database Function Inventory

### Active RPC Functions (Called by Frontend)

| Function | Arguments | Purpose | Used By |
|----------|-----------|---------|---------|
| `get_task_completion_status` | user_id, plan_id, date | Get completion status for tasks on specific date | `roadmap-client.ts` |
| `get_plan_health_now` | user_id, plan_id | Get real-time health metrics (degrading model) | `analytics.ts` |
| `get_vitality_now` | user_id, plan_id | Alias for get_plan_health_now (backward compat) | `analytics.ts` (fallback) |
| `delete_plan_data` | user_id, plan_id | Transactional plan deletion | `dashboard/page.tsx`, `plans/generate/route.ts` |
| `reset_user_data` | user_id | Complete user data reset | `datareset/route.ts` |

### Trigger Functions (Automatic)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `auto_fill_milestone_in_completion` | `task_completions` BEFORE INSERT | Auto-populate milestone_id |
| `notify_plan_update` | Various tables | Emit realtime notifications on `plan_update` channel |
| `fill_milestone_id` | Legacy trigger | May be redundant with new auto-fill trigger |

### Utility Functions

| Function | Purpose | Notes |
|----------|---------|-------|
| `refresh_plan_state` | Manual plan state refresh | Emits on `plan_update` channel |
| `get_user_tables` | List user tables | Utility function |
| `is_task_completed` | Check if task completed | May be replaced by `get_task_completion_status` |

## Realtime Architecture

### Unified Channel: `plan_update`

All database changes that affect plan state emit notifications on this channel:

```typescript
// Frontend subscription pattern
supabase
  .channel(`roadmap-sync-${userId}`)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'task_completions' 
  }, callback)
  .subscribe()
```

### Notification Payload Structure

```json
{
  "user_id": "uuid",
  "plan_id": "uuid",
  "task_id": "uuid",
  "action": "INSERT|UPDATE|DELETE",
  "timestamp": "ISO8601"
}
```

## Running Migrations

### Local Development
```bash
supabase migration up
```

### Production
Migrations are automatically applied via Supabase CLI or Dashboard when pushed to production branch.

### Manual Application
1. Open Supabase Dashboard → SQL Editor
2. Copy migration file contents
3. Execute SQL
4. Verify with verification queries

## Testing

### Automated Tests
```bash
npm run test tests/realtime-sync.test.ts
```

### Manual Verification
Run queries from `20251011122000_verification_queries.sql` in SQL Editor.

## Rollback Strategy

These migrations include schema and function changes. To rollback:

1. Restore previous function definitions from git history
2. Re-create dropped tables if needed (data loss permanent)
3. Update frontend code to match old function signatures

⚠️ **Warning:** Rolling back `20251011121500_drop_legacy_analytics.sql` will NOT restore data from dropped tables.

## Future Migrations

When creating new migrations:

1. Use timestamp format: `YYYYMMDDHHMMSS_description.sql`
2. Include comments explaining purpose and impact
3. Add function comments with `COMMENT ON FUNCTION`
4. Update this README with migration details
5. Create verification queries if changing critical functions
6. Test locally before applying to production

## Questions or Issues?

If a migration fails or causes issues:

1. Check Supabase logs for error details
2. Run verification queries to identify issue
3. Review frontend code for function signature mismatches
4. Check realtime channel subscriptions match new conventions

