/**
 * Provider-Agnostic Busy Slot Helper
 * Wraps the database RPC function that aggregates busy slots from all providers
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { BusySlot } from './types'

/**
 * Get busy slots for a user within a date range
 * This function aggregates busy slots from ALL calendar providers automatically
 * via the database RPC function which joins across calendar_connections
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
    logger.error('Failed to get busy slots', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId,
    })
    return []
  }

  return (data || []).map((slot: any) => ({
    start: slot.start_time,
    end: slot.end_time,
    source: 'calendar_event' as const,
    metadata: {
      summary: slot.summary,
      is_doer_created: slot.is_doer_created,
      ...slot.metadata,
    },
  }))
}

