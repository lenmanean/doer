import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Slack connection status
 * GET /api/integrations/slack/status?team_id=xxx (optional)
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

    // Get optional team_id from query params
    const searchParams = request.nextUrl.searchParams
    const teamId = searchParams.get('team_id')

    // If team_id is provided, get specific workspace
    if (teamId) {
      let connectionQuery = supabase
        .from('slack_connections')
        .select('id, team_id, team_name, default_channel_id, notification_preferences, installed_at, created_at')
        .eq('user_id', user.id)
        .eq('team_id', teamId)

      const { data: connection, error: connectionError } = await connectionQuery.maybeSingle()

      if (connectionError && connectionError.code !== 'PGRST116') {
        logger.error('Error fetching Slack connection by team_id', {
          error: connectionError instanceof Error ? connectionError.message : String(connectionError),
          userId: user.id,
          teamId,
        })
        return NextResponse.json(
          { error: 'Failed to get connection status' },
          { status: 500 }
        )
      }

      if (!connection) {
        return NextResponse.json({
          connected: false,
          error: 'Workspace not found',
        })
      }

      return NextResponse.json({
        connected: true,
        connection: {
          id: connection.id,
          team_id: connection.team_id,
          team_name: connection.team_name,
          default_channel_id: connection.default_channel_id,
          notification_preferences: connection.notification_preferences,
          installed_at: connection.installed_at,
          created_at: connection.created_at,
        },
        team_name: connection.team_name,
        team_id: connection.team_id,
      })
    }

    // Get all workspaces for user
    const { data: connections, error: connectionsError } = await supabase
      .from('slack_connections')
      .select('id, team_id, team_name, default_channel_id, notification_preferences, installed_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (connectionsError) {
      logger.error('Error fetching Slack connections', {
        error: connectionsError instanceof Error ? connectionsError.message : String(connectionsError),
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Failed to get connection status' },
        { status: 500 }
      )
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        connected: false,
        workspaces: [],
      })
    }

    // Return all workspaces, with the most recent as current
    const workspaces = connections.map(conn => ({
      id: conn.id,
      team_id: conn.team_id,
      team_name: conn.team_name,
      default_channel_id: conn.default_channel_id,
      notification_preferences: conn.notification_preferences,
      installed_at: conn.installed_at,
      created_at: conn.created_at,
    }))

    return NextResponse.json({
      connected: true,
      workspaces,
      current_workspace: workspaces[0], // Most recent workspace
      team_name: workspaces[0].team_name, // Backward compatibility
      team_id: workspaces[0].team_id, // Backward compatibility
    })
  } catch (error) {
    logger.error('Unexpected error in Slack status route', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to get connection status' },
      { status: 500 }
    )
  }
}
