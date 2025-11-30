import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PREFERENCES } from '@/lib/types/preferences'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/delete-data
 * Deletes all user data but keeps the account intact
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { confirmation, deletePlansOnly, deleteTasksOnly } = body

    // Require explicit confirmation
    if (confirmation !== 'DELETE DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation' },
        { status: 400 }
      )
    }

    // If deletePlansOnly is true, only delete plans
    if (deletePlansOnly) {
      const { error: plansError } = await supabase
        .from('plans')
        .delete()
        .eq('user_id', user.id)

      if (plansError) {
        console.error('Error deleting user plans:', plansError)
        return NextResponse.json(
          { error: 'Failed to delete plans' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        success: true,
        message: 'All your plans have been permanently deleted.'
      })
    }

    // If deleteTasksOnly is true, only delete tasks
    if (deleteTasksOnly) {
      // Delete all tasks (both plan and free mode)
      const { error: allTasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', user.id)

      if (allTasksError) {
        console.error('Error deleting tasks:', allTasksError)
        return NextResponse.json(
          { error: 'Failed to delete tasks' },
          { status: 500 }
        )
      }

      // Delete all task schedules
      const { error: taskSchedulesError } = await supabase
        .from('task_schedule')
        .delete()
        .eq('user_id', user.id)

      if (taskSchedulesError) {
        console.error('Error deleting task schedules:', taskSchedulesError)
        // Continue anyway
      }

      return NextResponse.json({ 
        success: true,
        message: 'All your tasks have been permanently deleted.'
      })
    }

    // Delete all user plans (cascades will handle milestones, tasks, etc.)
    const { error: plansError } = await supabase
      .from('plans')
      .delete()
      .eq('user_id', user.id)

    if (plansError) {
      console.error('Error deleting user plans:', plansError)
      // Continue anyway, we'll try to delete other data
    }

    // Delete free mode tasks (tasks with plan_id: null)
    const { error: freeTasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .is('plan_id', null)

    if (freeTasksError) {
      console.error('Error deleting free mode tasks:', freeTasksError)
      // Continue anyway
    }

    // Delete free mode task schedules (task_schedule with plan_id: null)
    const { error: freeTaskSchedulesError } = await supabase
      .from('task_schedule')
      .delete()
      .eq('user_id', user.id)
      .is('plan_id', null)

    if (freeTaskSchedulesError) {
      console.error('Error deleting free mode task schedules:', freeTaskSchedulesError)
      // Continue anyway
    }

    // Delete health snapshots
    const { error: healthSnapshotsError } = await supabase
      .from('health_snapshots')
      .delete()
      .eq('user_id', user.id)

    if (healthSnapshotsError) {
      console.error('Error deleting health snapshots:', healthSnapshotsError)
      // Continue anyway
    }

    // Delete onboarding responses
    const { error: onboardingError } = await supabase
      .from('onboarding_responses')
      .delete()
      .eq('user_id', user.id)

    if (onboardingError) {
      console.error('Error deleting onboarding responses:', onboardingError)
      // Continue anyway
    }

    // Delete scheduling history
    const { error: schedulingHistoryError } = await supabase
      .from('scheduling_history')
      .delete()
      .eq('user_id', user.id)

    if (schedulingHistoryError) {
      console.error('Error deleting scheduling history:', schedulingHistoryError)
      // Continue anyway
    }

    // Delete task completions
    const { error: taskCompletionsError } = await supabase
      .from('task_completions')
      .delete()
      .eq('user_id', user.id)

    if (taskCompletionsError) {
      console.error('Error deleting task completions:', taskCompletionsError)
      // Continue anyway
    }

    // Delete pending reschedules
    const { error: pendingReschedulesError } = await supabase
      .from('pending_reschedules')
      .delete()
      .eq('user_id', user.id)

    if (pendingReschedulesError) {
      console.error('Error deleting pending reschedules:', pendingReschedulesError)
      // Continue anyway
    }

    // Delete calendar-related data
    // Note: calendar_connections cascades to calendar_events, calendar_event_links, etc.
    const { error: calendarConnectionsError } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('user_id', user.id)

    if (calendarConnectionsError) {
      console.error('Error deleting calendar connections:', calendarConnectionsError)
      // Continue anyway
    }

    // Delete calendar sync logs (in case cascade didn't work)
    const { error: calendarSyncLogsError } = await supabase
      .from('calendar_sync_logs')
      .delete()
      .eq('user_id', user.id)

    if (calendarSyncLogsError) {
      console.error('Error deleting calendar sync logs:', calendarSyncLogsError)
      // Continue anyway
    }

    // Delete calendar connection events
    const { error: calendarConnectionEventsError } = await supabase
      .from('calendar_connection_events')
      .delete()
      .eq('user_id', user.id)

    if (calendarConnectionEventsError) {
      console.error('Error deleting calendar connection events:', calendarConnectionEventsError)
      // Continue anyway
    }

    // Delete API tokens
    const { error: apiTokensError } = await supabase
      .from('api_tokens')
      .delete()
      .eq('user_id', user.id)

    if (apiTokensError) {
      console.error('Error deleting API tokens:', apiTokensError)
      // Continue anyway
    }

    // Delete usage balances
    const { error: usageBalancesError } = await supabase
      .from('plan_usage_balances')
      .delete()
      .eq('user_id', user.id)

    if (usageBalancesError) {
      console.error('Error deleting usage balances:', usageBalancesError)
      // Continue anyway
    }

    // Delete usage ledger entries
    const { error: usageLedgerError } = await supabase
      .from('usage_ledger')
      .delete()
      .eq('user_id', user.id)

    if (usageLedgerError) {
      console.error('Error deleting usage ledger:', usageLedgerError)
      // Continue anyway
    }

    // Delete user plan subscriptions (billing data)
    const { error: subscriptionsError } = await supabase
      .from('user_plan_subscriptions')
      .delete()
      .eq('user_id', user.id)

    if (subscriptionsError) {
      console.error('Error deleting user plan subscriptions:', subscriptionsError)
      // Continue anyway
    }

    // Delete username change audit
    const { error: usernameAuditError } = await supabase
      .from('username_change_audit')
      .delete()
      .eq('user_id', user.id)

    if (usernameAuditError) {
      console.error('Error deleting username change audit:', usernameAuditError)
      // Continue anyway
    }

    // Delete email change requests
    const { error: emailChangeRequestsError } = await supabase
      .from('email_change_requests')
      .delete()
      .eq('user_id', user.id)

    if (emailChangeRequestsError) {
      console.error('Error deleting email change requests:', emailChangeRequestsError)
      // Continue anyway
    }

    // Delete email change audit
    const { error: emailAuditError } = await supabase
      .from('email_change_audit')
      .delete()
      .eq('user_id', user.id)

    if (emailAuditError) {
      console.error('Error deleting email change audit:', emailAuditError)
      // Continue anyway
    }

    // Reset user settings to defaults (keep the profile but reset settings)
    const { error: settingsError } = await supabase
      .from('user_settings')
      .update({
        preferences: DEFAULT_PREFERENCES
      })
      .eq('user_id', user.id)

    if (settingsError) {
      console.error('Error resetting user settings:', settingsError)
      // Continue anyway
    }

    return NextResponse.json({ 
      success: true,
      message: 'All your data has been permanently deleted. Your account remains active.'
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/settings/delete-data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
