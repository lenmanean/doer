/**
 * Microsoft Outlook Calendar Provider Implementation
 * Implements CalendarProvider interface for Microsoft Outlook/Calendar integration
 * Supports both personal (outlook.com, hotmail.com) and work/school (Azure AD) accounts
 */

import { Client } from '@microsoft/microsoft-graph-client'
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

/**
 * Microsoft Graph API event interface
 */
interface MicrosoftGraphEvent {
  id: string
  subject?: string
  body?: {
    contentType: string
    content: string
  }
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  isAllDay?: boolean
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown'
  singleValueExtendedProperties?: Array<{
    id: string
    value: string
  }>
  '@odata.etag'?: string
}

/**
 * Microsoft Graph API calendar interface
 */
interface MicrosoftGraphCalendar {
  id: string
  name: string
  isDefaultCalendar?: boolean
}

/**
 * Microsoft Graph delta response
 */
interface MicrosoftGraphDeltaResponse {
  value: MicrosoftGraphEvent[]
  '@odata.deltaLink'?: string
  '@odata.nextLink'?: string
}

/**
 * Outlook Calendar Provider
 */
export class OutlookCalendarProvider implements CalendarProvider {
  private readonly provider = 'outlook' as const
  private readonly tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
  private readonly authEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'

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
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'offline_access',
    ]

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes.join(' '),
      ...(state && { state }),
    })

    return `${this.authEndpoint}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens> {
    const config = getProviderConfig(this.provider)

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
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

    if (!data.access_token || !data.refresh_token) {
      throw new Error('Failed to obtain access and refresh tokens from Microsoft')
    }

    // Calculate expiry date (expires_in is in seconds)
    const expiresIn = data.expires_in || 3600 // Default 1 hour
    const expiryDate = Date.now() + expiresIn * 1000

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
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
      const newRefreshToken = data.refresh_token || refreshToken // Use new refresh token if provided, otherwise keep existing

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

  private async getGraphClient(connectionId: string): Promise<Client> {
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

    // Create Microsoft Graph client with authentication provider
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      },
    })

    return client
  }

  async fetchCalendars(connectionId: string): Promise<Calendar[]> {
    const client = await this.getGraphClient(connectionId)

    try {
      const response = await client.api('/me/calendars').get()

      if (!response.value || !Array.isArray(response.value)) {
        return []
      }

      return response.value.map((cal: MicrosoftGraphCalendar) => ({
        id: cal.id,
        summary: cal.name || 'Untitled Calendar',
        primary: cal.isDefaultCalendar || false,
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
    const client = await this.getGraphClient(connectionId)
    const allEvents: ExternalEvent[] = []

    // If no sync token, do a full sync from timeMin
    const isFullSync = !syncToken

    // Default time range for full sync:
    // - Start: beginning of today (in UTC) so we include all of today's events
    // - End: 30 days from now
    const now = new Date()
    const startOfTodayUtc = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ))

    const defaultTimeMin = timeMin || startOfTodayUtc.toISOString()
    const defaultTimeMax = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let nextSyncToken: string | null = null

    // Fetch from each selected calendar
    // Note: Microsoft Graph delta queries work per-calendar, but we'll use a combined approach
    // For simplicity, we'll track delta links per calendar or use a single combined sync token
    for (const calendarId of calendarIds) {
      try {
        if (syncToken && syncToken.startsWith('https://')) {
          // Delta link is a full URL - use it directly
          const accessToken = await this.getAccessToken(connectionId)
          const deltaResponse = await fetch(syncToken, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          })

          if (!deltaResponse.ok) {
            // If delta link is invalid, fall back to full sync
            if (deltaResponse.status === 410) {
              logger.warn('Delta link expired, falling back to full sync', { connectionId, calendarId })
              syncToken = null // Will trigger full sync below
            } else {
              throw new Error(`Delta query failed: ${deltaResponse.status}`)
            }
          } else {
            const deltaData: MicrosoftGraphDeltaResponse = await deltaResponse.json()
            const events = this.convertGraphEventsToExternal(deltaData.value || [])
            allEvents.push(...events)

            if (deltaData['@odata.deltaLink']) {
              nextSyncToken = deltaData['@odata.deltaLink']
            }

            // Handle pagination
            let nextLink = deltaData['@odata.nextLink']
            while (nextLink) {
              const nextResponse = await client.api(nextLink).get()
              const nextEvents = this.convertGraphEventsToExternal(nextResponse.value || [])
              allEvents.push(...nextEvents)

              if (nextResponse['@odata.deltaLink']) {
                nextSyncToken = nextResponse['@odata.deltaLink']
                break
              }
              nextLink = nextResponse['@odata.nextLink']
            }

            continue // Skip to next calendar
          }
        }

        // Full sync or initial delta query
        const params: Record<string, string> = {
          startDateTime: defaultTimeMin,
          endDateTime: defaultTimeMax,
          $select: 'id,subject,body,start,end,isAllDay,showAs,singleValueExtendedProperties',
          $orderby: 'start/dateTime',
        }

        const queryString = new URLSearchParams(params).toString()
        const url = syncToken 
          ? `/me/calendars/${calendarId}/calendarView/delta?${queryString}`
          : `/me/calendars/${calendarId}/calendarView?${queryString}`

        let response: any = await client.api(url).get()
        const events = this.convertGraphEventsToExternal(response.value || [])
        allEvents.push(...events)

        // Handle pagination and delta links
        if (response['@odata.deltaLink']) {
          nextSyncToken = response['@odata.deltaLink']
        } else if (response['@odata.nextLink']) {
          // Handle pagination
          let nextLink = response['@odata.nextLink']
          while (nextLink) {
            const nextResponse = await client.api(nextLink).get()
            const nextEvents = this.convertGraphEventsToExternal(nextResponse.value || [])
            allEvents.push(...nextEvents)

            if (nextResponse['@odata.deltaLink']) {
              nextSyncToken = nextResponse['@odata.deltaLink']
              break
            }
            nextLink = nextResponse['@odata.nextLink']
          }
        }
      } catch (error) {
        // If delta query fails, fall back to full sync
        if (syncToken && error instanceof Error) {
          logger.warn('Delta query failed, falling back to full sync', { connectionId, calendarId, error: error.message })
          
          // Retry without sync token
          try {
            const params: Record<string, string> = {
              startDateTime: defaultTimeMin,
              endDateTime: defaultTimeMax,
              $select: 'id,subject,body,start,end,isAllDay,showAs,singleValueExtendedProperties',
              $orderby: 'start/dateTime',
            }
            const queryString = new URLSearchParams(params).toString()
            const url = `/me/calendars/${calendarId}/calendarView?${queryString}`
            
            const response = await client.api(url).get()
            const events = this.convertGraphEventsToExternal(response.value || [])
            allEvents.push(...events)

            // Get delta link for next sync
            if (response['@odata.deltaLink']) {
              nextSyncToken = response['@odata.deltaLink']
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

  private async getAccessToken(connectionId: string): Promise<string> {
    const supabase = await createClient()
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('access_token_encrypted, token_expires_at')
      .eq('id', connectionId)
      .single()

    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    const expiresAt = new Date(connection.token_expires_at)
    const now = new Date()
    const needsRefresh = expiresAt <= now || expiresAt.getTime() - now.getTime() < 300000

    if (needsRefresh) {
      const refreshed = await this.refreshAccessToken(connectionId)
      return refreshed.access_token
    }

    return decryptToken(connection.access_token_encrypted)
  }

  private convertGraphEventsToExternal(events: MicrosoftGraphEvent[]): ExternalEvent[] {
    return events.map((event) => {
      const externalEvent: ExternalEvent = {
        id: event.id,
        summary: event.subject,
        description: event.body?.content,
        start: {
          dateTime: event.start.dateTime,
          timeZone: event.start.timeZone,
        },
        end: {
          dateTime: event.end.dateTime,
          timeZone: event.end.timeZone,
        },
        transparency: event.showAs === 'free' ? 'transparent' : 'opaque',
        etag: event['@odata.etag'],
      }

      // Extract extended properties (DOER metadata)
      // Microsoft Graph extended property format: "{type} {name} {guid}"
      // Example: "String doer.task_id {12345678-1234-1234-1234-123456789abc}"
      if (event.singleValueExtendedProperties) {
        const privateProps: Record<string, string> = {}
        const sharedProps: Record<string, string> = {}

        for (const prop of event.singleValueExtendedProperties) {
          // Parse the property ID format: "String doer.task_id {guid}"
          const parts = prop.id.split(' ')
          if (parts.length >= 2 && parts[1]?.startsWith('doer.')) {
            const propName = parts[1]
            if (propName.includes('task_id') || propName.includes('plan_id') || propName.includes('task_schedule_id')) {
              privateProps[propName] = prop.value
            } else {
              sharedProps[propName] = prop.value
            }
          }
        }

        if (Object.keys(privateProps).length > 0 || Object.keys(sharedProps).length > 0) {
          externalEvent.extendedProperties = {
            private: privateProps,
            shared: sharedProps,
          }
        }
      }

      return externalEvent
    })
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
    const client = await this.getGraphClient(connectionId)

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

      // Create event object for Microsoft Graph
      const eventData: any = {
        subject: task.taskName,
        body: {
          contentType: 'text',
          content: task.planName ? `DOER: ${task.planName}\nTask: ${task.taskName}` : `DOER Task: ${task.taskName}`,
        },
        start: {
          dateTime: eventStart.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: eventEnd.toISOString(),
          timeZone: timezone,
        },
        showAs: 'busy', // Mark as busy
        singleValueExtendedProperties: [
          {
            id: `String doer.task_id {${this.getGuid('doer.task_id')}}`,
            value: task.taskId,
          },
          {
            id: `String doer.task_schedule_id {${this.getGuid('doer.task_schedule_id')}}`,
            value: task.taskScheduleId,
          },
          ...(task.planId ? [{
            id: `String doer.plan_id {${this.getGuid('doer.plan_id')}}`,
            value: task.planId,
          }] : []),
          ...(task.aiConfidence !== null ? [{
            id: `String doer.ai_confidence {${this.getGuid('doer.ai_confidence')}}`,
            value: task.aiConfidence.toString(),
          }] : []),
          ...(task.planName ? [{
            id: `String doer.plan_name {${this.getGuid('doer.plan_name')}}`,
            value: task.planName,
          }] : []),
        ],
      }

      let externalEventId: string

      if (existingLink?.external_event_id) {
        // Update existing event
        const response = await client
          .api(`/me/calendars/${calendarId}/events/${existingLink.external_event_id}`)
          .patch(eventData)

        externalEventId = response.id || existingLink.external_event_id
      } else {
        // Create new event
        const response = await client
          .api(`/me/calendars/${calendarId}/events`)
          .post(eventData)

        externalEventId = response.id || ''
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
      const client = await this.getGraphClient(connectionId)

      await client
        .api(`/me/calendars/${calendarId}/events/${externalEventId}`)
        .delete()

      return true
    } catch (error) {
      logger.error('Failed to delete calendar event', error as Error, { connectionId, externalEventId })
      return false
    }
  }

  /**
   * Generate a deterministic GUID for extended properties based on property name
   * Microsoft Graph requires GUIDs for extended property IDs
   * Using deterministic GUIDs ensures the same property name always gets the same GUID,
   * which is important for property updates and consistency
   */
  private getGuid(propertyName: string): string {
    // Create a deterministic GUID from property name using a hash
    // This ensures the same property name always gets the same GUID
    // Use a namespace UUID for DOER (generated once, never changes)
    const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    
    // Simple hash function for property name
    let hash = 0
    for (let i = 0; i < propertyName.length; i++) {
      const char = propertyName.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    // Combine namespace hash with property name hash for uniqueness
    let combinedHash = hash
    for (let i = 0; i < namespace.length; i++) {
      const char = namespace.charCodeAt(i)
      combinedHash = ((combinedHash << 5) - combinedHash) + char
      combinedHash = combinedHash & combinedHash
    }
    
    // Convert to GUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // Version 4 UUID format (random), but deterministic based on input
    const h1 = Math.abs(combinedHash).toString(16).padStart(8, '0').substring(0, 8)
    const h2 = Math.abs(hash).toString(16).padStart(4, '0').substring(0, 4)
    const h3 = '4' + Math.abs(combinedHash ^ hash).toString(16).padStart(3, '0').substring(0, 3)
    const h4 = ((Math.abs(combinedHash) & 0x3) | 0x8).toString(16) + Math.abs(hash).toString(16).padStart(3, '0').substring(0, 3)
    const h5 = (Math.abs(combinedHash ^ hash ^ (combinedHash << 16))).toString(16).padStart(12, '0').substring(0, 12)
    
    return `${h1}-${h2}-${h3}-${h4}-${h5}`
  }
}

