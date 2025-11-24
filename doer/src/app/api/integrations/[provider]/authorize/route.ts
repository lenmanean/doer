import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider, validateProvider } from '@/lib/calendar/providers/provider-factory'
import { generateOAuthState } from '@/lib/calendar/providers/shared'
import { logger } from '@/lib/logger'

/**
 * Generate OAuth authorization URL for calendar provider
 * GET /api/integrations/[provider]/authorize
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate provider
    let provider: 'google' | 'outlook' | 'apple'
    try {
      provider = validateProvider(params.provider)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid provider' },
        { status: 400 }
      )
    }

    // Get provider instance
    const calendarProvider = getProvider(provider)

    // Generate state parameter with user ID for security
    const state = generateOAuthState(user.id)

    // Generate OAuth URL
    const authUrl = await calendarProvider.generateAuthUrl(state)

    return NextResponse.json({
      auth_url: authUrl,
      state,
    })
  } catch (error) {
    logger.error(`Failed to generate ${params.provider} OAuth URL`, error as Error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}

