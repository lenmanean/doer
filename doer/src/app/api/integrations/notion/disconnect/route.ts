import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Disconnect Notion integration
 * POST /api/integrations/notion/disconnect
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

    // Parse request body for optional connection_id
    let connectionId: string | undefined
    try {
      const body = await request.json().catch(() => ({}))
      connectionId = body.connection_id
    } catch {
      // No body provided, will delete all connections
    }

    // Delete notion_connections (cascade will delete notion_page_links)
    let deleteQuery = supabase
      .from('notion_connections')
      .delete()
      .eq('user_id', user.id)

    if (connectionId) {
      deleteQuery = deleteQuery.eq('id', connectionId)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      logger.error('Failed to disconnect Notion', deleteError as Error)
      return NextResponse.json(
        { error: 'Failed to disconnect Notion integration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    logger.error('Failed to disconnect Notion', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

