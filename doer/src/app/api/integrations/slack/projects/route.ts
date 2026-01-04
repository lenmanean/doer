import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Slack channels (for UI compatibility, called "projects")
 * GET /api/integrations/slack/projects
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
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Slack connection found' },
        { status: 404 }
      )
    }

    // Get channels list
    const provider = getProvider('slack')
    let channels: any[] = []
    try {
      channels = await provider.getChannels(connection.id)
    } catch (error) {
      logger.error('Failed to fetch Slack channels', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: connection.id,
      })
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: 500 }
      )
    }

    // Transform channels to match the "projects" format expected by frontend
    const projects = channels
      .filter(channel => !channel.is_im) // Filter out direct messages
      .map(channel => ({
        id: channel.id,
        name: channel.name || channel.id,
        is_private: channel.is_private || false,
      }))

    return NextResponse.json({
      projects,
    })
  } catch (error) {
    logger.error('Failed to get Slack channels', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to get channels' },
      { status: 500 }
    )
  }
}

