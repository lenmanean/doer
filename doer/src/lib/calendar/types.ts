/**
 * Types for Google Calendar sync integration
 */

import type { BusySlot as LibBusySlot } from '@/lib/types'

// Re-export BusySlot from lib/types for consistency
export type BusySlot = LibBusySlot

export interface CalendarConnection {
  id: string
  user_id: string
  provider: 'google' | 'outlook' | 'apple'
  selected_calendar_ids: string[]
  auto_sync_enabled: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  calendar_connection_id: string
  external_event_id: string
  calendar_id: string
  summary: string | null
  description: string | null
  start_time: string
  end_time: string
  timezone: string | null
  is_busy: boolean
  is_doer_created: boolean
  external_etag: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CalendarEventLink {
  id: string
  user_id: string
  calendar_connection_id: string
  calendar_event_id: string
  plan_id: string | null
  task_schedule_id: string | null
  task_id: string | null
  external_event_id: string
  ai_confidence: number | null
  plan_name: string | null
  task_name: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CalendarSyncLog {
  id: string
  user_id: string
  calendar_connection_id: string
  sync_type: 'pull' | 'push' | 'full_sync'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  changes_summary: Record<string, unknown>
  events_pulled: number
  events_pushed: number
  conflicts_detected: number
  plans_affected: string[]
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface GoogleCalendarEvent {
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
  attendees?: Array<{
    email: string
    responseStatus?: string
  }>
}

export interface SyncResult {
  events_pulled: number
  events_pushed: number
  conflicts_detected: number
  plans_affected: string[]
  busy_slots: BusySlot[]
  errors: string[]
}

export interface PushEventResult {
  external_event_id: string
  success: boolean
  error?: string
}


