import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/task-management/providers/provider-factory'
import { encryptTokens, verifyOAuthState } from '@/lib/calendar/providers/shared'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * OAuth callback endpoint for Todoist
 * GET /api/integrations/todoist/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    logger.error('Todoist OAuth error', new Error(error))
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // Log error event if needed (similar to calendar connections)
    return NextResponse.redirect(new URL(`/integrations/todoist?error=oauth_failed`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/integrations/todoist?error=missing_code`, request.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.redirect(new URL(`/login?redirect=/integrations/todoist`, request.url))
    }

    // Verify state parameter
    if (state) {
      if (!verifyOAuthState(state, user.id)) {
        logger.error('Invalid OAuth state parameter', new Error('State verification failed'))
        return NextResponse.redirect(new URL(`/integrations/todoist?error=invalid_state`, request.url))
      }
    }

    // Get provider instance
    const provider = getProvider('todoist')
    const redirectUri = provider.getRedirectUri()

    // Log redirect URI for debugging
    logger.info('OAuth callback for Todoist', {
      redirectUri,
      hasCode: !!code,
      hasState: !!state,
      nodeEnv: process.env.NODE_ENV,
    })

    // Exchange code for tokens
    const tokens = await provider.exchangeCodeForTokens(code, redirectUri)

    // Encrypt tokens
    const { accessTokenEncrypted, refreshTokenEncrypted, expiresAt } = encryptTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      expiry_date: tokens.expiry_date,
    })

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('task_management_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'todoist')
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
        logger.error('Failed to update Todoist connection', updateError as Error)
        throw updateError
      }

      return NextResponse.redirect(new URL(`/integrations/todoist?connected=todoist`, request.url))
    }

    // Create new connection
    const { data: connection, error: insertError } = await supabase
      .from('task_management_connections')
      .insert({
        user_id: user.id,
        provider: 'todoist',
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted || null,
        token_expires_at: expiresAt,
        auto_push_enabled: false,
        auto_completion_sync: false,
      })
      .select('id')
      .single()

    if (insertError || !connection) {
      logger.error('Failed to create Todoist connection', insertError as Error)
      throw insertError || new Error('Failed to create connection')
    }

    return NextResponse.redirect(new URL(`/integrations/todoist?connected=todoist`, request.url))
  } catch (error) {
    logger.error('Failed to connect Todoist', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.redirect(new URL(`/integrations/todoist?error=connection_failed`, request.url))
  }
}

