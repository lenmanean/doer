import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'
import { serverLogger } from '@/lib/logger/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Consolidated cron job endpoint for daily tasks
 * Runs daily at midnight UTC via Vercel Cron
 * 
 * Handles:
 * 1. Calendar sync
 * 2. Waitlist email drip
 * 3. Process scheduled account deletions
 * 
 * Security: Verifies cron secret from Vercel
 * Uses service role client to bypass RLS for cron operations
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron request to daily-tasks', { hasAuthHeader: !!authHeader })
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const results = {
    calendarSync: { success: false, error: null as string | null },
    waitlistDrip: { success: false, error: null as string | null },
    scheduledDeletions: { success: false, error: null as string | null },
  }

  // Task 1: Calendar Sync
  try {
    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'}/api/cron/sync-calendars`, {
      method: 'GET',
      headers: {
        'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
      },
    })
    
    if (syncResponse.ok) {
      results.calendarSync.success = true
      logger.info('Calendar sync completed via daily-tasks cron')
    } else {
      const errorData = await syncResponse.json().catch(() => ({}))
      results.calendarSync.error = errorData.error || `HTTP ${syncResponse.status}`
      logger.error('Calendar sync failed in daily-tasks cron', { error: results.calendarSync.error })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    results.calendarSync.error = errorMessage
    logger.error('Calendar sync error in daily-tasks cron', { error: errorMessage })
  }

  // Task 2: Waitlist Drip
  try {
    const waitlistResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'}/api/cron/waitlist-drip`, {
      method: 'GET',
      headers: {
        'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
      },
    })
    
    if (waitlistResponse.ok) {
      results.waitlistDrip.success = true
      logger.info('Waitlist drip completed via daily-tasks cron')
    } else {
      const errorData = await waitlistResponse.json().catch(() => ({}))
      results.waitlistDrip.error = errorData.error || `HTTP ${waitlistResponse.status}`
      logger.error('Waitlist drip failed in daily-tasks cron', { error: results.waitlistDrip.error })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    results.waitlistDrip.error = errorMessage
    logger.error('Waitlist drip error in daily-tasks cron', { error: errorMessage })
  }

  // Task 3: Process Scheduled Deletions
  try {
    const deletionsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'}/api/cron/process-scheduled-deletions`, {
      method: 'GET',
      headers: {
        'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
      },
    })
    
    if (deletionsResponse.ok) {
      results.scheduledDeletions.success = true
      logger.info('Scheduled deletions completed via daily-tasks cron')
    } else {
      const errorData = await deletionsResponse.json().catch(() => ({}))
      results.scheduledDeletions.error = errorData.error || `HTTP ${deletionsResponse.status}`
      logger.error('Scheduled deletions failed in daily-tasks cron', { error: results.scheduledDeletions.error })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    results.scheduledDeletions.error = errorMessage
    logger.error('Scheduled deletions error in daily-tasks cron', { error: errorMessage })
  }

  const allSuccessful = results.calendarSync.success && results.waitlistDrip.success && results.scheduledDeletions.success

  return NextResponse.json({
    success: allSuccessful,
    results,
    timestamp: new Date().toISOString(),
  })
}

