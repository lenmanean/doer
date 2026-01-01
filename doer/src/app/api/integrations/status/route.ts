import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Integration definitions (server-side safe, no client-side imports)
 */
interface IntegrationDefinition {
  key: string
  name: string
}

const integrations: IntegrationDefinition[] = [
  { key: 'appleCalendar', name: 'Apple Calendar' },
  { key: 'outlook', name: 'Outlook' },
  { key: 'googleCalendar', name: 'Google Calendar' },
  { key: 'todoist', name: 'Todoist' },
  { key: 'asana', name: 'Asana' },
  { key: 'trello', name: 'Trello' },
  { key: 'notion', name: 'Notion' },
  { key: 'evernote', name: 'Evernote' },
  { key: 'slack', name: 'Slack' },
  { key: 'microsoftTeams', name: 'Microsoft Teams' },
  { key: 'strava', name: 'Strava' },
  { key: 'appleHealth', name: 'Apple Health' },
  { key: 'coursera', name: 'Coursera' },
  { key: 'udemy', name: 'Udemy' },
]

/**
 * Convert integration key to URL-friendly identifier
 */
function integrationKeyToUrl(key: string): string {
  // Map calendar integrations to existing URLs
  if (key === 'googleCalendar') return 'google'
  if (key === 'appleCalendar') return 'apple'
  if (key === 'outlook') return 'outlook'
  
  // Convert camelCase to kebab-case for other integrations
  return key.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/**
 * Get connection status for all integrations
 * GET /api/integrations/status
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

    // Fetch all calendar connections for the user (only calendar integrations use this table)
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('id, provider, selected_calendar_ids, auto_sync_enabled, auto_push_enabled, last_sync_at, created_at')
      .eq('user_id', user.id)

    if (connectionsError) {
      logger.error('Error fetching calendar connections', {
        error: connectionsError instanceof Error ? connectionsError.message : String(connectionsError),
        errorStack: connectionsError instanceof Error ? connectionsError.stack : undefined,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Failed to get connection status', details: connectionsError.message },
        { status: 500 }
      )
    }

    // Create a map of provider URL identifier -> connection for quick lookup
    const connectionsMap = new Map(
      (connections || []).map(conn => [conn.provider, conn])
    )

    // Return status for all integrations
    const providerStatuses = integrations.map(integration => {
      const providerUrl = integrationKeyToUrl(integration.key)
      const connection = connectionsMap.get(providerUrl)
      
      // Only calendar integrations have connections in the calendar_connections table
      const isCalendarIntegration = ['googleCalendar', 'outlook', 'appleCalendar'].includes(integration.key)
      
      return {
        provider: providerUrl,
        connected: !!connection && isCalendarIntegration,
        connection: connection && isCalendarIntegration ? {
          id: connection.id,
          selected_calendar_ids: connection.selected_calendar_ids,
          auto_sync_enabled: connection.auto_sync_enabled,
          auto_push_enabled: connection.auto_push_enabled,
          last_sync_at: connection.last_sync_at,
          created_at: connection.created_at,
        } : null,
      }
    })

    return NextResponse.json({
      providers: providerStatuses,
    })
  } catch (error) {
    logger.error('Unexpected error in integrations status route', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      path: request.url,
    })
    return NextResponse.json(
      { 
        error: 'Failed to get connection status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

