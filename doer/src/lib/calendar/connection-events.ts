/**
 * Helper functions for logging calendar connection events
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export type ConnectionEventType =
  | 'connected'
  | 'disconnected'
  | 'token_refreshed'
  | 'token_refresh_failed'
  | 'token_expired'
  | 'settings_changed'
  | 'oauth_failed'
  | 'reconnected'
  | 'calendar_selected'
  | 'calendar_deselected'

export interface ConnectionEventDetails {
  // Connection/disconnection details
  provider?: string
  calendar_count?: number
  
  // Settings change details
  changed_fields?: string[]
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  
  // Error details
  error_message?: string
  error_code?: string
  
  // OAuth details
  oauth_error?: string
  
  // Token refresh details
  refresh_success?: boolean
  expires_at?: string
  
  // Calendar selection details
  calendar_id?: string
  calendar_name?: string
  
  // Other metadata
  [key: string]: unknown
}

/**
 * Log a calendar connection event
 */
export async function logConnectionEvent(
  userId: string,
  eventType: ConnectionEventType,
  options: {
    connectionId?: string
    details?: ConnectionEventDetails
    ipAddress?: string
    userAgent?: string
  } = {}
): Promise<void> {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('calendar_connection_events')
      .insert({
        user_id: userId,
        calendar_connection_id: options.connectionId || null,
        event_type: eventType,
        event_details: options.details || {},
        ip_address: options.ipAddress || null,
        user_agent: options.userAgent || null,
      })
    
    if (error) {
      console.error('Failed to log connection event:', error)
      // Don't throw - event logging shouldn't break the main flow
    }
  } catch (error) {
    console.error('Error logging connection event:', error)
    // Silently fail - event logging is non-critical
  }
}

/**
 * Extract IP address from NextRequest
 */
export function getClientIp(request: NextRequest): string | undefined {
  // Check various headers for IP address (handles proxies, load balancers, etc.)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  return undefined
}

/**
 * Extract user agent from NextRequest
 */
export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined
}

