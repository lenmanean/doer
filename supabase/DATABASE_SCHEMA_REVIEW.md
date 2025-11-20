# Database Schema Review

**Generated:** $(date)  
**Source:** Remote Supabase Database via CLI  
**Schema Dump:** `schema_dump.sql`

## Overview

The database contains **15 main tables** organized into the following functional areas:
- **Core Planning**: Plans, Tasks, Task Scheduling
- **User Management**: User Settings, Authentication
- **Billing & Usage**: Billing Plans, Usage Tracking, API Tokens
- **Analytics & Health**: Health Snapshots, Scheduling History
- **Onboarding**: Onboarding Responses

---

## Tables

### 1. **plans**
Core table for user plans/goals.

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `goal_text` (text) - The main goal/objective
- `start_date` (date)
- `end_date` (date, nullable)
- `status` (text) - 'active', 'paused', 'completed', 'archived'
- `plan_type` (text) - 'ai' or 'manual'
- `summary_data` (jsonb) - Plan metadata
- `timeline_days` (integer) - Duration in days (1-21 days constraint)
- `clarifications` (jsonb)
- `original_end_date` (date)
- `archived_at` (timestamp)
- `created_at`, `updated_at` (timestamps)

**Constraints:**
- Timeline must be 1-21 days
- start_date <= end_date
- Status must be one of: active, paused, completed, archived

**Relationships:**
- Has many: `tasks`, `task_schedule`, `health_snapshots`, `scheduling_history`
- Belongs to: `auth.users` (via user_id)

---

### 2. **tasks**
Individual tasks within plans or free-mode tasks.

**Key Columns:**
- `id` (uuid, PK)
- `plan_id` (uuid, FK → plans, nullable) - NULL for free-mode tasks
- `user_id` (uuid, FK → auth.users)
- `idx` (integer, nullable) - Sequential order within plan
- `name` (text) - Task name (required, non-empty)
- `details` (text)
- `estimated_duration_minutes` (integer, default 60) - 5-360 minutes
- `priority` (integer) - 1=Critical, 2=High, 3=Medium, 4=Low
- `category` (text) - 'A', 'B', or 'C' (priority/difficulty)
- `assigned_to_plan` (boolean, default true)
- `is_recurring` (boolean, default false)
- `is_indefinite` (boolean, default false)
- `recurrence_days` (integer[]) - Days of week (0=Sunday, 1=Monday, etc.)
- `recurrence_start_date`, `recurrence_end_date` (date)
- `default_start_time`, `default_end_time` (time)
- `created_at`, `updated_at` (timestamps)

**Constraints:**
- Duration: 5-360 minutes
- Priority: 1, 2, 3, or 4
- Category: 'A', 'B', or 'C'
- idx must be > 0
- Name cannot be empty

**Relationships:**
- Belongs to: `plans` (optional), `auth.users`
- Has many: `task_schedule`, `task_completions`, `pending_reschedules`

---

### 3. **task_schedule**
Time-block scheduling for tasks (when tasks are scheduled).

**Key Columns:**
- `id` (uuid, PK)
- `plan_id` (uuid, FK → plans, nullable) - NULL for free-mode
- `user_id` (uuid, FK → auth.users)
- `task_id` (uuid, FK → tasks)
- `day_index` (integer) - Day number within plan (>= 0)
- `date` (date) - Scheduled date
- `start_time`, `end_time` (time) - Time block
- `duration_minutes` (integer, nullable)
- `status` (text) - 'scheduled', 'completed', 'cancelled', 'rescheduled'
- `rescheduled_from` (date) - Original date if rescheduled
- `reschedule_count` (integer, default 0)
- `last_rescheduled_at` (timestamp)
- `reschedule_reason` (jsonb) - Metadata about rescheduling
- `pending_reschedule_id` (uuid, FK → pending_reschedules, nullable)
- `created_at`, `updated_at` (timestamps)

**Constraints:**
- day_index >= 0
- duration_minutes > 0 (if not NULL)
- start_time < end_time (if both present)
- Status: scheduled, completed, cancelled, rescheduled

**Relationships:**
- Belongs to: `plans` (optional), `tasks`, `auth.users`, `pending_reschedules` (optional)
- Links to: `task_completions` (via task_id + scheduled_date)

---

### 4. **task_completions**
Records when tasks are completed.

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `task_id` (uuid, FK → tasks)
- `plan_id` (uuid, FK → plans)
- `scheduled_date` (date) - Date task was scheduled (required for time-block scheduling)
- `completed_at` (timestamp, default now())
- `created_at` (timestamp)

**Relationships:**
- Belongs to: `tasks`, `plans`, `auth.users`
- Matches: `task_schedule` (via task_id + scheduled_date)

---

### 5. **pending_reschedules**
Reschedule proposals awaiting user approval.

**Key Columns:**
- `id` (uuid, PK)
- `plan_id` (uuid, FK → plans, nullable) - NULL for free-mode
- `user_id` (uuid, FK → auth.users)
- `task_schedule_id` (uuid, FK → task_schedule)
- `task_id` (uuid, FK → tasks)
- `proposed_date`, `proposed_start_time`, `proposed_end_time`, `proposed_day_index`
- `original_date`, `original_start_time`, `original_end_time`, `original_day_index`
- `context_score` (numeric) - How well proposed slot fits
- `priority_penalty`, `density_penalty` (numeric)
- `reason` (text, default 'auto_reschedule_overdue')
- `status` (text) - 'pending', 'accepted', 'rejected'
- `created_at`, `reviewed_at` (timestamps)
- `reviewed_by_user_id` (uuid, FK → auth.users, nullable)

**Constraints:**
- Status: pending, accepted, or rejected

**Relationships:**
- Belongs to: `plans` (optional), `tasks`, `task_schedule`, `auth.users`

---

### 6. **user_settings**
User preferences and account settings.

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, unique)
- `username` (text) - 3-20 chars, alphanumeric + underscore/hyphen
- `preferences` (jsonb) - Comprehensive user preferences:
  - Theme, time format, accent color
  - Workday hours (start/end)
  - Lunch hours (start/end)
  - Week start day (0=Sunday, 1=Monday, etc.)
  - Auto-reschedule settings
  - Privacy settings (analytics_enabled, improve_model_enabled)
- `avatar_url` (text)
- `first_name`, `last_name` (text)
- `date_of_birth` (date)
- `phone_number` (text)
- `phone_verified` (boolean, default false)
- `timezone` (text, default 'UTC')
- `locale` (text, default 'en-US')
- `referral_source` (text)
- `unmetered_access` (boolean, default false) - Admin override for usage limits
- `stripe_customer_id` (text)
- `created_at`, `updated_at` (timestamps)

**Constraints:**
- Username format: `^[a-zA-Z0-9_-]{3,20}$`
- Workday hours: start < end, 0-23 range
- Lunch hours: start < end, 0-23 range
- Time format: '12h' or '24h'

**Relationships:**
- Belongs to: `auth.users` (one-to-one)

**Special Features:**
- Trigger: `enforce_unmetered_access_default` - Prevents non-service-role from setting unmetered_access
- Trigger: `prevent_username_change` - Prevents username changes after initial set
- Trigger: `update_user_settings_updated_at` - Auto-updates updated_at

---

### 7. **health_snapshots**
Daily health metrics for plans.

**Key Columns:**
- `id` (uuid, PK)
- `plan_id` (uuid, FK → plans)
- `user_id` (uuid, FK → auth.users)
- `snapshot_date` (date, default CURRENT_DATE)
- `health_score` (numeric(5,2)) - Overall health (0-100)
- `has_scheduled_tasks` (boolean)
- `progress` (numeric(5,2)) - Progress percentage (0-100)
- `consistency` (numeric(5,2)) - Consistency score (0-100)
- `efficiency` (numeric(5,2), nullable) - Efficiency score (0-100)
- `total_tasks`, `total_completions` (integer)
- `days_elapsed` (integer)
- `current_streak_days` (integer)
- Penalties: `late_completion_penalty`, `overdue_penalty`, `consistency_gap_penalty`, `progress_lag_penalty`
- Bonuses: `ontime_completion_bonus`, `early_completion_bonus`, `streak_bonus`
- `created_at` (timestamp)

**Relationships:**
- Belongs to: `plans`, `auth.users`

**Unique Constraint:**
- (plan_id, snapshot_date) - One snapshot per plan per day

---

### 8. **scheduling_history**
Tracks automatic rescheduling adjustments.

**Key Columns:**
- `id` (uuid, PK)
- `plan_id` (uuid, FK → plans)
- `user_id` (uuid, FK → auth.users)
- `adjustment_date` (date, default CURRENT_DATE)
- `old_end_date`, `new_end_date` (date)
- `days_extended` (integer, default 0)
- `tasks_rescheduled` (integer, default 0)
- `task_adjustments` (jsonb) - Details of adjustments
- `reason` (jsonb) - Why rescheduling occurred
- `created_at` (timestamp)

**Relationships:**
- Belongs to: `plans`, `auth.users`

---

### 9. **onboarding_responses**
User onboarding questionnaire responses.

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `plan_id` (uuid, FK → plans, nullable) - Linked plan if created
- `responses` (jsonb) - Questionnaire data
- `created_at` (timestamp)

**Relationships:**
- Belongs to: `auth.users`, `plans` (optional)

---

### 10. **billing_plans**
Billing plan definitions.

**Key Columns:**
- `id` (uuid, PK)
- `slug` (text, unique) - Plan identifier
- `name` (text) - Display name
- `description` (text)
- `active` (boolean, default true)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamps)

**Relationships:**
- Has many: `billing_plan_cycles`

---

### 11. **billing_plan_cycles**
Billing cycle configurations (monthly/annual).

**Key Columns:**
- `id` (uuid, PK)
- `billing_plan_id` (uuid, FK → billing_plans)
- `cycle` (enum) - 'monthly' or 'annual'
- `api_credit_limit` (integer, >= 0)
- `integration_action_limit` (integer, >= 0)
- `price_cents` (integer, >= 0, nullable)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamps)

**Unique Constraint:**
- (billing_plan_id, cycle)

**Relationships:**
- Belongs to: `billing_plans`
- Has many: `user_plan_subscriptions`, `plan_usage_balances`, `api_tokens`

---

### 12. **user_plan_subscriptions**
User subscription to billing plans.

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `billing_plan_cycle_id` (uuid, FK → billing_plan_cycles)
- `status` (enum) - 'active', 'trialing', 'past_due', 'canceled'
- `current_period_start`, `current_period_end` (date)
- `cancel_at` (date, nullable)
- `cancel_at_period_end` (boolean, default false)
- `external_customer_id`, `external_subscription_id` (text) - Stripe IDs
- `created_at`, `updated_at` (timestamps)

**Unique Constraint:**
- One active/trialing subscription per user

**Relationships:**
- Belongs to: `auth.users`, `billing_plan_cycles`

---

### 13. **api_tokens**
API authentication tokens for users.

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `billing_plan_cycle_id` (uuid, FK → billing_plan_cycles, nullable)
- `secret_salt` (text)
- `token_hash` (text, unique) - Hashed token
- `name` (text) - Token name
- `description` (text)
- `scopes` (enum[]) - Array of: 'plans.generate', 'plans.read', 'plans.schedule', 'clarify', 'reschedules', 'integrations', 'admin'
- `expires_at` (timestamp, nullable)
- `last_used_at` (timestamp, nullable)
- `revoked_at` (timestamp, nullable)
- `metadata` (jsonb)
- `created_at` (timestamp)

**Relationships:**
- Belongs to: `auth.users`, `billing_plan_cycles` (optional)
- Has many: `usage_ledger` entries

---

### 14. **plan_usage_balances**
Usage credit balances for users.

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `billing_plan_cycle_id` (uuid, FK → billing_plan_cycles, nullable)
- `metric` (enum) - 'api_credits' or 'integration_actions'
- `cycle_start`, `cycle_end` (date)
- `allocation` (integer, >= 0) - Total credits allocated
- `used` (integer, >= 0, default 0) - Credits used
- `reserved` (integer, >= 0, default 0) - Credits reserved but not committed
- `created_at`, `updated_at` (timestamps)

**Unique Constraint:**
- (user_id, metric, cycle_start) - One balance per user/metric/cycle

**Relationships:**
- Belongs to: `auth.users`, `billing_plan_cycles` (optional)

---

### 15. **usage_ledger**
Audit log of all usage transactions.

**Key Columns:**
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `billing_plan_cycle_id` (uuid, FK → billing_plan_cycles, nullable)
- `token_id` (uuid, FK → api_tokens, nullable)
- `metric` (enum) - 'api_credits' or 'integration_actions'
- `action` (enum) - 'reserve', 'commit', 'release', 'adjust', 'reset'
- `amount` (integer, >= 0)
- `balance_after` (integer, >= 0, nullable)
- `reference` (jsonb) - Context about the usage
- `recorded_by` (uuid, nullable) - User/system that recorded
- `notes` (text)
- `created_at` (timestamp)

**Relationships:**
- Belongs to: `auth.users`, `billing_plan_cycles` (optional), `api_tokens` (optional)

---

## Custom Types (ENUMs)

1. **api_token_scope**: 'plans.generate', 'plans.read', 'plans.schedule', 'clarify', 'reschedules', 'integrations', 'admin'
2. **billing_cycle**: 'monthly', 'annual'
3. **subscription_status**: 'active', 'trialing', 'past_due', 'canceled'
4. **usage_ledger_action**: 'reserve', 'commit', 'release', 'adjust', 'reset'
5. **usage_metric**: 'api_credits', 'integration_actions'

---

## Views

1. **v_plan_health** - Real-time plan health metrics view
2. **user_usage_summary** - Aggregated usage summary per user

---

## Key Functions

### Plan Management
- `archive_plan(p_user_id, p_plan_id)` - Archive a plan
- `create_plan_with_tasks_transactional(...)` - Atomic plan creation with tasks
- `delete_plan_data(target_user_id, target_plan_id)` - Safe plan deletion
- `get_user_plans(p_user_id)` - Get all user plans
- `switch_active_plan(p_user_id, p_new_plan_id)` - Switch active plan

### Task Management
- `mark_task_complete(p_user_id, p_task_id)` - Mark task as complete
- `mark_task_incomplete(p_user_id, p_task_id)` - Unmark task completion
- `is_task_completed(p_user_id, p_task_id, p_scheduled_date)` - Check completion status
- `batch_insert_tasks(...)` - Batch insert tasks
- `batch_insert_schedules(...)` - Batch insert schedules

### Scheduling & Rescheduling
- `detect_missed_tasks(p_plan_id, p_check_date)` - Find missed tasks
- `detect_overdue_tasks_by_time(...)` - Find overdue tasks by time
- `get_rescheduling_stats(p_plan_id)` - Get rescheduling statistics
- `is_auto_reschedule_enabled(p_user_id)` - Check auto-reschedule setting
- `is_smart_scheduling_enabled(p_user_id)` - Check smart scheduling setting

### Health & Analytics
- `get_plan_health_now(p_user_id, p_plan_id)` - Get current plan health
- `capture_health_snapshot(p_user_id, p_plan_id)` - Capture daily snapshot

### User Settings
- `get_user_setting(p_user_id, p_setting_path)` - Get setting value
- `update_user_setting(p_user_id, p_setting_path, p_value)` - Update setting
- `get_workday_settings(p_user_id)` - Get workday hours
- `get_smart_scheduling_settings(p_user_id)` - Get scheduling preferences
- `is_username_available(check_username)` - Check username availability

### Usage & Billing
- `reserve_usage(...)` - Reserve usage credits
- `commit_usage(...)` - Commit reserved credits
- `release_usage(...)` - Release reserved credits
- `reset_usage_cycle(...)` - Reset usage cycle
- `current_usage_balance(p_user_id, p_metric)` - Get current balance

### Data Management
- `reset_user_data(target_user_id)` - Reset all user data
- `get_user_tables()` - Get list of user-owned tables
- `cleanup_orphaned_plan_data(p_plan_id, p_user_id)` - Cleanup orphaned data

---

## Security (Row Level Security)

All tables have RLS enabled with policies ensuring:
- Users can only access their own data (via `auth.uid() = user_id`)
- Service role has full access for administrative operations
- Specific policies for SELECT, INSERT, UPDATE, DELETE operations

**Special Cases:**
- `plan_usage_balances` and `usage_ledger` - Service role only for writes, users can read their own
- `api_tokens` - Users manage their own tokens (when not revoked)

---

## Indexes

Comprehensive indexing strategy including:
- Foreign key indexes
- User ID indexes for multi-tenancy
- Date range indexes for scheduling queries
- Composite indexes for common query patterns
- Partial indexes for filtered queries (e.g., active plans, pending reschedules)

**Key Indexes:**
- `idx_plans_user_status` - Fast lookup of active plans per user
- `idx_task_schedule_date_range` - Efficient date range queries
- `idx_task_completions_task_scheduled` - Composite index for completion lookups
- `idx_pending_reschedules_status` - Filter pending reschedules
- `user_plan_subscriptions_active_idx` - Unique active subscription per user

---

## Triggers

1. **update_updated_at_column()** - Auto-updates `updated_at` on:
   - `plans`
   - `tasks`
   - `task_schedule`
   - `user_settings`

2. **enforce_unmetered_access_default()** - Prevents non-service-role from setting `unmetered_access` on `user_settings`

3. **prevent_username_change()** - Prevents username changes after initial set on `user_settings`

4. **handle_new_user()** - Auto-creates `user_settings` record when new user signs up (via auth.users trigger)

---

## Notes

1. **Free-Mode Support**: Many tables support `plan_id = NULL` for free-mode tasks not associated with a plan
2. **Time-Block Scheduling**: System uses time blocks (start_time, end_time) for precise scheduling
3. **Health Model**: Degrading health model starting at 100%, with penalties and bonuses
4. **Usage Tracking**: Two-phase commit pattern (reserve → commit) for usage credits
5. **Rescheduling**: Supports automatic rescheduling with user approval workflow
6. **Recurring Tasks**: Weekly recurring tasks with day-of-week arrays
7. **Timeline Constraints**: Plans limited to 1-21 days to maintain quality

---

## Schema Dump Location

Full schema dump available at: `schema_dump.sql`







