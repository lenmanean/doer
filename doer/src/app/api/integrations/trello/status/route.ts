import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Trello connection status
 * GET /api/integrations/trello/status
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

    // Get user's Trello connection
    const { data: connection, error: connectionError } = await supabase
      .from('task_management_connections')
      .select('id, provider, default_project_id, auto_push_enabled, auto_completion_sync, last_sync_at, created_at')
      .eq('user_id', user.id)
      .eq('provider', 'trello')
      .maybeSingle()

    if (connectionError && connectionError.code !== 'PGRST116') {
      logger.error('Error fetching Trello connection', {
        error: connectionError instanceof Error ? connectionError.message : String(connectionError),
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Failed to get connection status' },
        { status: 500 }
      )
    }

    if (!connection) {
      return NextResponse.json({
        connected: false,
      })
    }

    // Get recent sync logs
    const { data: syncLogs } = await supabase
      .from('task_management_sync_logs')
      .select('id, sync_type, status, tasks_pushed, tasks_updated, tasks_completed, created_at')
      .eq('user_id', user.id)
      .eq('connection_id', connection.id)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      connected: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        default_project_id: connection.default_project_id,
        auto_push_enabled: connection.auto_push_enabled,
        auto_completion_sync: connection.auto_completion_sync,
        last_sync_at: connection.last_sync_at,
        created_at: connection.created_at,
      },
      recent_syncs: syncLogs || [],
    })
  } catch (error) {
    logger.error('Unexpected error in Trello status route', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to get connection status' },
      { status: 500 }
    )
  }
}

