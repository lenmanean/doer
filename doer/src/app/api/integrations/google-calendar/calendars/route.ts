import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCalendars } from '@/lib/calendar/google-calendar-sync'
import { logger } from '@/lib/logger'

/**
 * Fetch available calendars for a user
 * GET /api/integrations/google-calendar/calendars
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user's calendar connection
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()
    
    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Google Calendar connection found. Please connect your calendar first.' },
        { status: 404 }
      )
    }
    
    // Fetch calendars from Google
    const calendars = await fetchCalendars(connection.id)
    
    return NextResponse.json({
      calendars,
    })
  } catch (error) {
    logger.error('Failed to fetch calendars', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    )
  }
}


