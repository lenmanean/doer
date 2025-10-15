# Health Snapshots System - Implementation Summary

## ✅ Components Created

### 1. Database Migration
**Location**: `supabase/migrations/20251012000000_create_health_snapshots.sql`

**What it does**:
- Creates `health_snapshots` table for storing daily health metrics
- Creates `capture_health_snapshot(p_user_id, p_plan_id)` RPC function
- Sets up Row Level Security policies
- Creates indexes for efficient querying
- Unique constraint on `(plan_id, snapshot_date)` prevents duplicates

**Key Features**:
- Stores all health metrics from `get_plan_health_now()`
- Idempotent: updating existing snapshots on re-run
- Uses explicit numeric casts for type safety
- COALESCE defaults applied consistently

### 2. Supabase Edge Function
**Location**: `supabase/functions/capture_health_snapshots/`

**Files**:
- `index.ts` - Main function code
- `deno.json` - Deno configuration
- `README.md` - Deployment and usage documentation

**What it does**:
- Queries all active plans (`SELECT user_id, id FROM plans WHERE status = 'active'`)
- Loops through each plan and calls `rpc('capture_health_snapshot', { p_user_id, p_plan_id })`
- Logs results to console for monitoring
- Returns JSON: `{ captured: count, errors: count, results: [...] }`
- Designed for daily cron execution at 00:00 UTC

### 3. Client Analytics Library Updates
**Location**: `doer/src/lib/analytics.ts`

**New Functions Added**:

#### `fetchHealthHistory(userId, planId, days = 7)`
- Queries `health_snapshots` for past N days
- Returns chronologically sorted array of snapshots
- Default: last 7 days

#### `fetchWeeklyHealthAnalytics(userId, planId, weeks = 4)`
- Queries `health_snapshots` for past N weeks
- Groups by Sunday-start weeks (handled in JavaScript)
- Returns weekly averages and total penalties/bonuses
- Default: last 4 weeks

#### `fetchHealthInsights(userId, planId)`
- Fetches 14 days of history
- Compares last 7 days vs previous 7 days
- Computes trend: "improving", "declining", or "neutral"
- Uses ±5% threshold for trend determination
- Returns: `{ trend, message, change }`

**Preserved Functions**:
- ✅ `fetchHealthMetrics()` - continues to work as before
- ✅ All deprecated functions remain for backward compatibility
- ✅ No breaking changes

## 📋 Integration Points

1. **Uses `get_plan_health_now()`** from `20251011190000_vitality_degrading_health_model.sql`
2. **Preserves `fetchHealthMetrics()`** functionality - no breaking changes
3. **No dashboard or UI changes** - only backend infrastructure
4. **All functions use existing Supabase client** and return plain JSON objects

## 🚀 Deployment Checklist

- [ ] **Run migration in SQL Editor**: Copy/paste `20251012000000_create_health_snapshots.sql` and execute
- [ ] **Deploy edge function via Dashboard**: Create function in Edge Functions section
- [ ] **Configure cron job in SQL Editor**: Run the cron schedule SQL (see integration guide)
- [ ] **Test RPC function**: Use SQL Editor to test `capture_health_snapshot()`
- [ ] **Verify snapshots**: Query `health_snapshots` table to confirm data
- [ ] **Test edge function**: Use Dashboard invoke or API request
- [ ] **Build UI components** using new analytics functions (optional)

## 📖 Documentation

- **Integration Guide**: `supabase/migrations/HEALTH_SNAPSHOTS_INTEGRATION.md`
  - Complete deployment steps
  - Usage examples
  - Testing procedures
  - Troubleshooting guide

- **Edge Function README**: `supabase/functions/capture_health_snapshots/README.md`
  - Deployment instructions
  - Cron job configuration
  - Manual testing commands
  - Response format documentation

## 🔑 Key Technical Details

✅ Explicit numeric casts: `(json_field->>'key')::numeric`  
✅ COALESCE defaults applied consistently  
✅ Efficiency nullable: `numeric NULL DEFAULT NULL`  
✅ Sunday week grouping done in JavaScript (not SQL)  
✅ Unique constraint prevents duplicate snapshots  
✅ Idempotent RPC function (updates existing snapshots)  
✅ Row Level Security enabled  

## 📊 Usage Example

```typescript
import { 
  fetchHealthHistory, 
  fetchWeeklyHealthAnalytics, 
  fetchHealthInsights 
} from '@/lib/analytics'

// Get 7 days of history
const history = await fetchHealthHistory(userId, planId)

// Get 4 weeks of aggregated data
const weekly = await fetchWeeklyHealthAnalytics(userId, planId)

// Get trend analysis
const insights = await fetchHealthInsights(userId, planId)
console.log(insights.message) // "Your health has improved by 12.5% over the last week"
```

## 🧪 Testing

All testing is done via **Supabase Dashboard → SQL Editor**:

### 1. Find an Active Plan
```sql
SELECT id, user_id FROM plans WHERE status = 'active' LIMIT 1;
```

### 2. Test RPC Function
```sql
-- Replace UUIDs with actual values from above
SELECT capture_health_snapshot(
  'user-uuid'::uuid,
  'plan-uuid'::uuid
);
```

### 3. Verify Snapshots Were Created
```sql
SELECT 
  snapshot_date,
  health_score,
  progress,
  consistency,
  created_at
FROM health_snapshots 
WHERE plan_id = 'plan-uuid' 
ORDER BY snapshot_date DESC
LIMIT 10;
```

### 4. Test Edge Function (via Dashboard)
- Go to **Edge Functions** → `capture_health_snapshots`
- Click **Invoke** to test manually
- Check logs for results

## ✨ What's Next?

The infrastructure is now ready! You can:

1. **Deploy the migration and edge function** to start capturing snapshots
2. **Build UI components** to visualize health trends
3. **Create dashboard widgets** for insights
4. **Add health alerts** based on declining trends
5. **Generate reports** using weekly analytics

All the backend plumbing is complete and ready to use! 🎉

