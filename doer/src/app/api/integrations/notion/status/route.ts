import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Notion connection status
 * GET /api/integrations/notion/status
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

    // Fetch user's Notion connections
    const { data: connections, error: connectionsError } = await supabase
      .from('notion_connections')
      .select('id, workspace_id, workspace_name, selected_page_ids, selected_database_ids, default_page_id, auto_context_enabled, auto_export_enabled, installed_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (connectionsError) {
      logger.error('Failed to fetch Notion connections', connectionsError as Error)
      return NextResponse.json(
        { error: 'Failed to fetch connection status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      connected: connections && connections.length > 0,
      connections: connections || [],
      connection: connections && connections.length > 0 ? connections[0] : null,
    })
  } catch (error) {
    logger.error('Failed to get Notion status', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Update Notion connection settings
 * PATCH /api/integrations/notion/status
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { connection_id, ...updates } = body

    if (!connection_id) {
      return NextResponse.json(
        { error: 'connection_id is required' },
        { status: 400 }
      )
    }

    // Verify connection belongs to user
    const { data: connection, error: connectionError } = await supabase
      .from('notion_connections')
      .select('id')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Update connection
    const { error: updateError } = await supabase
      .from('notion_connections')
      .update(updates)
      .eq('id', connection_id)

    if (updateError) {
      logger.error('Failed to update Notion connection', updateError as Error)
      return NextResponse.json(
        { error: 'Failed to update connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    logger.error('Failed to update Notion settings', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

