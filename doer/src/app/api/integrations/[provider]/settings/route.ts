import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateProvider } from '@/lib/calendar/providers/provider-factory'
import { logger } from '@/lib/logger'
import { logConnectionEvent, getClientIp, getUserAgent } from '@/lib/calendar/connection-events'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Update calendar provider connection settings
 * PATCH /api/integrations/[provider]/settings
 * Body: { selected_calendar_ids?: string[], auto_sync_enabled?: boolean, auto_push_enabled?: boolean }
 */
export async function PATCH(
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

    // Get user's calendar connection (fetch current values to track changes)
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id, provider, selected_calendar_ids, auto_sync_enabled, auto_push_enabled')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: `No ${provider} Calendar connection found` },
        { status: 404 }
      )
    }

    // Store old values for logging
    const oldValues: Record<string, unknown> = {
      selected_calendar_ids: connection.selected_calendar_ids,
      auto_sync_enabled: connection.auto_sync_enabled,
      auto_push_enabled: connection.auto_push_enabled,
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    const changedFields: string[] = []
    const newValues: Record<string, unknown> = {}

    if (body.selected_calendar_ids !== undefined) {
      if (Array.isArray(body.selected_calendar_ids)) {
        // Check if calendars actually changed
        const oldIds = (oldValues.selected_calendar_ids as string[]) || []
        const newIds = body.selected_calendar_ids as string[]
        const oldSet = new Set(oldIds)
        const newSet = new Set(newIds)

        if (oldIds.length !== newIds.length || !oldIds.every(id => newSet.has(id))) {
          updates.selected_calendar_ids = newIds
          changedFields.push('selected_calendar_ids')
          newValues.selected_calendar_ids = newIds

          // Log individual calendar selection changes
          const added = newIds.filter(id => !oldSet.has(id))
          const removed = oldIds.filter(id => !newSet.has(id))

          for (const calendarId of added) {
            await logConnectionEvent(
              user.id,
              'calendar_selected',
              {
                connectionId: connection.id,
                details: {
                  provider: connection.provider,
                  calendar_id: calendarId,
                },
                ipAddress: getClientIp(request),
                userAgent: getUserAgent(request),
              }
            )
          }

          for (const calendarId of removed) {
            await logConnectionEvent(
              user.id,
              'calendar_deselected',
              {
                connectionId: connection.id,
                details: {
                  provider: connection.provider,
                  calendar_id: calendarId,
                },
                ipAddress: getClientIp(request),
                userAgent: getUserAgent(request),
              }
            )
          }
        }
      } else {
        return NextResponse.json(
          { error: 'selected_calendar_ids must be an array' },
          { status: 400 }
        )
      }
    }

    if (body.auto_sync_enabled !== undefined) {
      const newValue = Boolean(body.auto_sync_enabled)
      if (oldValues.auto_sync_enabled !== newValue) {
        updates.auto_sync_enabled = newValue
        changedFields.push('auto_sync_enabled')
        newValues.auto_sync_enabled = newValue
      }
    }

    if (body.auto_push_enabled !== undefined) {
      const newValue = Boolean(body.auto_push_enabled)
      if (oldValues.auto_push_enabled !== newValue) {
        updates.auto_push_enabled = newValue
        changedFields.push('auto_push_enabled')
        newValues.auto_push_enabled = newValue
      }
    }

    // Only update if there are actual changes
    if (changedFields.length === 0) {
      return NextResponse.json({
        success: true,
        connection: connection,
        message: 'No changes detected',
      })
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


    // Log settings change event (for non-calendar selection changes)
    if (changedFields.some(f => f !== 'selected_calendar_ids')) {
      await logConnectionEvent(
        user.id,
        'settings_changed',
        {
          connectionId: connection.id,
          details: {
            provider: connection.provider,
            changed_fields: changedFields.filter(f => f !== 'selected_calendar_ids'),
            old_values: Object.fromEntries(
              changedFields
                .filter(f => f !== 'selected_calendar_ids')
                .map(f => [f, oldValues[f]])
            ),
            new_values: Object.fromEntries(
              changedFields
                .filter(f => f !== 'selected_calendar_ids')
                .map(f => [f, newValues[f]])
            ),
          },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        }
      )
    }

    return NextResponse.json({
      success: true,
      connection: updatedConnection,
    })
  } catch (error) {
    logger.error(`Failed to update ${params.provider} calendar settings`, error as Error)
    return NextResponse.json(
      { error: 'Failed to update calendar settings' },
      { status: 500 }
    )
  }
}

