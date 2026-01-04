import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Disconnect Slack integration
 * DELETE /api/integrations/slack/disconnect
 * POST /api/integrations/slack/disconnect (for backwards compatibility)
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

    // Delete connection
    const { error: deleteError } = await supabase
      .from('slack_connections')
      .delete()
      .eq('id', connection.id)

    if (deleteError) {
      logger.error('Failed to disconnect Slack', deleteError as Error)
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Slack disconnected successfully',
    })
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

