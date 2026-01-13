import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getKnowledgeProvider } from '@/lib/knowledge/providers/provider-factory'
import { generateOAuthState } from '@/lib/calendar/providers/shared'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Generate OAuth authorization URL for Notion
 * GET /api/integrations/notion/authorize
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
    const provider = getKnowledgeProvider('notion')

    // Get redirect URI for logging
    const redirectUri = provider.getRedirectUri()
    
    // Log redirect URI for debugging
    logger.info('Generating OAuth URL for Notion', {
      redirectUri,
      nodeEnv: process.env.NODE_ENV,
    })

    // Generate state parameter with user ID for security
    const state = generateOAuthState(user.id)

    // Generate OAuth URL
    const authUrl = provider.getAuthorizationUrl(state)

    return NextResponse.json({
      auth_url: authUrl,
      state,
      redirect_uri: redirectUri,
    })
  } catch (error) {
    logger.error('Failed to generate Notion OAuth URL', error as Error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}

