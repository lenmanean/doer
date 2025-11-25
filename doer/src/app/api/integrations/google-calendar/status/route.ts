import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Google Calendar connection status
 * GET /api/integrations/google-calendar/status
 */
export async function GET(request: NextRequest) {
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
      .select('id, provider, selected_calendar_ids, auto_sync_enabled, auto_push_enabled, last_sync_at, created_at')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle() // Use maybeSingle() instead of single() to handle no rows gracefully
    
    // If no connection found or error (and it's not a "no rows" error), return not connected
    if (connectionError) {
      console.error('Error fetching calendar connection:', connectionError)
      // Check if it's a "no rows" error (PGRST116) or a real error
      if (connectionError.code !== 'PGRST116') {
        // Real error, log it
        return NextResponse.json(
          { error: 'Failed to get connection status', details: connectionError.message },
          { status: 500 }
        )
      }
    }
    
    if (!connection) {
      return NextResponse.json({
        connected: false,
      })
    }
    
    // Get recent sync logs
    const { data: syncLogs } = await supabase
      .from('calendar_sync_logs')
      .select('id, sync_type, status, events_pulled, events_pushed, conflicts_detected, created_at')
      .eq('user_id', user.id)
      .eq('calendar_connection_id', connection.id)
      .order('created_at', { ascending: false })
      .limit(5)
    
    // Get recent connection events
    const { data: connectionEvents } = await supabase
      .from('calendar_connection_events')
      .select('id, event_type, event_details, created_at')
      .eq('user_id', user.id)
      .eq('calendar_connection_id', connection.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    return NextResponse.json({
      connected: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        selected_calendar_ids: connection.selected_calendar_ids,
        auto_sync_enabled: connection.auto_sync_enabled,
        auto_push_enabled: connection.auto_push_enabled,
        last_sync_at: connection.last_sync_at,
        created_at: connection.created_at,
      },
      recent_syncs: syncLogs || [],
      recent_connection_events: connectionEvents || [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get connection status' },
      { status: 500 }
    )
  }
}


