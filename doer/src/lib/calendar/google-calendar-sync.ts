/**
 * Google Calendar bidirectional sync service
 * Handles OAuth token refresh, incremental sync, busy slot detection, and event creation
 */

import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from './encryption'
import { logger } from '@/lib/logger'
import type {
  CalendarConnection,
  CalendarEvent,
  GoogleCalendarEvent,
  SyncResult,
  PushEventResult,
  BusySlot,
} from './types'
import { formatDateForDB, parseDateFromDB } from '@/lib/date-utils'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

/**
 * Get the redirect URI based on environment
 * Always prioritizes production-ready URLs from environment variables
 * This ensures Google OAuth uses the registered redirect URI even during local development
 */
function getRedirectUri(requestOrigin?: string): string {
  // First priority: explicit redirect URI from environment (always use if set)
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI.trim()
  }
  
  // Second priority: production URL from NEXT_PUBLIC_APP_URL (use production domain)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL.trim()
    // Ensure it doesn't have trailing slash
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
    // Always use production URL, even in development (for OAuth registration)
    return `${baseUrl}/api/integrations/google-calendar/connect`
  }
  
  // Third priority: Use production domain (usedoer.com) if in production or if no env var is set
  // This ensures we always use the registered production redirect URI
  if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
    return 'https://usedoer.com/api/integrations/google-calendar/connect'
  }
  
  // Fourth priority: Vercel production URL (if available)
  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL.trim()
    // Ensure it starts with https://
    const baseUrl = vercelUrl.startsWith('https://') 
      ? vercelUrl 
      : `https://${vercelUrl}`
    return `${baseUrl}/api/integrations/google-calendar/connect`
  }
  
  // Fifth priority: use request origin if provided (fallback only in development)
  if (requestOrigin && process.env.NODE_ENV === 'development') {
    return `${requestOrigin}/api/integrations/google-calendar/connect`
  }
  
  // Last resort: localhost for local development (should be avoided)
  console.warn('⚠️ Using localhost redirect URI. Set GOOGLE_REDIRECT_URI or NEXT_PUBLIC_APP_URL to use production domain.')
  return 'http://localhost:3000/api/integrations/google-calendar/connect'
}

/**
 * Get OAuth2 client for Google Calendar
 */
function getOAuth2Client(redirectUri?: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')
  }
  
  const uri = redirectUri || getRedirectUri()
  
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    uri
  )
}

/**
 * Generate Google OAuth authorization URL
 */
export async function generateAuthUrl(state?: string): Promise<string> {
  const redirectUri = getRedirectUri()
  const oauth2Client = getOAuth2Client(redirectUri)
  
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ]
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent to get refresh token
    state: state || undefined,
  })
  
  return url
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expiry_date: number
}> {
  const redirectUri = getRedirectUri()
  const oauth2Client = getOAuth2Client(redirectUri)
  
  const { tokens } = await oauth2Client.getToken(code)
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain access and refresh tokens')
  }
  
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date || Date.now() + 3600000, // Default 1 hour
  }
}

/**
 * Refresh OAuth access token using refresh token
 */
async function refreshAccessToken(
  connectionId: string,
  refreshTokenEncrypted: string
): Promise<{ access_token: string; expiry_date: number }> {
  const supabase = await createClient()
  
  try {
    const refreshToken = decryptToken(refreshTokenEncrypted)
    // For refresh token flow, redirect URI doesn't matter - use any valid one
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })
    
    const { credentials } = await oauth2Client.refreshAccessToken()
    
    if (!credentials.access_token || !credentials.expiry_date) {
      throw new Error('Failed to refresh access token')
    }
    
    // Update connection with new access token
    const accessTokenEncrypted = encryptToken(credentials.access_token)
    const { error } = await supabase
      .from('calendar_connections')
      .update({
        access_token_encrypted: accessTokenEncrypted,
        token_expires_at: new Date(credentials.expiry_date).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)
    
    if (error) {
      logger.error('Failed to update access token in database', error as Error, { connectionId })
      throw error
    }
    
    return {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    }
  } catch (error) {
    logger.error('Failed to refresh access token', error as Error, { connectionId })
    throw error
  }
}

/**
 * Get authenticated Calendar API client for a connection
 */
async function getCalendarClient(connectionId: string): Promise<calendar_v3.Calendar> {
  const supabase = await createClient()
  
  // Fetch connection
  const { data: connection, error } = await supabase
    .from('calendar_connections')
    .select('id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('id', connectionId)
    .single()
  
  if (error || !connection) {
    throw new Error(`Connection not found: ${connectionId}`)
  }
  
  // Check if token needs refresh
  const expiresAt = new Date(connection.token_expires_at)
  const now = new Date()
  const needsRefresh = expiresAt <= now || expiresAt.getTime() - now.getTime() < 300000 // Refresh if < 5 min left
  
  let accessToken = decryptToken(connection.access_token_encrypted)
  
  if (needsRefresh) {
    logger.info('Refreshing access token', { connectionId })
    const refreshed = await refreshAccessToken(connectionId, connection.refresh_token_encrypted)
    accessToken = refreshed.access_token
  }
  
  // Create authenticated client
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({
    access_token: accessToken,
  })
  
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

/**
 * Fetch available calendars for a user
 */
export async function fetchCalendars(connectionId: string): Promise<Array<{
  id: string
  summary: string
  primary?: boolean
}>> {
  const calendar = await getCalendarClient(connectionId)
  
  const response = await calendar.calendarList.list({
    minAccessRole: 'reader',
  })
  
  if (!response.data.items) {
    return []
  }
  
  return response.data.items.map(cal => ({
    id: cal.id || '',
    summary: cal.summary || 'Untitled Calendar',
    primary: cal.primary || false,
  }))
}

/**
 * Fetch events from Google Calendar using incremental sync
 */
export async function fetchCalendarEvents(
  connectionId: string,
  calendarIds: string[],
  syncToken?: string | null,
  timeMin?: string,
  timeMax?: string
): Promise<{
  events: GoogleCalendarEvent[]
  nextSyncToken: string | null
  isFullSync: boolean
}> {
  const calendar = await getCalendarClient(connectionId)
  const allEvents: GoogleCalendarEvent[] = []
  
  // If no sync token, do a full sync from timeMin
  const isFullSync = !syncToken
  
  // Default time range for full sync:
  // - Start: beginning of today (in UTC) so we include all of today's events
  // - End: 30 days from now
  const now = new Date()
  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))

  const defaultTimeMin = timeMin || startOfTodayUtc.toISOString()
  const defaultTimeMax = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  
  let nextSyncToken: string | null = null
  
  // Fetch from each selected calendar
  for (const calendarId of calendarIds) {
    try {
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
      }
      
      if (syncToken) {
        // Incremental sync
        params.syncToken = syncToken
      } else {
        // Full sync
        params.timeMin = defaultTimeMin
        params.timeMax = defaultTimeMax
        params.showDeleted = true // Include deleted events on full sync
      }
      
      const response = await calendar.events.list(params)
      const items = response.data.items || []
      
      allEvents.push(...(items as GoogleCalendarEvent[]))
      
      // Store the sync token for next sync
      if (response.data.nextSyncToken) {
        nextSyncToken = response.data.nextSyncToken
      }
      
      // Handle pagination
      let pageToken = response.data.nextPageToken
      while (pageToken) {
        const nextResponse = await calendar.events.list({
          ...params,
          pageToken,
        })
        
        const nextItems = nextResponse.data.items || []
        allEvents.push(...(nextItems as GoogleCalendarEvent[]))
        
        pageToken = nextResponse.data.nextPageToken
        if (nextResponse.data.nextSyncToken) {
          nextSyncToken = nextResponse.data.nextSyncToken
        }
      }
    } catch (error) {
      // If sync token is invalid, need full sync
      if (error instanceof Error && error.message.includes('Invalid sync token')) {
        logger.warn('Sync token invalid, need full sync', { connectionId, calendarId })
        // Retry without sync token
        const response = await calendar.events.list({
          calendarId,
          timeMin: defaultTimeMin,
          timeMax: defaultTimeMax,
          singleEvents: true,
          orderBy: 'startTime',
          showDeleted: true,
          maxResults: 2500,
        })
        
        const items = response.data.items || []
        allEvents.push(...(items as GoogleCalendarEvent[]))
        
        if (response.data.nextSyncToken) {
          nextSyncToken = response.data.nextSyncToken
        }
      } else {
        logger.error('Failed to fetch calendar events', error as Error, { connectionId, calendarId })
        throw error
      }
    }
  }
  
  return {
    events: allEvents,
    nextSyncToken,
    isFullSync: isFullSync || !syncToken,
  }
}

/**
 * Convert Google Calendar event to DOER BusySlot format
 */
function convertToBusySlot(event: GoogleCalendarEvent, calendarId: string): BusySlot | null {
  if (!event.start || !event.end) {
    return null
  }
  
  const startDateTime = event.start.dateTime || event.start.date
  const endDateTime = event.end.dateTime || event.end.date
  
  if (!startDateTime || !endDateTime) {
    return null
  }
  
  // Determine if event is busy (opaque = busy, transparent = free)
  const isBusy = event.transparency !== 'transparent'
  
  // Check if DOER created this event
  const isDoerCreated = event.extendedProperties?.private?.['doer.task_id'] !== undefined ||
                        event.extendedProperties?.private?.['doer.plan_id'] !== undefined
  
  return {
    start: new Date(startDateTime).toISOString(),
    end: new Date(endDateTime).toISOString(),
    source: 'calendar_event' as const,
    metadata: {
      event_id: event.id,
      calendar_id: calendarId,
      summary: event.summary,
      is_doer_created: isDoerCreated,
      transparency: event.transparency,
    },
  }
}

/**
 * Pull events from Google Calendar and store as busy slots
 */
export async function pullCalendarEvents(
  userId: string,
  connectionId: string,
  calendarIds: string[],
  syncToken?: string | null
): Promise<SyncResult> {
  const supabase = await createClient()
  
  try {
    // Fetch events from Google
    const { events, nextSyncToken, isFullSync } = await fetchCalendarEvents(
      connectionId,
      calendarIds,
      syncToken
    )
    
    const busySlots: BusySlot[] = []
    const plansAffected = new Set<string>()
    let conflictsDetected = 0
    
    // Process events and store in database
    for (const event of events) {
      // Skip all-day events that don't have dateTime
      if (!event.start?.dateTime && !event.start?.date) {
        continue
      }
      
      // Find which calendar this event belongs to
      // We need to determine this from the event's calendar_id
      // For now, we'll use the first calendarId as a fallback
      const calendarId = calendarIds[0] || 'primary'
      
      const busySlot = convertToBusySlot(event, calendarId)
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
        user_id: userId,
        calendar_connection_id: connectionId,
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
          attendees: event.attendees || [],
        },
      }
      
      // Upsert event (update if exists, insert if new)
      const { error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(eventData, {
          onConflict: 'calendar_connection_id,external_event_id,calendar_id',
        })
      
      if (upsertError) {
        logger.error('Failed to upsert calendar event', upsertError as Error, { event_id: event.id })
        continue
      }
      
      // Check for conflicts with existing plans
      if (isBusy && !isDoerCreated) {
        const { data: conflicts } = await supabase.rpc('check_calendar_conflicts_for_plan', {
          p_user_id: userId,
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
    if (nextSyncToken) {
      const { error: tokenError } = await supabase.rpc('update_calendar_connection_sync_time', {
        p_connection_id: connectionId,
        p_sync_token: nextSyncToken,
      })
      
      if (tokenError) {
        logger.error('Failed to update sync token', tokenError as Error, { connectionId })
      }
    }
    
    return {
      events_pulled: events.length,
      events_pushed: 0,
      conflicts_detected: conflictsDetected,
      plans_affected: Array.from(plansAffected),
      busy_slots: busySlots,
      errors: [],
    }
  } catch (error) {
    logger.error('Failed to pull calendar events', error as Error, { connectionId, userId })
    throw error
  }
}

/**
 * Create or update a Google Calendar event for a DOER task
 */
export async function pushTaskToCalendar(
  connectionId: string,
  calendarId: string,
  taskScheduleId: string,
  taskId: string,
  planId: string | null,
  taskName: string,
  planName: string | null,
  startTime: string,
  endTime: string,
  aiConfidence: number | null,
  timezone?: string
): Promise<PushEventResult> {
  const supabase = await createClient()
  const calendar = await getCalendarClient(connectionId)
  
  try {
    // Fetch task schedule details
    const { data: schedule, error: scheduleError } = await supabase
      .from('task_schedule')
      .select('id, date, start_time, end_time, task_id, plan_id, user_id')
      .eq('id', taskScheduleId)
      .single()
    
    if (scheduleError || !schedule) {
      throw new Error(`Task schedule not found: ${taskScheduleId}`)
    }
    
    // Check if event already exists
    const { data: existingLink } = await supabase
      .from('calendar_event_links')
      .select('external_event_id, calendar_events(id, external_event_id)')
      .eq('task_schedule_id', taskScheduleId)
      .single()
    
    const eventStart = new Date(startTime)
    const eventEnd = new Date(endTime)
    
    // Create event object
    const event: calendar_v3.Schema$Event = {
      summary: taskName,
      description: planName ? `DOER: ${planName}\nTask: ${taskName}` : `DOER Task: ${taskName}`,
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: timezone || 'UTC',
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: timezone || 'UTC',
      },
      transparency: 'opaque', // Mark as busy
      extendedProperties: {
        private: {
          'doer.task_id': taskId,
          'doer.task_schedule_id': taskScheduleId,
          ...(planId && { 'doer.plan_id': planId }),
        },
        shared: {
          ...(aiConfidence !== null && { 'doer.ai_confidence': aiConfidence.toString() }),
          ...(planName && { 'doer.plan_name': planName }),
        },
      },
    }
    
    let externalEventId: string
    
    if (existingLink?.external_event_id) {
      // Update existing event
      const response = await calendar.events.update({
        calendarId,
        eventId: existingLink.external_event_id,
        requestBody: event,
      })
      
      externalEventId = response.data.id || existingLink.external_event_id
    } else {
      // Create new event
      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
      })
      
      externalEventId = response.data.id || ''
    }
    
    if (!externalEventId) {
      throw new Error('Failed to create/update event: no event ID returned')
    }
    
    // Store or update calendar event
    const { data: calendarEvent } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('calendar_connection_id', connectionId)
      .eq('external_event_id', externalEventId)
      .eq('calendar_id', calendarId)
      .single()
    
    let eventId: string
    if (calendarEvent) {
      eventId = calendarEvent.id
    } else {
      const { data: newEvent, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          user_id: schedule.user_id || '',
          calendar_connection_id: connectionId,
          external_event_id: externalEventId,
          calendar_id: calendarId,
          summary: taskName,
          description: planName ? `DOER: ${planName}\nTask: ${taskName}` : null,
          start_time: eventStart.toISOString(),
          end_time: eventEnd.toISOString(),
          timezone: timezone || 'UTC',
          is_busy: true,
          is_doer_created: true,
          external_etag: null,
          metadata: {},
        })
        .select('id')
        .single()
      
      if (eventError || !newEvent) {
        throw new Error(`Failed to create calendar event: ${eventError?.message}`)
      }
      
      eventId = newEvent.id
    }
    
    // Create or update link
    const { error: linkError } = await supabase
      .from('calendar_event_links')
      .upsert({
        user_id: schedule.user_id || '',
        calendar_connection_id: connectionId,
        calendar_event_id: eventId,
        plan_id: planId,
        task_schedule_id: taskScheduleId,
        task_id: taskId,
        external_event_id: externalEventId,
        ai_confidence: aiConfidence,
        plan_name: planName,
        task_name: taskName,
        metadata: {
          timezone: timezone || 'UTC',
        },
      }, {
        onConflict: 'calendar_event_id,task_schedule_id',
      })
    
    if (linkError) {
      logger.error('Failed to create calendar event link', linkError as Error, { taskScheduleId })
    }
    
    return {
      external_event_id: externalEventId,
      success: true,
    }
  } catch (error) {
    logger.error('Failed to push task to calendar', error as Error, { connectionId, taskScheduleId })
    return {
      external_event_id: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a Google Calendar event for a DOER task
 */
export async function deleteTaskFromCalendar(
  connectionId: string,
  calendarId: string,
  externalEventId: string
): Promise<boolean> {
  try {
    const calendar = await getCalendarClient(connectionId)
    
    await calendar.events.delete({
      calendarId,
      eventId: externalEventId,
    })
    
    return true
  } catch (error) {
    logger.error('Failed to delete calendar event', error as Error, { connectionId, externalEventId })
    return false
  }
}

/**
 * Get busy slots for a user within a date range
 */
export async function getBusySlotsForUser(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<BusySlot[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.rpc('get_busy_slots_for_user', {
    p_user_id: userId,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
  })
  
  if (error) {
    logger.error('Failed to get busy slots', error as Error, { userId })
    return []
  }
  
  return (data || []).map((slot: any) => ({
    start: slot.start_time,
    end: slot.end_time,
    source: 'calendar_event',
    metadata: {
      summary: slot.summary,
      is_doer_created: slot.is_doer_created,
      ...slot.metadata,
    },
  }))
}


