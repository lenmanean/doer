/**
 * Apple Calendar Provider Implementation
 * Implements CalendarProvider interface for Apple Calendar (iCloud) integration
 * Uses Sign in with Apple OAuth 2.0 and CalDAV protocol
 */

import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '../encryption'
import { logger } from '@/lib/logger'
import type {
  CalendarProvider,
  Tokens,
  Calendar,
  ExternalEvent,
  FetchResult,
  PushResult,
  TaskInput,
} from './base-provider'
import type { BusySlot } from '../types'
import { getProviderConfig, getProviderRedirectUri } from './config'
import { CalDAVClient, type CalDAVConfig } from './caldav-client'

/**
 * Apple Calendar Provider
 */
export class AppleCalendarProvider implements CalendarProvider {
  private readonly provider = 'apple' as const
  private readonly tokenEndpoint = 'https://appleid.apple.com/auth/token'
  private readonly authEndpoint = 'https://appleid.apple.com/auth/authorize'
  private readonly iCloudCalDAVUrl = 'https://caldav.icloud.com'

  validateConfig(): void {
    // Will throw if config is missing
    getProviderConfig(this.provider)
  }

  getRedirectUri(requestOrigin?: string): string {
    return getProviderRedirectUri(this.provider, requestOrigin)
  }

  async generateAuthUrl(state?: string): Promise<string> {
    const config = getProviderConfig(this.provider)
    const redirectUri = this.getRedirectUri()

    const scopes = [
      'name',
      'email',
      'calendars.read',
      'calendars.write',
    ]

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      response_mode: 'query', // Use query for consistency with existing infrastructure (POST handler also available)
      ...(state && { state }),
    })

    return `${this.authEndpoint}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens> {
    const config = getProviderConfig(this.provider)

    // Apple requires a client secret (JWT) for token exchange
    // For now, we'll use the client_secret from env, but in production
    // this should be a JWT signed with Apple's private key
    const clientSecret = config.clientSecret

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Failed to exchange code for tokens', new Error(errorText), {
        status: response.status,
      })
      throw new Error(`Failed to exchange authorization code: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    if (!data.access_token) {
      throw new Error('Failed to obtain access token from Apple')
    }

    // Apple may not provide refresh_token in all cases
    // Store the access token, and we'll handle refresh differently
    const refreshToken = data.refresh_token || data.access_token // Fallback

    // Calculate expiry date (expires_in is in seconds)
    const expiresIn = data.expires_in || 3600 // Default 1 hour
    const expiryDate = Date.now() + expiresIn * 1000

    return {
      access_token: data.access_token,
      refresh_token: refreshToken,
      expiry_date: expiryDate,
    }
  }

  async refreshAccessToken(connectionId: string): Promise<Tokens> {
    const supabase = await createClient()

    // Fetch connection
    const { data: connection, error } = await supabase
      .from('calendar_connections')
      .select('id, refresh_token_encrypted, token_expires_at')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    try {
      const config = getProviderConfig(this.provider)
      const refreshToken = decryptToken(connection.refresh_token_encrypted)

      // Apple token refresh
      const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      })

      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Failed to refresh access token', new Error(errorText), {
          connectionId,
          status: response.status,
        })
        throw new Error(`Failed to refresh access token: ${response.status} ${errorText}`)
      }

      const data = await response.json()

      if (!data.access_token) {
        throw new Error('Failed to refresh access token: no access token in response')
      }

      // Calculate expiry date
      const expiresIn = data.expires_in || 3600
      const expiryDate = Date.now() + expiresIn * 1000

      // Update connection with new access token
      const accessTokenEncrypted = encryptToken(data.access_token)
      const newRefreshToken = data.refresh_token || refreshToken

      const { error: updateError } = await supabase
        .from('calendar_connections')
        .update({
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: newRefreshToken ? encryptToken(newRefreshToken) : connection.refresh_token_encrypted,
          token_expires_at: new Date(expiryDate).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)

      if (updateError) {
        logger.error('Failed to update access token in database', updateError as Error, { connectionId })
        throw updateError
      }

      return {
        access_token: data.access_token,
        refresh_token: newRefreshToken || refreshToken,
        expiry_date: expiryDate,
      }
    } catch (error) {
      logger.error('Failed to refresh access token', error as Error, { connectionId })
      throw error
    }
  }

  private async getCalDAVClient(connectionId: string): Promise<CalDAVClient> {
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
      const refreshed = await this.refreshAccessToken(connectionId)
      accessToken = refreshed.access_token
    }

    // For iCloud, we need the user's Apple ID
    // This should be stored in connection metadata or retrieved from token
    // For now, we'll use a placeholder - in production, extract from token or store separately
    const username = 'user@icloud.com' // TODO: Extract from token or store in connection

    const caldavConfig: CalDAVConfig = {
      serverUrl: this.iCloudCalDAVUrl,
      username,
      password: `Bearer ${accessToken}`, // Use Bearer token for OAuth
    }

    return new CalDAVClient(caldavConfig)
  }

  async fetchCalendars(connectionId: string): Promise<Calendar[]> {
    try {
      const caldav = await this.getCalDAVClient(connectionId)
      
      // Discover principal first
      const principalUrl = await caldav.discoverPrincipal()
      
      // Fetch calendars
      const calendars = await caldav.fetchCalendars(principalUrl)

      return calendars.map(cal => ({
        id: cal.url, // Use URL as ID for CalDAV
        summary: cal.displayName,
        primary: cal.id === 'calendar' || cal.id === 'home', // Common primary calendar IDs
      }))
    } catch (error) {
      logger.error('Failed to fetch calendars', error as Error, { connectionId })
      throw error
    }
  }

  async fetchEvents(
    connectionId: string,
    calendarIds: string[],
    syncToken?: string | null,
    timeMin?: string,
    timeMax?: string
  ): Promise<FetchResult> {
    const caldav = await this.getCalDAVClient(connectionId)
    const allEvents: ExternalEvent[] = []

    // If no sync token, do a full sync from timeMin
    const isFullSync = !syncToken

    // Default time range: next 30 days if not specified
    const defaultTimeMin = timeMin || new Date().toISOString()
    const defaultTimeMax = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let nextSyncToken: string | null = null

    // Fetch from each selected calendar
    for (const calendarId of calendarIds) {
      try {
        const { events, nextSyncToken: calendarSyncToken } = await caldav.fetchEvents(
          calendarId,
          defaultTimeMin,
          defaultTimeMax,
          syncToken || undefined
        )

        allEvents.push(...events)

        // Use the latest sync token
        if (calendarSyncToken) {
          nextSyncToken = calendarSyncToken
        }
      } catch (error) {
        // If sync token is invalid, need full sync
        if (syncToken && error instanceof Error && error.message.includes('sync token')) {
          logger.warn('Sync token invalid, need full sync', { connectionId, calendarId })
          
          // Retry without sync token
          try {
            const { events, nextSyncToken: calendarSyncToken } = await caldav.fetchEvents(
              calendarId,
              defaultTimeMin,
              defaultTimeMax
            )

            allEvents.push(...events)
            if (calendarSyncToken) {
              nextSyncToken = calendarSyncToken
            }
          } catch (retryError) {
            logger.error('Failed to fetch calendar events after retry', retryError as Error, { connectionId, calendarId })
            throw retryError
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

  convertToBusySlot(event: ExternalEvent, calendarId: string): BusySlot | null {
    if (!event.start || !event.end) {
      return null
    }

    const startDateTime = event.start.dateTime || event.start.date
    const endDateTime = event.end.dateTime || event.end.date

    if (!startDateTime || !endDateTime) {
      return null
    }

    // Determine if event is busy (transparent = free, opaque = busy)
    const isBusy = event.transparency !== 'transparent'

    // Check if DOER created this event
    const isDoerCreated = event.extendedProperties?.private?.['doer.task_id'] !== undefined ||
                          event.extendedProperties?.private?.['doer.plan_id'] !== undefined

    return {
      start: new Date(startDateTime).toISOString(),
      end: new Date(endDateTime).toISOString(),
      source: 'calendar_event',
      metadata: {
        event_id: event.id,
        calendar_id: calendarId,
        summary: event.summary,
        is_doer_created: isDoerCreated,
        transparency: event.transparency,
      },
    }
  }

  async pushTaskToCalendar(
    connectionId: string,
    calendarId: string,
    task: TaskInput
  ): Promise<PushResult> {
    const supabase = await createClient()
    const caldav = await this.getCalDAVClient(connectionId)

    try {
      // Fetch task schedule details
      const { data: schedule, error: scheduleError } = await supabase
        .from('task_schedule')
        .select('id, date, start_time, end_time, task_id, plan_id, user_id')
        .eq('id', task.taskScheduleId)
        .single()

      if (scheduleError || !schedule) {
        throw new Error(`Task schedule not found: ${task.taskScheduleId}`)
      }

      // Check if event already exists
      const { data: existingLink } = await supabase
        .from('calendar_event_links')
        .select('external_event_id, calendar_events(id, external_event_id)')
        .eq('task_schedule_id', task.taskScheduleId)
        .single()

      const eventStart = new Date(task.startTime)
      const eventEnd = new Date(task.endTime)
      const timezone = task.timezone || 'UTC'

      // Generate event ID
      const eventId = existingLink?.external_event_id || `doer-${task.taskId}-${Date.now()}`

      // Build extended properties
      const extendedProperties = {
        private: {
          'doer.task_id': task.taskId,
          'doer.task_schedule_id': task.taskScheduleId,
          ...(task.planId && { 'doer.plan_id': task.planId }),
        },
        shared: {
          ...(task.aiConfidence !== null && { 'doer.ai_confidence': task.aiConfidence.toString() }),
          ...(task.planName && { 'doer.plan_name': task.planName }),
        },
      }

      // Generate ICS format
      const icsData = caldav.generateICS(
        task.taskName,
        task.planName ? `DOER: ${task.planName}\nTask: ${task.taskName}` : `DOER Task: ${task.taskName}`,
        task.startTime,
        task.endTime,
        timezone,
        extendedProperties
      )

      // Create or update event
      const externalEventId = await caldav.putEvent(calendarId, eventId, icsData)

      // Store or update calendar event
      const { data: calendarEvent } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('calendar_connection_id', connectionId)
        .eq('external_event_id', externalEventId)
        .eq('calendar_id', calendarId)
        .single()

      let eventId_db: string
      if (calendarEvent) {
        eventId_db = calendarEvent.id
      } else {
        const { data: newEvent, error: eventError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: schedule.user_id || '',
            calendar_connection_id: connectionId,
            external_event_id: externalEventId,
            calendar_id: calendarId,
            summary: task.taskName,
            description: task.planName ? `DOER: ${task.planName}\nTask: ${task.taskName}` : null,
            start_time: eventStart.toISOString(),
            end_time: eventEnd.toISOString(),
            timezone: timezone,
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

        eventId_db = newEvent.id
      }

      // Create or update link
      const { error: linkError } = await supabase
        .from('calendar_event_links')
        .upsert({
          user_id: schedule.user_id || '',
          calendar_connection_id: connectionId,
          calendar_event_id: eventId_db,
          plan_id: task.planId,
          task_schedule_id: task.taskScheduleId,
          task_id: task.taskId,
          external_event_id: externalEventId,
          ai_confidence: task.aiConfidence,
          plan_name: task.planName,
          task_name: task.taskName,
          metadata: {
            timezone: timezone,
          },
        }, {
          onConflict: 'calendar_event_id,task_schedule_id',
        })

      if (linkError) {
        logger.error('Failed to create calendar event link', linkError as Error, { taskScheduleId: task.taskScheduleId })
      }

      return {
        external_event_id: externalEventId,
        success: true,
      }
    } catch (error) {
      logger.error('Failed to push task to calendar', error as Error, { connectionId, taskScheduleId: task.taskScheduleId })
      return {
        external_event_id: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async deleteTaskFromCalendar(
    connectionId: string,
    calendarId: string,
    externalEventId: string
  ): Promise<boolean> {
    try {
      const caldav = await this.getCalDAVClient(connectionId)
      
      // Extract event ID from external event ID (remove .ics if present)
      const eventId = externalEventId.replace(/\.ics$/, '')
      
      return await caldav.deleteEvent(calendarId, eventId)
    } catch (error) {
      logger.error('Failed to delete calendar event', error as Error, { connectionId, externalEventId })
      return false
    }
  }
}

