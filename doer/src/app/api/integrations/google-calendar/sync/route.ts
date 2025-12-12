import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pullCalendarEvents } from '@/lib/calendar/google-calendar-sync'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Manual sync endpoint - pull events from Google Calendar
 * POST /api/integrations/google-calendar/sync
 * Body: { calendar_ids?: string[] } - optional, defaults to selected calendars
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user's calendar connection
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id, selected_calendar_ids, sync_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()
    
    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Google Calendar connection found' },
        { status: 404 }
      )
    }
    
    // Parse request body for optional calendar_ids override
    let calendarIds = connection.selected_calendar_ids || []
    try {
      const body = await request.json().catch(() => ({}))
      if (body.calendar_ids && Array.isArray(body.calendar_ids) && body.calendar_ids.length > 0) {
        calendarIds = body.calendar_ids
      }
    } catch {
      // Use default selected calendars
    }
    
    if (calendarIds.length === 0) {
      return NextResponse.json(
        { error: 'No calendars selected for sync' },
        { status: 400 }
      )
    }
    
    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('calendar_sync_logs')
      .insert({
        user_id: user.id,
        calendar_connection_id: connection.id,
        sync_type: 'pull',
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    
    if (logError) {
      logger.error('Failed to create sync log', {
        error: logError instanceof Error ? logError.message : String(logError),
        errorStack: logError instanceof Error ? logError.stack : undefined,
      })
    }
    
    try {
      // Perform sync
      const syncResult = await pullCalendarEvents(
        user.id,
        connection.id,
        calendarIds,
        connection.sync_token || undefined
      )
      
      // Update sync log
      if (syncLog) {
        await supabase
          .from('calendar_sync_logs')
          .update({
            status: 'completed',
            events_pulled: syncResult.events_pulled,
            conflicts_detected: syncResult.conflicts_detected,
            plans_affected: syncResult.plans_affected,
            changes_summary: {
              busy_slots_count: syncResult.busy_slots.length,
              errors: syncResult.errors,
            },
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }
      
      return NextResponse.json({
        success: true,
        events_pulled: syncResult.events_pulled,
        conflicts_detected: syncResult.conflicts_detected,
        plans_affected: syncResult.plans_affected,
        busy_slots_count: syncResult.busy_slots.length,
      })
    } catch (syncError) {
      // Update sync log with error
      if (syncLog) {
        await supabase
          .from('calendar_sync_logs')
          .update({
            status: 'failed',
            error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }
      
      logger.error('Sync failed', {
        error: syncError instanceof Error ? syncError.message : String(syncError),
        errorStack: syncError instanceof Error ? syncError.stack : undefined,
        connectionId: connection.id,
      })
      throw syncError
    }
  } catch (error) {
    logger.error('Failed to sync calendar', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync calendar' },
      { status: 500 }
    )
  }
}


