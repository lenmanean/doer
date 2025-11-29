// Quick script to check sync status for the Google Calendar connection
// Run from the doer app directory:
//   cd doer
//   node check-sync-status.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// Prefer service role if available locally; fall back to anon for read-only checks
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL / key)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSyncStatus() {
  // These are from your logs above
  const connectionId = 'cba2159b-5f95-4120-81d7-8e6bdad972d8'
  const userId = 'da08fe9b-0dc0-49bf-af30-363923783e08'

  console.log('\n=== Checking Integration Plans ===')
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('id, goal_text, plan_type, integration_metadata, created_at')
    .eq('plan_type', 'integration')
    .eq('integration_metadata->>connection_id', connectionId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (plansError) {
    console.error('Error fetching plans:', plansError)
  } else {
    console.log(`Found ${plans?.length || 0} integration plan(s):`)
    plans?.forEach((plan) => {
      console.log(`  - ${plan.goal_text} (${plan.id})`)
      console.log(`    Created: ${plan.created_at}`)
      console.log(`    Metadata:`, JSON.stringify(plan.integration_metadata, null, 2))
    })
  }

  console.log('\n=== Checking Sync Logs ===')
  const { data: syncLogs, error: syncLogsError } = await supabase
    .from('calendar_sync_logs')
    .select(
      'id, sync_type, status, events_pulled, events_pushed, conflicts_detected, changes_summary, created_at, completed_at'
    )
    .eq('calendar_connection_id', connectionId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (syncLogsError) {
    console.error('Error fetching sync logs:', syncLogsError)
  } else {
    console.log(`Found ${syncLogs?.length || 0} sync log(s):`)
    syncLogs?.forEach((log) => {
      console.log(
        `  - ${log.sync_type} | ${log.status} | ${log.events_pulled || 0} events pulled`
      )
      console.log(`    Created: ${log.created_at}, Completed: ${log.completed_at || 'N/A'}`)
      if (log.changes_summary) {
        console.log(`    Summary:`, JSON.stringify(log.changes_summary, null, 2))
      }
    })
  }

  console.log('\n=== Checking Calendar Events ===')
  const { data: events, error: eventsError } = await supabase
    .from('calendar_events')
    .select('id, summary, start_time, end_time, is_busy, is_doer_created')
    .eq('calendar_connection_id', connectionId)
    .eq('is_busy', true)
    .eq('is_doer_created', false)
    .order('start_time', { ascending: false })
    .limit(10)

  if (eventsError) {
    console.error('Error fetching calendar events:', eventsError)
  } else {
    console.log(`Found ${events?.length || 0} calendar event(s):`)
    events?.forEach((event) => {
      console.log(`  - ${event.summary || 'Untitled'} (${event.id})`)
      console.log(`    Time: ${event.start_time} to ${event.end_time}`)
    })
  }

  if (plans && plans.length > 0) {
    const planId = plans[0].id
    console.log(`\n=== Checking Tasks for Plan ${planId} ===`)
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, is_calendar_event, calendar_event_id, is_detached, created_at')
      .eq('plan_id', planId)
      .eq('is_calendar_event', true)
      .order('created_at', { ascending: false })
      .limit(10)

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
    } else {
      console.log(`Found ${tasks?.length || 0} calendar event task(s):`)
      tasks?.forEach((task) => {
        console.log(`  - ${task.name} (${task.id})`)
        console.log(`    Calendar Event ID: ${task.calendar_event_id}`)
        console.log(`    Detached: ${task.is_detached}`)
        console.log(`    Created: ${task.created_at}`)
      })
    }

    console.log(`\n=== Checking Task Schedules for Plan ${planId} ===`)
    const { data: schedules, error: schedulesError } = await supabase
      .from('task_schedule')
      .select('id, task_id, date, start_time, end_time, status')
      .eq('plan_id', planId)
      .order('date', { ascending: false })
      .limit(10)

    if (schedulesError) {
      console.error('Error fetching task schedules:', schedulesError)
    } else {
      console.log(`Found ${schedules?.length || 0} task schedule(s):`)
      schedules?.forEach((schedule) => {
        console.log(`  - Schedule ${schedule.id} for task ${schedule.task_id}`)
        console.log(
          `    Date: ${schedule.date}, Time: ${schedule.start_time} - ${schedule.end_time}`
        )
        console.log(`    Status: ${schedule.status}`)
      })
    }
  }

  console.log('\n=== Done ===\n')
}

checkSyncStatus().catch((err) => {
  console.error('Unexpected error in check-sync-status:', err)
  process.exit(1)
})


