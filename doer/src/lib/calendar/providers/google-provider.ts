/**
 * Google Calendar Provider Implementation
 * Implements CalendarProvider interface for Google Calendar integration
 */

import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
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
import type { GoogleCalendarEvent } from '../types'
import { formatDateForDB } from '@/lib/date-utils'
import { getProviderConfig, getProviderRedirectUri } from './config'

/**
 * Google Calendar Provider
 */
export class GoogleCalendarProvider implements CalendarProvider {
  private readonly provider = 'google' as const

  validateConfig(): void {
    // Will throw if config is missing
    getProviderConfig(this.provider)
  }

  getRedirectUri(requestOrigin?: string): string {
    return getProviderRedirectUri(this.provider, requestOrigin)
  }

  private getOAuth2Client(redirectUri?: string): OAuth2Client {
    const config = getProviderConfig(this.provider)
    const uri = redirectUri || this.getRedirectUri()

    return new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      uri
    )
  }

  async generateAuthUrl(state?: string): Promise<string> {
    const redirectUri = this.getRedirectUri()
    const oauth2Client = this.getOAuth2Client(redirectUri)

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

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens> {
    const oauth2Client = this.getOAuth2Client(redirectUri)

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
      const refreshToken = decryptToken(connection.refresh_token_encrypted)
      // For refresh token flow, redirect URI doesn't matter - use any valid one
      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      })

      const { credentials } = await oauth2Client.refreshAccessToken()

      if (!credentials.access_token || !credentials.expiry_date) {
        throw new Error('Failed to refresh access token')
      }

      // Update connection with new access token
      const accessTokenEncrypted = encryptToken(credentials.access_token)
      const { error: updateError } = await supabase
        .from('calendar_connections')
        .update({
          access_token_encrypted: accessTokenEncrypted,
          token_expires_at: new Date(credentials.expiry_date).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)

      if (updateError) {
        logger.error('Failed to update access token in database', updateError as Error, { connectionId })
        throw updateError
      }

      return {
        access_token: credentials.access_token,
        refresh_token: refreshToken, // Return existing refresh token
        expiry_date: credentials.expiry_date,
      }
    } catch (error) {
      logger.error('Failed to refresh access token', error as Error, { connectionId })
      throw error
    }
  }

  private async getCalendarClient(connectionId: string): Promise<calendar_v3.Calendar> {
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

    // Create authenticated client
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials({
      access_token: accessToken,
    })

    return google.calendar({ version: 'v3', auth: oauth2Client })
  }

  async fetchCalendars(connectionId: string): Promise<Calendar[]> {
    const calendar = await this.getCalendarClient(connectionId)

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

  async fetchEvents(
    connectionId: string,
    calendarIds: string[],
    syncToken?: string | null,
    timeMin?: string,
    timeMax?: string
  ): Promise<FetchResult> {
    const calendar = await this.getCalendarClient(connectionId)
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

        allEvents.push(...(items as ExternalEvent[]))

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
          allEvents.push(...(nextItems as ExternalEvent[]))

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
          allEvents.push(...(items as ExternalEvent[]))

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

  convertToBusySlot(event: ExternalEvent, calendarId: string): BusySlot | null {
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
    const calendar = await this.getCalendarClient(connectionId)

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

      // Create event object
      const event: calendar_v3.Schema$Event = {
        summary: task.taskName,
        description: task.planName ? `DOER: ${task.planName}\nTask: ${task.taskName}` : `DOER Task: ${task.taskName}`,
        start: {
          dateTime: eventStart.toISOString(),
          timeZone: task.timezone || 'UTC',
        },
        end: {
          dateTime: eventEnd.toISOString(),
          timeZone: task.timezone || 'UTC',
        },
        transparency: 'opaque', // Mark as busy
        extendedProperties: {
          private: {
            'doer.task_id': task.taskId,
            'doer.task_schedule_id': task.taskScheduleId,
            ...(task.planId && { 'doer.plan_id': task.planId }),
          },
          shared: {
            ...(task.aiConfidence !== null && { 'doer.ai_confidence': task.aiConfidence.toString() }),
            ...(task.planName && { 'doer.plan_name': task.planName }),
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
            summary: task.taskName,
            description: task.planName ? `DOER: ${task.planName}\nTask: ${task.taskName}` : null,
            start_time: eventStart.toISOString(),
            end_time: eventEnd.toISOString(),
            timezone: task.timezone || 'UTC',
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
          plan_id: task.planId,
          task_schedule_id: task.taskScheduleId,
          task_id: task.taskId,
          external_event_id: externalEventId,
          ai_confidence: task.aiConfidence,
          plan_name: task.planName,
          task_name: task.taskName,
          metadata: {
            timezone: task.timezone || 'UTC',
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
      const calendar = await this.getCalendarClient(connectionId)

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
}

