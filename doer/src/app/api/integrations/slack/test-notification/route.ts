import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { decryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Send test notification to Slack
 * POST /api/integrations/slack/test-notification
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
    const { channel_id } = body

    if (!channel_id) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      )
    }

    // Get user's Slack connection (most recent if multiple)
    const { data: connection, error: connectionError } = await supabase
      .from('slack_connections')
      .select('id, bot_token_encrypted')
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

    // Get provider and send test message
    const provider = getProvider('slack')
    const slackProvider = provider as import('@/lib/notifications/providers/slack-provider').SlackProvider
    
    const botToken = decryptToken(connection.bot_token_encrypted)
    
    // Build simple Block Kit test message
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '✅ *Test Notification*\n\nThis is a test notification from DOER. Your Slack integration is working correctly!',
        },
      },
    ]

    const success = await slackProvider.sendBlockKitMessage(botToken, channel_id, blocks)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send test notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully',
    })
  } catch (error) {
    logger.error('Failed to send test notification', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    )
  }
}

