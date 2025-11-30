/**
 * Base Calendar Provider Interface
 * Defines the contract that all calendar providers (Google, Outlook, Apple) must implement
 */

import type { BusySlot, CalendarConnection } from '../types'

/**
 * OAuth tokens returned from provider
 */
export interface Tokens {
  access_token: string
  refresh_token: string
  expiry_date: number
}

/**
 * Calendar representation from provider
 */
export interface Calendar {
  id: string
  summary: string
  primary?: boolean
}

/**
 * External event from provider (provider-specific format)
 */
export interface ExternalEvent {
  id: string
  summary?: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  transparency?: 'opaque' | 'transparent'
  extendedProperties?: {
    private?: Record<string, string>
    shared?: Record<string, string>
  }
  etag?: string
  [key: string]: unknown // Allow provider-specific fields
}

/**
 * Task input for pushing to calendar
 */
export interface TaskInput {
  taskScheduleId: string
  taskId: string
  planId: string | null
  taskName: string
  planName: string | null
  startTime: string // ISO datetime
  endTime: string   // ISO datetime
  aiConfidence: number | null
  timezone?: string
}

/**
 * Result of fetching events from provider
 */
export interface FetchResult {
  events: ExternalEvent[]
  deletedEventIds: string[]
  nextSyncToken: string | null
  isFullSync: boolean
}

/**
 * Result of pushing task to calendar
 */
export interface PushResult {
  external_event_id: string
  success: boolean
  error?: string
}

/**
 * Calendar Provider Interface
 * All calendar providers must implement this interface
 */
export interface CalendarProvider {
  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state?: string): Promise<string>

  /**
   * Exchange authorization code for access and refresh tokens
   */
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens>

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(connectionId: string): Promise<Tokens>

  /**
   * Fetch list of available calendars for the user
   */
  fetchCalendars(connectionId: string): Promise<Calendar[]>

  /**
   * Fetch events from specified calendars
   * @param connectionId - Connection ID
   * @param calendarIds - Array of calendar IDs to fetch from
   * @param syncToken - Optional sync token for incremental sync
   * @param syncType - 'full' to fetch all events, 'basic' to fetch present and future only
   */
  fetchEvents(
    connectionId: string,
    calendarIds: string[],
    syncToken?: string | null,
    syncType?: 'full' | 'basic'
  ): Promise<FetchResult>

  /**
   * Push a DOER task to the calendar
   */
  pushTaskToCalendar(
    connectionId: string,
    calendarId: string,
    task: TaskInput
  ): Promise<PushResult>

  /**
   * Delete an event from the calendar
   */
  deleteTaskFromCalendar(
    connectionId: string,
    calendarId: string,
    externalEventId: string
  ): Promise<boolean>

  /**
   * Get the OAuth redirect URI for this provider
   */
  getRedirectUri(): string

  /**
   * Convert provider-specific event to DOER BusySlot format
   */
  convertToBusySlot(event: ExternalEvent, calendarId: string): BusySlot | null

  /**
   * Validate that required configuration (env vars, etc.) is present
   * Throws error if configuration is invalid
   */
  validateConfig(): void
}

