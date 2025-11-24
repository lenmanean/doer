import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Get connection status for all calendar providers
 * GET /api/integrations/status
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

    // Fetch all calendar connections for the user
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('id, provider, selected_calendar_ids, auto_sync_enabled, auto_push_enabled, last_sync_at, created_at')
      .eq('user_id', user.id)

    if (connectionsError) {
      logger.error('Error fetching calendar connections', connectionsError as Error, { userId: user.id })
      return NextResponse.json(
        { error: 'Failed to get connection status', details: connectionsError.message },
        { status: 500 }
      )
    }

    // Create a map of provider -> connection for quick lookup
    const connectionsMap = new Map(
      (connections || []).map(conn => [conn.provider, conn])
    )

    // Return status for all supported providers
    const providers = ['google', 'outlook', 'apple'] as const
    
    const providerStatuses = providers.map(provider => {
      const connection = connectionsMap.get(provider)
      return {
        provider,
        connected: !!connection,
        connection: connection ? {
          id: connection.id,
          selected_calendar_ids: connection.selected_calendar_ids,
          auto_sync_enabled: connection.auto_sync_enabled,
          auto_push_enabled: connection.auto_push_enabled,
          last_sync_at: connection.last_sync_at,
          created_at: connection.created_at,
        } : null,
      }
    })

    return NextResponse.json({
      providers: providerStatuses,
    })
  } catch (error) {
    logger.error('Unexpected error in integrations status route', error as Error, { path: request.url })
    return NextResponse.json(
      { 
        error: 'Failed to get connection status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

