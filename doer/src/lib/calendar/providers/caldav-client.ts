/**
 * CalDAV Client Implementation
 * Handles CalDAV protocol operations for Apple Calendar (iCloud) integration
 * Uses HTTP methods: PROPFIND, REPORT, PUT, DELETE
 */

// @ts-ignore - ical.js doesn't have TypeScript definitions
import * as ical from 'ical.js'
import type { ExternalEvent } from './base-provider'
import { logger } from '@/lib/logger'

/**
 * CalDAV server configuration
 */
export interface CalDAVConfig {
  serverUrl: string // e.g., https://caldav.icloud.com
  principalUrl?: string // e.g., /123456/calendars/
  username: string
  password: string // OAuth access token for iCloud
}

/**
 * Calendar information from CalDAV
 */
export interface CalDAVCalendar {
  id: string
  displayName: string
  url: string
  ctag?: string // Sync token
  color?: string
  description?: string
}

/**
 * CalDAV Client
 */
export class CalDAVClient {
  private config: CalDAVConfig
  private baseUrl: string

  constructor(config: CalDAVConfig) {
    this.config = config
    this.baseUrl = config.serverUrl.replace(/\/$/, '')
  }

  /**
   * Discover principal URL and calendar home
   */
  async discoverPrincipal(): Promise<string> {
    try {
      // Use well-known CalDAV path
      const wellKnownUrl = `${this.baseUrl}/.well-known/caldav`
      
      const response = await fetch(wellKnownUrl, {
        method: 'PROPFIND',
        headers: {
          'Depth': '0',
          'Content-Type': 'application/xml',
          'Authorization': this.getAuthHeader(),
        },
        body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:current-user-principal />
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`,
      })

      if (!response.ok) {
        throw new Error(`CalDAV discovery failed: ${response.status} ${response.statusText}`)
      }

      const xml = await response.text()
      // Parse XML to extract principal URL
      // For iCloud, principal is typically /{user-id}/calendars/
      const principalMatch = xml.match(/<d:href[^>]*>([^<]+)<\/d:href>/)
      if (principalMatch) {
        return principalMatch[1]
      }

      // Fallback: try common iCloud pattern
      return `/123456/calendars/` // This will be replaced with actual user ID
    } catch (error) {
      logger.error('Failed to discover CalDAV principal', error as Error)
      throw error
    }
  }

  /**
   * Fetch list of calendars
   */
  async fetchCalendars(principalUrl?: string): Promise<CalDAVCalendar[]> {
    try {
      const calendarHome = principalUrl || this.config.principalUrl || await this.discoverPrincipal()
      const calendarUrl = calendarHome.startsWith('http') 
        ? calendarHome 
        : `${this.baseUrl}${calendarHome}`

      const response = await fetch(calendarUrl, {
        method: 'PROPFIND',
        headers: {
          'Depth': '1',
          'Content-Type': 'application/xml',
          'Authorization': this.getAuthHeader(),
        },
        body: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname />
    <c:calendar-description />
    <cs:getctag />
    <d:resourcetype />
  </d:prop>
</d:propfind>`,
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.status} ${response.statusText}`)
      }

      const xml = await response.text()
      return this.parseCalendarList(xml, calendarUrl)
    } catch (error) {
      logger.error('Failed to fetch CalDAV calendars', error as Error)
      throw error
    }
  }

  /**
   * Fetch events from a calendar
   */
  async fetchEvents(
    calendarUrl: string,
    timeMin?: string,
    timeMax?: string,
    syncToken?: string
  ): Promise<{ events: ExternalEvent[]; nextSyncToken: string | null }> {
    try {
      const fullUrl = calendarUrl.startsWith('http') 
        ? calendarUrl 
        : `${this.baseUrl}${calendarUrl}`

      // Build time range filter
      let timeRange = ''
      if (timeMin && timeMax) {
        const start = new Date(timeMin).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        const end = new Date(timeMax).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        timeRange = `<c:time-range start="${start}" end="${end}" />`
      }

      // Use sync-collection for incremental sync, or calendar-query for full sync
      const useSyncCollection = !!syncToken
      
      const body = useSyncCollection
        ? `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:sync-token>${this.escapeXml(syncToken)}</c:sync-token>
</c:calendar-query>`
        : `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        ${timeRange}
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`

      const response = await fetch(fullUrl, {
        method: 'REPORT',
        headers: {
          'Depth': '1',
          'Content-Type': 'application/xml',
          'Authorization': this.getAuthHeader(),
        },
        body,
      })

      if (!response.ok) {
        // If sync token is invalid, return empty with null token to trigger full sync
        if (response.status === 403 || response.status === 404) {
          logger.warn('CalDAV sync token invalid, will do full sync', { calendarUrl })
          return { events: [], nextSyncToken: null }
        }
        throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`)
      }

      const xml = await response.text()
      const { events, nextSyncToken } = this.parseEventResponse(xml)
      
      return { events, nextSyncToken }
    } catch (error) {
      logger.error('Failed to fetch CalDAV events', error as Error, { calendarUrl })
      throw error
    }
  }

  /**
   * Create or update an event
   */
  async putEvent(
    calendarUrl: string,
    eventId: string,
    icsData: string
  ): Promise<string> {
    try {
      const fullUrl = calendarUrl.startsWith('http')
        ? `${calendarUrl}/${eventId}.ics`
        : `${this.baseUrl}${calendarUrl}/${eventId}.ics`

      const response = await fetch(fullUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Authorization': this.getAuthHeader(),
          'If-None-Match': '*', // Only create if doesn't exist
        },
        body: icsData,
      })

      if (!response.ok) {
        // If event exists, try update with If-Match
        if (response.status === 412) {
          const etag = response.headers.get('ETag')
          const updateResponse = await fetch(fullUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'text/calendar; charset=utf-8',
              'Authorization': this.getAuthHeader(),
              ...(etag && { 'If-Match': etag }),
            },
            body: icsData,
          })

          if (!updateResponse.ok) {
            throw new Error(`Failed to update event: ${updateResponse.status} ${updateResponse.statusText}`)
          }
        } else {
          throw new Error(`Failed to create event: ${response.status} ${response.statusText}`)
        }
      }

      // Extract event ID from response or use provided one
      return eventId
    } catch (error) {
      logger.error('Failed to put CalDAV event', error as Error, { calendarUrl, eventId })
      throw error
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarUrl: string, eventId: string): Promise<boolean> {
    try {
      const fullUrl = calendarUrl.startsWith('http')
        ? `${calendarUrl}/${eventId}.ics`
        : `${this.baseUrl}${calendarUrl}/${eventId}.ics`

      const response = await fetch(fullUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      })

      return response.ok || response.status === 404 // 404 means already deleted
    } catch (error) {
      logger.error('Failed to delete CalDAV event', error as Error, { calendarUrl, eventId })
      return false
    }
  }

  /**
   * Generate iCalendar (ICS) format from event data
   */
  generateICS(
    summary: string,
    description: string | null,
    startTime: string,
    endTime: string,
    timezone: string,
    extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> }
  ): string {
    const start = new Date(startTime)
    const end = new Date(endTime)
    
    // Format dates in iCalendar format (YYYYMMDDTHHMMSSZ)
    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    const startFormatted = formatDate(start)
    const endFormatted = formatDate(end)

    // Generate unique ID
    const uid = `doer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@doer.ai`

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//DOER//DOER Calendar Integration//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART;TZID=${timezone}:${startFormatted.replace('Z', '')}
DTEND;TZID=${timezone}:${endFormatted.replace('Z', '')}
SUMMARY:${this.escapeICS(summary)}
${description ? `DESCRIPTION:${this.escapeICS(description)}` : ''}
STATUS:CONFIRMED
SEQUENCE:0
TRANSP:OPAQUE
`

    // Add extended properties
    if (extendedProperties?.private) {
      for (const [key, value] of Object.entries(extendedProperties.private)) {
        ics += `X-DOER-${key.toUpperCase()}:${this.escapeICS(value)}
`
      }
    }

    if (extendedProperties?.shared) {
      for (const [key, value] of Object.entries(extendedProperties.shared)) {
        ics += `X-DOER-${key.toUpperCase()}:${this.escapeICS(value)}
`
      }
    }

    ics += `END:VEVENT
END:VCALENDAR
`

    return ics
  }

  /**
   * Parse iCalendar (ICS) format to ExternalEvent
   */
  parseICS(icsData: string): ExternalEvent[] {
    try {
      const jcalData = ical.parse(icsData)
      const comp = new ical.Component(jcalData)
      const events: ExternalEvent[] = []

      // Get all VEVENT components
      const vevents = comp.getAllSubcomponents('vevent')

      for (const vevent of vevents) {
        const event: ExternalEvent = {
          id: vevent.getFirstPropertyValue('uid') || '',
          summary: vevent.getFirstPropertyValue('summary') || undefined,
          description: vevent.getFirstPropertyValue('description') || undefined,
          start: {},
          end: {},
          transparency: 'opaque',
          extendedProperties: {},
        }

        // Parse start time
        const dtstart = vevent.getFirstProperty('dtstart')
        if (dtstart) {
          const startDate = dtstart.getFirstValue()
          if (startDate instanceof ical.Time) {
            event.start.dateTime = startDate.toJSDate().toISOString()
            event.start.timeZone = startDate.zone?.tzid || 'UTC'
          }
        }

        // Parse end time
        const dtend = vevent.getFirstProperty('dtend')
        if (dtend) {
          const endDate = dtend.getFirstValue()
          if (endDate instanceof ical.Time) {
            event.end.dateTime = endDate.toJSDate().toISOString()
            event.end.timeZone = endDate.zone?.tzid || 'UTC'
          }
        }

        // Parse transparency
        const transp = vevent.getFirstPropertyValue('transp')
        if (transp === 'TRANSPARENT') {
          event.transparency = 'transparent'
        }

        // Parse extended properties (X-DOER-*)
        const allProps = vevent.getAllProperties()
        const privateProps: Record<string, string> = {}
        const sharedProps: Record<string, string> = {}

        for (const prop of allProps) {
          const name = prop.name.toLowerCase()
          if (name.startsWith('x-doer-')) {
            const key = name.replace('x-doer-', '')
            const value = prop.getFirstValue()
            // Determine if private or shared based on key
            if (key.includes('task_id') || key.includes('plan_id') || key.includes('task_schedule_id')) {
              privateProps[key] = String(value)
            } else {
              sharedProps[key] = String(value)
            }
          }
        }

        if (Object.keys(privateProps).length > 0 || Object.keys(sharedProps).length > 0) {
          event.extendedProperties = {
            private: Object.keys(privateProps).length > 0 ? privateProps : undefined,
            shared: Object.keys(sharedProps).length > 0 ? sharedProps : undefined,
          }
        }

        // Get ETag if available (from CalDAV response)
        // This will be set by parseEventResponse

        events.push(event)
      }

      return events
    } catch (error) {
      logger.error('Failed to parse iCalendar data', error as Error)
      throw new Error(`Failed to parse iCalendar: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get authentication header
   */
  private getAuthHeader(): string {
    // For OAuth, use Bearer token
    // For Basic Auth, use base64(username:password)
    if (this.config.password.startsWith('Bearer ')) {
      return this.config.password
    }
    const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')
    return `Basic ${credentials}`
  }

  /**
   * Parse calendar list from PROPFIND response
   */
  private parseCalendarList(xml: string, baseUrl: string): CalDAVCalendar[] {
    const calendars: CalDAVCalendar[] = []
    
    // Simple XML parsing (could use a proper XML parser)
    const hrefMatches = xml.matchAll(/<d:href[^>]*>([^<]+)<\/d:href>/g)
    const displayNameMatches = xml.matchAll(/<d:displayname[^>]*>([^<]*)<\/d:displayname>/g)
    const ctagMatches = xml.matchAll(/<cs:getctag[^>]*>([^<]*)<\/cs:getctag>/g)

    const hrefs = Array.from(hrefMatches).map(m => m[1])
    const names = Array.from(displayNameMatches).map(m => m[1])
    const ctags = Array.from(ctagMatches).map(m => m[1])

    // Match calendars (skip principal URL)
    for (let i = 0; i < hrefs.length; i++) {
      const href = hrefs[i]
      // Skip if it's the principal URL itself
      if (href.endsWith('/') && !href.match(/\/calendars\/[^\/]+\/$/)) {
        continue
      }

      const calendar: CalDAVCalendar = {
        id: href.split('/').filter(Boolean).pop() || href,
        displayName: names[i] || 'Untitled Calendar',
        url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
        ctag: ctags[i] || undefined,
      }

      calendars.push(calendar)
    }

    return calendars
  }

  /**
   * Parse event response from REPORT query
   */
  private parseEventResponse(xml: string): { events: ExternalEvent[]; nextSyncToken: string | null } {
    const events: ExternalEvent[] = []
    let nextSyncToken: string | null = null

    // Extract sync token if present
    const syncTokenMatch = xml.match(/<c:sync-token[^>]*>([^<]*)<\/c:sync-token>/)
    if (syncTokenMatch) {
      nextSyncToken = syncTokenMatch[1]
    }

    // Extract calendar data blocks
    const calendarDataMatches = xml.matchAll(/<c:calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/c:calendar-data>/g)
    
    for (const match of calendarDataMatches) {
      const icsData = match[1]
      try {
        const parsedEvents = this.parseICS(icsData)
        events.push(...parsedEvents)
      } catch (error) {
        logger.warn('Failed to parse event from CalDAV response', { error })
        // Continue with other events
      }
    }

    // Also try without CDATA
    const calendarDataMatches2 = xml.matchAll(/<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/g)
    for (const match of calendarDataMatches2) {
      const icsData = match[1].trim()
      if (icsData && !icsData.includes('CDATA')) {
        try {
          const parsedEvents = this.parseICS(icsData)
          events.push(...parsedEvents)
        } catch (error) {
          logger.warn('Failed to parse event from CalDAV response', { error })
        }
      }
    }

    return { events, nextSyncToken }
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  /**
   * Escape iCalendar special characters
   */
  private escapeICS(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }
}

