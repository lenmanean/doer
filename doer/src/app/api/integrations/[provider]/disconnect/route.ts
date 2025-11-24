import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateProvider } from '@/lib/calendar/providers/provider-factory'
import { logger } from '@/lib/logger'
import { logConnectionEvent, getClientIp, getUserAgent } from '@/lib/calendar/connection-events'

/**
 * Disconnect calendar provider integration
 * DELETE /api/integrations/[provider]/disconnect
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate provider
    let provider: 'google' | 'outlook' | 'apple'
    try {
      provider = validateProvider(params.provider)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid provider' },
        { status: 400 }
      )
    }

    // Get user's calendar connection
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id, provider')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: `No ${provider} Calendar connection found` },
        { status: 404 }
      )
    }

    const connectionId = connection.id
    const connectionProvider = connection.provider as string

    // Log disconnection event BEFORE deleting (so we can reference the connection_id)
    await logConnectionEvent(
      user.id,
      'disconnected',
      {
        connectionId: connectionId,
        details: {
          provider: connectionProvider,
        },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      }
    )

    // Delete connection (cascade will delete related events and links)
    const { error: deleteError } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('id', connectionId)

    if (deleteError) {
      logger.error('Failed to disconnect calendar', deleteError as Error)
      return NextResponse.json(
        { error: 'Failed to disconnect calendar' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${provider} Calendar disconnected successfully`,
    })
  } catch (error) {
    logger.error(`Failed to disconnect ${params.provider} calendar`, error as Error)
    return NextResponse.json(
      { error: 'Failed to disconnect calendar' },
      { status: 500 }
    )
  }
}

