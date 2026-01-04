import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider, validateProvider, type TaskManagementProviderType } from '@/lib/task-management/providers/provider-factory'
import { generateOAuthState } from '@/lib/calendar/providers/shared'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Generate OAuth authorization URL for Asana
 * GET /api/integrations/asana/authorize
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

    // Get provider instance
    // Validate provider first to ensure it's supported (defensive check)
    const providerString = 'asana'
    const providerType = validateProvider(providerString)
    logger.info('Getting Asana provider instance', {
      providerString,
      providerType,
      typeOf: typeof providerType,
    })
    const provider = getProvider(providerType)

    // Get redirect URI for logging
    const redirectUri = provider.getRedirectUri()
    
    // Log redirect URI for debugging
    logger.info('Generating OAuth URL for Asana', {
      redirectUri,
      nodeEnv: process.env.NODE_ENV,
    })

    // Generate state parameter with user ID for security
    const state = generateOAuthState(user.id)

    // Generate OAuth URL
    const authUrl = await provider.generateAuthUrl(state)

    return NextResponse.json({
      auth_url: authUrl,
      state,
      redirect_uri: redirectUri,
    })
  } catch (error) {
    logger.error('Failed to generate Asana OAuth URL', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    
    // Provide more specific error messages
    let errorMessage = 'Failed to generate authorization URL'
    if (error instanceof Error) {
      if (error.message.includes('ASANA_CLIENT_ID') || error.message.includes('ASANA_CLIENT_SECRET')) {
        errorMessage = 'Asana integration is not properly configured. Please contact support.'
      } else if (error.message.includes('environment variable')) {
        errorMessage = 'Asana integration configuration is missing. Please contact support.'
      } else {
        errorMessage = error.message
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

