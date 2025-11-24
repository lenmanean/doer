import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateProvider } from '@/lib/calendar/providers/provider-factory'
import { logger } from '@/lib/logger'

/**
 * Get calendar provider connection status
 * GET /api/integrations/[provider]/status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> | { provider: string } }
) {
  try {
    // Handle both sync and async params (Next.js 14/15 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params
    
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate provider (just the string, not the config - status check doesn't need provider instance)
    if (!resolvedParams?.provider) {
      logger.error('Missing provider parameter in status route', new Error('Provider param missing'), { 
        params: resolvedParams,
        url: request.url 
      })
      return NextResponse.json(
        { error: 'Invalid provider parameter' },
        { status: 400 }
      )
    }

    let provider: 'google' | 'outlook' | 'apple'
    try {
      provider = validateProvider(resolvedParams.provider)
    } catch (error) {
      logger.error('Invalid provider in status route', error as Error, { provider: resolvedParams.provider })
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid provider' },
        { status: 400 }
      )
    }

    // Get user's calendar connection
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id, provider, selected_calendar_ids, auto_sync_enabled, auto_push_enabled, last_sync_at, created_at')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .maybeSingle() // Use maybeSingle() instead of single() to handle no rows gracefully

    // If no connection found or error (and it's not a "no rows" error), return not connected
    if (connectionError) {
      logger.error('Error fetching calendar connection', connectionError as Error, { 
        userId: user.id, 
        provider,
        errorCode: connectionError.code 
      })
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
    let providerParam = 'unknown'
    try {
      const resolvedParams = params instanceof Promise ? await params : params
      providerParam = resolvedParams?.provider || 'unknown'
    } catch {
      // Ignore errors resolving params
    }
    logger.error('Unexpected error in status route', error as Error, { 
      provider: providerParam,
      path: request.url,
      errorDetails: error instanceof Error ? error.stack : String(error)
    })
    return NextResponse.json(
      { 
        error: 'Failed to get connection status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

