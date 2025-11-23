import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAuthUrl } from '@/lib/calendar/google-calendar-sync'
import { logger } from '@/lib/logger'

/**
 * Generate Google OAuth authorization URL
 * GET /api/integrations/google-calendar/authorize
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
    
    // Generate state parameter with user ID for security
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')
    
    // Generate OAuth URL - redirect URI is determined by environment variables
    // (production domain is prioritized via getRedirectUri function)
    const authUrl = await generateAuthUrl(state)
    
    return NextResponse.json({
      auth_url: authUrl,
      state,
    })
  } catch (error) {
    logger.error('Failed to generate Google OAuth URL', error as Error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}


