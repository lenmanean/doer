import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Asana connection settings
 * GET /api/integrations/asana/settings
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

    // Get user's Asana connection
    const { data: connection, error: connectionError } = await supabase
      .from('task_management_connections')
      .select('id, default_project_id, auto_push_enabled, auto_completion_sync')
      .eq('user_id', user.id)
      .eq('provider', 'asana')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Asana connection found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      default_project_id: connection.default_project_id,
      auto_push_enabled: connection.auto_push_enabled,
      auto_completion_sync: connection.auto_completion_sync,
    })
  } catch (error) {
    logger.error('Failed to get Asana settings', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    )
  }
}

/**
 * Update Asana connection settings
 * POST /api/integrations/asana/settings
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
    const { default_project_id, auto_push_enabled, auto_completion_sync } = body

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

    // Build update object
    const updates: any = {}
    if (default_project_id !== undefined) {
      updates.default_project_id = default_project_id
    }
    if (auto_push_enabled !== undefined) {
      updates.auto_push_enabled = auto_push_enabled
    }
    if (auto_completion_sync !== undefined) {
      updates.auto_completion_sync = auto_completion_sync
    }

    // Update connection
    const { error: updateError } = await supabase
      .from('task_management_connections')
      .update(updates)
      .eq('id', connection.id)

    if (updateError) {
      logger.error('Failed to update Asana settings', updateError as Error)
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
    logger.error('Failed to update Asana settings', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

