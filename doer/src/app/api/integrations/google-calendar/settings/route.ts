import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Update Google Calendar connection settings
 * PATCH /api/integrations/google-calendar/settings
 * Body: { selected_calendar_ids?: string[], auto_sync_enabled?: boolean }
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
    
    // Get user's calendar connection
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()
    
    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Google Calendar connection found' },
        { status: 404 }
      )
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    
    if (body.selected_calendar_ids !== undefined) {
      if (Array.isArray(body.selected_calendar_ids)) {
        updates.selected_calendar_ids = body.selected_calendar_ids
      } else {
        return NextResponse.json(
          { error: 'selected_calendar_ids must be an array' },
          { status: 400 }
        )
      }
    }
    
    if (body.auto_sync_enabled !== undefined) {
      updates.auto_sync_enabled = Boolean(body.auto_sync_enabled)
    }
    
    // Update connection
    const { data: updatedConnection, error: updateError } = await supabase
      .from('calendar_connections')
      .update(updates)
      .eq('id', connection.id)
      .select()
      .single()
    
    if (updateError || !updatedConnection) {
      logger.error('Failed to update calendar settings', updateError as Error)
      return NextResponse.json(
        { error: 'Failed to update calendar settings' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      connection: updatedConnection,
    })
  } catch (error) {
    logger.error('Failed to update calendar settings', error as Error)
    return NextResponse.json(
      { error: 'Failed to update calendar settings' },
      { status: 500 }
    )
  }
}


