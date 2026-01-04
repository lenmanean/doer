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
  { key: 'slack', name: 'Slack' },
  { key: 'strava', name: 'Strava' },
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

    // Fetch all calendar connections for the user
    const { data: calendarConnections, error: calendarConnectionsError } = await supabase
      .from('calendar_connections')
      .select('id, provider, selected_calendar_ids, auto_sync_enabled, auto_push_enabled, last_sync_at, created_at')
      .eq('user_id', user.id)

    if (calendarConnectionsError) {
      logger.error('Error fetching calendar connections', {
        error: calendarConnectionsError instanceof Error ? calendarConnectionsError.message : String(calendarConnectionsError),
        errorStack: calendarConnectionsError instanceof Error ? calendarConnectionsError.stack : undefined,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Failed to get connection status', details: calendarConnectionsError.message },
        { status: 500 }
      )
    }

    // Fetch all task management connections for the user
    const { data: taskManagementConnections, error: taskManagementConnectionsError } = await supabase
      .from('task_management_connections')
      .select('id, provider, default_project_id, auto_push_enabled, auto_completion_sync, last_sync_at, created_at')
      .eq('user_id', user.id)

    if (taskManagementConnectionsError) {
      logger.error('Error fetching task management connections', {
        error: taskManagementConnectionsError instanceof Error ? taskManagementConnectionsError.message : String(taskManagementConnectionsError),
        errorStack: taskManagementConnectionsError instanceof Error ? taskManagementConnectionsError.stack : undefined,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Failed to get connection status', details: taskManagementConnectionsError.message },
        { status: 500 }
      )
    }

    // Create maps of provider URL identifier -> connection for quick lookup
    const calendarConnectionsMap = new Map(
      (calendarConnections || []).map(conn => [conn.provider, conn])
    )
    
    const taskManagementConnectionsMap = new Map(
      (taskManagementConnections || []).map(conn => [conn.provider, conn])
    )

    // Return status for all integrations
    const providerStatuses = integrations.map(integration => {
      const providerUrl = integrationKeyToUrl(integration.key)
      const isCalendarIntegration = ['googleCalendar', 'outlook', 'appleCalendar'].includes(integration.key)
      const isTaskManagementIntegration = ['todoist', 'asana', 'trello'].includes(integration.key)
      
      if (isCalendarIntegration) {
        const connection = calendarConnectionsMap.get(providerUrl)
        return {
          provider: providerUrl,
          connected: !!connection,
          connection: connection ? {
            id: connection.id,
            selected_calendar_ids: connection.selected_calendar_ids,
            auto_sync_enabled: connection.auto_sync_enabled,
            auto_push_enabled: connection.auto_push_enabled,
            last_sync_at: connection.last_sync_at,
            created_at: connection.created_at,
          } : null,
        }
      } else if (isTaskManagementIntegration) {
        // For task management, providerUrl matches the database provider value (e.g., 'todoist')
        const connection = taskManagementConnectionsMap.get(providerUrl)
        return {
          provider: providerUrl,
          connected: !!connection,
          connection: connection ? {
            id: connection.id,
            default_project_id: connection.default_project_id,
            auto_push_enabled: connection.auto_push_enabled,
            auto_completion_sync: connection.auto_completion_sync,
            last_sync_at: connection.last_sync_at,
            created_at: connection.created_at,
          } : null,
        }
      }
      
      // Not a calendar or task management integration
      return {
        provider: providerUrl,
        connected: false,
        connection: null,
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

