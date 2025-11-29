-- Check sync status in production
-- Query sync logs, tasks, and schedules for the Google Calendar connection

-- 1. Check recent sync logs
SELECT 
  id,
  sync_type,
  status,
  events_pulled,
  events_pushed,
  conflicts_detected,
  changes_summary,
  created_at,
  completed_at
FROM calendar_sync_logs
WHERE calendar_connection_id = 'cba2159b-5f95-4120-81d7-8e6bdad972d8'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check integration plan
SELECT 
  id,
  goal_text,
  plan_type,
  integration_metadata,
  created_at
FROM plans
WHERE plan_type = 'integration'
  AND integration_metadata->>'connection_id' = 'cba2159b-5f95-4120-81d7-8e6bdad972d8'
ORDER BY created_at DESC
LIMIT 1;

-- 3. Check calendar events
SELECT 
  id,
  summary,
  start_time,
  end_time,
  is_busy,
  is_doer_created,
  created_at
FROM calendar_events
WHERE calendar_connection_id = 'cba2159b-5f95-4120-81d7-8e6bdad972d8'
  AND is_busy = true
  AND is_doer_created = false
ORDER BY start_time DESC
LIMIT 10;

-- 4. Check tasks created from calendar events (if plan exists)
SELECT 
  t.id,
  t.name,
  t.is_calendar_event,
  t.calendar_event_id,
  t.is_detached,
  t.created_at
FROM tasks t
JOIN plans p ON t.plan_id = p.id
WHERE p.plan_type = 'integration'
  AND p.integration_metadata->>'connection_id' = 'cba2159b-5f95-4120-81d7-8e6bdad972d8'
  AND t.is_calendar_event = true
ORDER BY t.created_at DESC
LIMIT 10;

-- 5. Check task schedules
SELECT 
  ts.id,
  ts.task_id,
  ts.date,
  ts.start_time,
  ts.end_time,
  ts.status,
  ts.created_at
FROM task_schedule ts
JOIN tasks t ON ts.task_id = t.id
JOIN plans p ON ts.plan_id = p.id
WHERE p.plan_type = 'integration'
  AND p.integration_metadata->>'connection_id' = 'cba2159b-5f95-4120-81d7-8e6bdad972d8'
  AND t.is_calendar_event = true
ORDER BY ts.date DESC, ts.start_time DESC
LIMIT 10;

