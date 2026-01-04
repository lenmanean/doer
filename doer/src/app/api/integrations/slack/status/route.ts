import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Slack connection status
 * GET /api/integrations/slack/status
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

    // Get user's Slack connection (most recent if multiple)
    const { data: connection, error: connectionError } = await supabase
      .from('slack_connections')
      .select('id, team_id, team_name, default_channel_id, notification_preferences, installed_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (connectionError && connectionError.code !== 'PGRST116') {
      logger.error('Error fetching Slack connection', {
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

    return NextResponse.json({
      connected: true,
      team_name: connection.team_name,
      team_id: connection.team_id,
      default_channel_id: connection.default_channel_id,
      notification_preferences: connection.notification_preferences,
      installed_at: connection.installed_at,
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

