import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { getProvider } from '@/lib/calendar/providers/provider-factory'
import { logger } from '@/lib/logger'
import { formatDateForDB } from '@/lib/date-utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Cron job endpoint for auto-pulling calendar events
 * Runs every hour via Vercel Cron
 * 
 * Security: Verifies cron secret from Vercel
 * Uses service role client to bypass RLS for cron operations
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron request', { hasAuthHeader: !!authHeader })
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Use service role client for cron job - bypasses RLS
    const supabase = getServiceRoleClient()
    
    // Fetch all connections with auto-sync enabled
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('id, user_id, provider, selected_calendar_ids, sync_token, auto_sync_enabled')
      .eq('auto_sync_enabled', true)
    
    if (connectionsError) {
      logger.error('Failed to fetch calendar connections for auto-sync', connectionsError as Error)
      return NextResponse.json(
        { error: 'Failed to fetch connections' },
        { status: 500 }
      )
    }
    
    if (!connections || connections.length === 0) {
      logger.info('No calendar connections with auto-sync enabled')
      return NextResponse.json({
        success: true,
        message: 'No connections to sync',
        synced: 0,
      })
    }
    
    const results = {
      total: connections.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    }
    
    // Process each connection
    for (const connection of connections) {
      if (!connection.selected_calendar_ids || connection.selected_calendar_ids.length === 0) {
        logger.debug('Skipping connection without selected calendars', { connectionId: connection.id })
        continue
      }
      
      try {
        // Get provider instance
        const calendarProvider = getProvider(connection.provider as 'google' | 'outlook' | 'apple')
        
        // Fetch events using incremental sync token if available
        const fetchResult = await calendarProvider.fetchEvents(
          connection.id,
          connection.selected_calendar_ids,
          connection.sync_token || undefined
        )
        
        // Process events and store in database
        const busySlots: any[] = []
        const plansAffected = new Set<string>()
        let conflictsDetected = 0
        let eventsProcessed = 0
        
        // Store events in database and convert to busy slots
        for (const event of fetchResult.events) {
          // Skip all-day events that don't have dateTime
          if (!event.start?.dateTime && !event.start?.date) {
            continue
          }
          
          // Find which calendar this event belongs to
          const calendarId = connection.selected_calendar_ids[0] || 'primary'
          
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
            user_id: connection.user_id,
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
            logger.error('Failed to upsert calendar event', { 
              error: upsertError instanceof Error ? upsertError.message : String(upsertError),
              errorStack: upsertError instanceof Error ? upsertError.stack : undefined,
              event_id: event.id 
            })
            continue
          }
          
          eventsProcessed++
          
          // Check for conflicts with existing plans
          if (isBusy && !isDoerCreated) {
            const { data: conflicts } = await supabase.rpc('check_calendar_conflicts_for_plan', {
              p_user_id: connection.user_id,
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
        
        // Update sync token
        if (fetchResult.nextSyncToken) {
          const { error: tokenError } = await supabase
            .from('calendar_connections')
            .update({
              sync_token: fetchResult.nextSyncToken,
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
        
        // Create sync log entry
        await supabase
          .from('calendar_sync_logs')
          .insert({
            user_id: connection.user_id,
            calendar_connection_id: connection.id,
            sync_type: 'pull',
            status: 'completed',
            events_pulled: eventsProcessed,
            conflicts_detected: conflictsDetected,
            plans_affected: Array.from(plansAffected),
            changes_summary: {
              busy_slots_count: busySlots.length,
              total_events: fetchResult.events.length,
              is_incremental: !!connection.sync_token,
            },
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
        
        results.successful++
        logger.info(`Auto-sync completed for connection ${connection.id}`, {
          connectionId: connection.id,
          provider: connection.provider,
          eventsProcessed,
          conflictsDetected,
        })
      } catch (error) {
        results.failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`${connection.provider} (${connection.id}): ${errorMessage}`)
        
        // Log error for this connection
        try {
          await supabase
            .from('calendar_sync_logs')
            .insert({
              user_id: connection.user_id,
              calendar_connection_id: connection.id,
              sync_type: 'pull',
              status: 'failed',
              error_message: errorMessage,
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            })
        } catch (logError) {
          logger.error('Failed to log sync error', logError as Error)
        }
        
        logger.error(`Auto-sync failed for connection ${connection.id}`, error as Error, {
          connectionId: connection.id,
          provider: connection.provider,
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      synced: results.successful,
      failed: results.failed,
      total: results.total,
      errors: results.errors,
    })
  } catch (error) {
    logger.error('Auto-sync cron job failed', error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-sync failed' },
      { status: 500 }
    )
  }
}

