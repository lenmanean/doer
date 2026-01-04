import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/task-management/providers/provider-factory'
import { verifyOAuthState } from '@/lib/calendar/providers/shared'
import { encryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * OAuth callback endpoint for Trello
 * GET /api/integrations/trello/callback#token=...&state=...
 * 
 * Note: Trello returns token in URL hash fragment, not query params
 * This requires client-side JavaScript to extract and send to server
 */
export async function GET(request: NextRequest) {
  // Trello returns token in hash fragment, which is not accessible server-side
  // We need to handle this via a client-side redirect page
  // For now, check if token is in query params (fallback) or hash
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get('token')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    logger.error('Trello OAuth error', new Error(error))
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return NextResponse.redirect(new URL(`/integrations/trello?error=oauth_failed`, request.url))
  }

  // If token is not in query params, it's likely in the hash fragment
  // Return a page that will extract it client-side
  if (!token) {
    // Return HTML page that extracts token from hash and redirects
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connecting Trello...</title>
        </head>
        <body>
          <script>
            // Extract token from URL hash
            const hash = window.location.hash.substring(1)
            const params = new URLSearchParams(hash)
            const token = params.get('token')
            const state = params.get('state')
            
            if (token) {
              // Redirect to server endpoint with token in query params
              const currentUrl = new URL(window.location.href)
              currentUrl.hash = ''
              currentUrl.searchParams.set('token', token)
              if (state) {
                currentUrl.searchParams.set('state', state)
              }
              window.location.href = currentUrl.toString()
            } else {
              // No token found, redirect to error page
              window.location.href = '/integrations/trello?error=missing_token'
            }
          </script>
          <p>Connecting Trello...</p>
        </body>
      </html>
    `
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.redirect(new URL(`/login?redirect=/integrations/trello`, request.url))
    }

    // Verify state parameter
    if (state) {
      if (!verifyOAuthState(state, user.id)) {
        logger.error('Invalid OAuth state parameter', new Error('State verification failed'))
        return NextResponse.redirect(new URL(`/integrations/trello?error=invalid_state`, request.url))
      }
    }

    // Get provider instance
    const provider = getProvider('trello')
    const redirectUri = provider.getRedirectUri()

    // Log redirect URI for debugging
    logger.info('OAuth callback for Trello', {
      redirectUri,
      hasToken: !!token,
      hasState: !!state,
      nodeEnv: process.env.NODE_ENV,
    })

    // Exchange token (Trello returns token directly, not a code)
    const tokens = await provider.exchangeCodeForTokens(token, redirectUri)

    // Encrypt tokens
    // Trello doesn't provide refresh tokens, so handle it conditionally
    const accessTokenEncrypted = encryptToken(tokens.access_token)
    const refreshTokenEncrypted = tokens.refresh_token ? encryptToken(tokens.refresh_token) : ''
    const expiresAt = new Date(tokens.expiry_date).toISOString()

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('task_management_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'trello')
      .single()

    if (existingConnection) {
      // Update existing connection (reconnection)
      const updateData: any = {
        access_token_encrypted: accessTokenEncrypted,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }
      if (refreshTokenEncrypted) {
        updateData.refresh_token_encrypted = refreshTokenEncrypted
      }

      const { error: updateError } = await supabase
        .from('task_management_connections')
        .update(updateData)
        .eq('id', existingConnection.id)

      if (updateError) {
        logger.error('Failed to update Trello connection', updateError as Error)
        throw updateError
      }

      return NextResponse.redirect(new URL(`/integrations/trello?connected=trello`, request.url))
    }

    // Create new connection
    const { data: connection, error: insertError } = await supabase
      .from('task_management_connections')
      .insert({
        user_id: user.id,
        provider: 'trello',
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted || null,
        token_expires_at: expiresAt,
        auto_push_enabled: false,
        auto_completion_sync: false,
      })
      .select('id')
      .single()

    if (insertError || !connection) {
      logger.error('Failed to create Trello connection', insertError as Error)
      throw insertError || new Error('Failed to create connection')
    }

    return NextResponse.redirect(new URL(`/integrations/trello?connected=trello`, request.url))
  } catch (error) {
    logger.error('Failed to connect Trello', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.redirect(new URL(`/integrations/trello?error=connection_failed`, request.url))
  }
}

