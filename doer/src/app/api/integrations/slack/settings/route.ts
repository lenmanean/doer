import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Slack connection settings
 * GET /api/integrations/slack/settings?team_id=xxx (optional)
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
    let connectionQuery = supabase
      .from('slack_connections')
      .select('id, team_id, default_channel_id, notification_preferences')
      .eq('user_id', user.id)

    if (teamId) {
      connectionQuery = connectionQuery.eq('team_id', teamId)
    } else {
      // Otherwise get most recent
      connectionQuery = connectionQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: connection, error: connectionError } = await connectionQuery.single()

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
      logger.warn('Failed to fetch Slack channels', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: connection.id,
      })
      // Continue without channels if fetch fails
    }

    return NextResponse.json({
      default_channel_id: connection.default_channel_id,
      notification_preferences: connection.notification_preferences,
      channels,
    })
  } catch (error) {
    logger.error('Failed to get Slack settings', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    )
  }
}

/**
 * Update Slack connection settings
 * POST /api/integrations/slack/settings?team_id=xxx (optional)
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

    const body = await request.json()
    const { default_channel_id, notification_preferences, team_id } = body

    // Get optional team_id from body or query params
    const searchParams = request.nextUrl.searchParams
    const teamId = team_id || searchParams.get('team_id')

    // If team_id is provided, get specific workspace
    let connectionQuery = supabase
      .from('slack_connections')
      .select('id')
      .eq('user_id', user.id)

    if (teamId) {
      connectionQuery = connectionQuery.eq('team_id', teamId)
    } else {
      // Otherwise get most recent
      connectionQuery = connectionQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: connection, error: connectionError } = await connectionQuery.single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Slack connection found' },
        { status: 404 }
      )
    }

    // Build update object
    const updates: any = {}
    if (default_channel_id !== undefined) {
      updates.default_channel_id = default_channel_id
    }
    if (notification_preferences !== undefined) {
      // Validate notification preferences structure
      if (typeof notification_preferences === 'object' && notification_preferences !== null) {
        updates.notification_preferences = notification_preferences
      } else {
        return NextResponse.json(
          { error: 'Invalid notification_preferences format' },
          { status: 400 }
        )
      }
    }

    // Update connection
    const { error: updateError } = await supabase
      .from('slack_connections')
      .update(updates)
      .eq('id', connection.id)

    if (updateError) {
      logger.error('Failed to update Slack settings', updateError as Error)
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    logger.error('Failed to update Slack settings', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
