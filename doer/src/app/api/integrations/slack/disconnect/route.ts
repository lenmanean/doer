import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Disconnect Slack integration
 * DELETE /api/integrations/slack/disconnect?team_id=xxx (optional)
 * POST /api/integrations/slack/disconnect (body: { team_id?: string })
 */
async function disconnectSlack(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get optional team_id from query params or body
    const searchParams = request.nextUrl.searchParams
    let teamId = searchParams.get('team_id')

    // Try to get team_id from body if not in query params (for POST requests)
    if (!teamId) {
      try {
        const body = await request.json().catch(() => ({}))
        teamId = body.team_id || null
      } catch {
        // Body might not be JSON for DELETE, that's okay
      }
    }

    // If team_id is provided, disconnect specific workspace
    if (teamId) {
      const { data: connection, error: connectionError } = await supabase
        .from('slack_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('team_id', teamId)
        .single()

      if (connectionError || !connection) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        )
      }

      // Delete specific workspace connection
      const { error: deleteError } = await supabase
        .from('slack_connections')
        .delete()
        .eq('id', connection.id)

      if (deleteError) {
        logger.error('Failed to delete Slack workspace connection', deleteError as Error)
        return NextResponse.json(
          { error: 'Failed to disconnect workspace' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Workspace disconnected successfully',
      })
    } else {
      // No team_id provided, disconnect all workspaces (backward compatibility)
      const { data: connections, error: connectionsError } = await supabase
        .from('slack_connections')
        .select('id')
        .eq('user_id', user.id)

      if (connectionsError) {
        logger.error('Error fetching Slack connections for disconnect', connectionsError as Error)
        return NextResponse.json(
          { error: 'Failed to get connections' },
          { status: 500 }
        )
      }

      if (!connections || connections.length === 0) {
        return NextResponse.json(
          { error: 'No Slack connection found' },
          { status: 404 }
        )
      }

      // Delete all connections
      const { error: deleteError } = await supabase
        .from('slack_connections')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        logger.error('Failed to delete Slack connections', deleteError as Error)
        return NextResponse.json(
          { error: 'Failed to disconnect' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'All workspaces disconnected successfully',
      })
    }
  } catch (error) {
    logger.error('Unexpected error disconnecting Slack', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  return disconnectSlack(request)
}

export async function POST(request: NextRequest) {
  return disconnectSlack(request)
}
