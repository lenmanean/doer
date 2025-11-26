import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider, validateProvider } from '@/lib/calendar/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to show redirect URI configuration
 * GET /api/integrations/[provider]/debug
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
    const redirectUri = calendarProvider.getRedirectUri()

    // Get environment info (without exposing secrets)
    const envPrefix = provider.toUpperCase()
    const hasRedirectUriEnv = !!process.env[`${envPrefix}_REDIRECT_URI`]
    const hasClientId = !!process.env[`${envPrefix}_CLIENT_ID`]
    const hasClientSecret = !!process.env[`${envPrefix}_CLIENT_SECRET`]

    return NextResponse.json({
      provider,
      redirect_uri: redirectUri,
      environment: {
        node_env: process.env.NODE_ENV,
        vercel_url: process.env.VERCEL_URL,
        next_public_app_url: process.env.NEXT_PUBLIC_APP_URL,
        has_explicit_redirect_uri: hasRedirectUriEnv,
        has_client_id: hasClientId,
        has_client_secret: hasClientSecret,
      },
      message: 'Add this redirect_uri to your OAuth client in Google Cloud Console',
    })
  } catch (error) {
    logger.error(`Failed to get debug info for ${params.provider}`, error as Error)
    return NextResponse.json(
      { error: 'Failed to get debug info' },
      { status: 500 }
    )
  }
}

