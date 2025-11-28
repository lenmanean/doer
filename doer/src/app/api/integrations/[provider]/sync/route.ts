import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider, validateProvider } from '@/lib/calendar/providers/provider-factory'
import { logger } from '@/lib/logger'
import { formatDateForDB } from '@/lib/date-utils'
import { syncEventsToIntegrationPlan } from '@/lib/integrations/calendar-event-sync'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Manual sync endpoint - pull events from calendar provider
 * POST /api/integrations/[provider]/sync
 * Body: { calendar_ids?: string[] } - optional, defaults to selected calendars
 */
export async function POST(
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
      .select('id, selected_calendar_ids, sync_token')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: `No ${provider} Calendar connection found` },
        { status: 404 }
      )
    }

    // Parse request body for optional calendar_ids override
    let calendarIds = connection.selected_calendar_ids || []
    try {
      const body = await request.json().catch(() => ({}))
      if (body.calendar_ids && Array.isArray(body.calendar_ids) && body.calendar_ids.length > 0) {
        // Security: Validate that all requested calendar IDs are in the user's selected calendars
        const validCalendarIds = body.calendar_ids.filter((id: string) => 
          connection.selected_calendar_ids?.includes(id)
        )
        if (validCalendarIds.length > 0) {
          calendarIds = validCalendarIds
        } else {
          // If none are valid, log warning but use default selected calendars
          logger.warn('Invalid calendar_ids provided, using selected calendars', {
            userId: user.id,
            requested: body.calendar_ids,
            available: connection.selected_calendar_ids,
          })
        }
      }
    } catch {
      // Use default selected calendars
    }

    if (calendarIds.length === 0) {
      return NextResponse.json(
        { error: 'No calendars selected for sync. Please select calendars in settings first.' },
        { status: 400 }
      )
    }

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('calendar_sync_logs')
      .insert({
        user_id: user.id,
        calendar_connection_id: connection.id,
        sync_type: 'pull',
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (logError) {
      logger.error('Failed to create sync log', logError as Error)
    }

    try {
      // Get provider instance
      const calendarProvider = getProvider(provider)

      // Process events per calendar to maintain calendar context
      const busySlots: any[] = []
      const plansAffected = new Set<string>()
      let conflictsDetected = 0
      let eventsProcessed = 0
      let nextSyncToken: string | null = null

      // Fetch events from each calendar separately to maintain calendar context
      for (const calendarId of calendarIds) {
        try {
          const fetchResult = await calendarProvider.fetchEvents(
            connection.id,
            [calendarId], // Fetch from one calendar at a time
            connection.sync_token || undefined
          )

          // Store the latest sync token (for providers that use single token)
          if (fetchResult.nextSyncToken) {
            nextSyncToken = fetchResult.nextSyncToken
          }

          // Process events from this calendar
          for (const event of fetchResult.events) {
            // Skip all-day events that don't have dateTime
            if (!event.start?.dateTime && !event.start?.date) {
              continue
            }

            const busySlot = calendarProvider.convertToBusySlot(event, calendarId)
            if (!busySlot) {
              continue
            }

            // Check if DOER created this event
            const isDoerCreated = event.extendedProperties?.private?.['doer.task_id'] !== undefined

            // Determine if event is busy
            const isBusy = event.transparency !== 'transparent'

            // Store or update calendar event
            const startTime = new Date(event.start.dateTime || event.start.date!).toISOString()
            const endTime = new Date(event.end.dateTime || event.end.date!).toISOString()

            const eventData = {
              user_id: user.id,
              calendar_connection_id: connection.id,
              external_event_id: event.id || '',
              calendar_id: calendarId,
              summary: event.summary || null,
              description: event.description || null,
              start_time: startTime,
              end_time: endTime,
              timezone: event.start.timeZone || null,
              is_busy: isBusy,
              is_doer_created: isDoerCreated,
              external_etag: event.etag || null,
              metadata: {
                extended_properties: event.extendedProperties || {},
              },
            }

            // Upsert event
            const { error: upsertError } = await supabase
              .from('calendar_events')
              .upsert(eventData, {
                onConflict: 'calendar_connection_id,external_event_id,calendar_id',
              })

            if (upsertError) {
              logger.error('Failed to upsert calendar event', upsertError as Error, { event_id: event.id })
              continue
            }

            eventsProcessed++

            // Check for conflicts with existing plans
            if (isBusy && !isDoerCreated) {
              const { data: conflicts } = await supabase.rpc('check_calendar_conflicts_for_plan', {
                p_user_id: user.id,
                p_plan_id: null, // Check all plans
                p_start_date: formatDateForDB(new Date(startTime)),
                p_end_date: formatDateForDB(new Date(endTime)),
              })

              if (conflicts && conflicts.length > 0) {
                conflictsDetected += conflicts.length
                conflicts.forEach((conflict: any) => {
                  if (conflict.plans_affected) {
                    conflict.plans_affected.forEach((planId: string) => {
                      plansAffected.add(planId)
                    })
                  }
                })
              }
            }

            if (isBusy) {
              busySlots.push(busySlot)
            }
          }
        } catch (calendarError) {
          // Log error for this calendar but continue with others
          logger.error(`Failed to sync calendar ${calendarId}`, calendarError as Error, {
            connectionId: connection.id,
            calendarId,
          })
          // Continue with next calendar
        }
      }

      // Update sync token and last_sync_at
      if (nextSyncToken) {
        const { error: tokenError } = await supabase
          .from('calendar_connections')
          .update({
            sync_token: nextSyncToken,
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id)

        if (tokenError) {
          logger.error('Failed to update sync token', tokenError as Error, { connectionId: connection.id })
        }
      } else {
        // Update last_sync_at even if no new sync token
        await supabase
          .from('calendar_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id)
      }

      // Sync calendar events to integration plan (convert to tasks)
      let syncResult = null
      try {
        // Fetch calendar names for the sync
        const calendars = await calendarProvider.fetchCalendars(connection.id)
        const calendarNameMap = new Map(calendars.map(cal => [cal.id, cal.summary]))
        const calendarNames = calendarIds.map(id => calendarNameMap.get(id) || id)

        syncResult = await syncEventsToIntegrationPlan(
          connection.id,
          user.id,
          provider,
          calendarIds,
          calendarNames
        )

        logger.info('Synced calendar events to integration plan', {
          connectionId: connection.id,
          provider,
          tasksCreated: syncResult.tasks_created,
          tasksUpdated: syncResult.tasks_updated,
          tasksSkipped: syncResult.tasks_skipped,
        })
      } catch (syncError) {
        logger.error('Failed to sync events to integration plan', syncError as Error, {
          connectionId: connection.id,
          userId: user.id,
          provider,
        })
        // Don't fail the whole sync operation if task sync fails
      }

      // Update sync log
      if (syncLog) {
        await supabase
          .from('calendar_sync_logs')
          .update({
            status: 'completed',
            events_pulled: eventsProcessed,
            conflicts_detected: conflictsDetected,
            plans_affected: Array.from(plansAffected),
            changes_summary: {
              busy_slots_count: busySlots.length,
              total_events: eventsProcessed,
              tasks_created: syncResult?.tasks_created || 0,
              tasks_updated: syncResult?.tasks_updated || 0,
              tasks_skipped: syncResult?.tasks_skipped || 0,
            },
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }

      return NextResponse.json({
        success: true,
        events_pulled: eventsProcessed,
        conflicts_detected: conflictsDetected,
        plans_affected: Array.from(plansAffected),
        busy_slots_count: busySlots.length,
        tasks_created: syncResult?.tasks_created || 0,
        tasks_updated: syncResult?.tasks_updated || 0,
        tasks_skipped: syncResult?.tasks_skipped || 0,
      })
    } catch (syncError) {
      // Update sync log with error
      if (syncLog) {
        await supabase
          .from('calendar_sync_logs')
          .update({
            status: 'failed',
            error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }

      logger.error('Sync failed', syncError as Error, { connectionId: connection.id })
      throw syncError
    }
  } catch (error) {
    logger.error(`Failed to sync ${params.provider} calendar`, error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync calendar' },
      { status: 500 }
    )
  }
}

