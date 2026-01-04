import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Disconnect Asana integration
 * DELETE /api/integrations/asana/disconnect
 * POST /api/integrations/asana/disconnect (for backwards compatibility)
 */
async function disconnectAsana(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's Asana connection
    const { data: connection, error: connectionError } = await supabase
      .from('task_management_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'asana')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Asana connection found' },
        { status: 404 }
      )
    }

    // Delete connection (cascades to task_management_links via foreign key constraint)
    const { error: deleteError } = await supabase
      .from('task_management_connections')
      .delete()
      .eq('id', connection.id)

    if (deleteError) {
      logger.error('Failed to disconnect Asana', deleteError as Error)
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Asana disconnected successfully',
    })
  } catch (error) {
    logger.error('Unexpected error disconnecting Asana', {
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
  return disconnectAsana(request)
}

export async function POST(request: NextRequest) {
  return disconnectAsana(request)
}

