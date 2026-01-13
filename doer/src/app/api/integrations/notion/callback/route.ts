import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getKnowledgeProvider } from '@/lib/knowledge/providers/provider-factory'
import { verifyOAuthState } from '@/lib/calendar/providers/shared'
import { encryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * OAuth callback endpoint for Notion
 * GET /api/integrations/notion/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    logger.error('Notion OAuth error', new Error(error))
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return NextResponse.redirect(new URL(`/integrations/notion?error=oauth_failed`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/integrations/notion?error=missing_code`, request.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.redirect(new URL(`/login?redirect=/integrations/notion`, request.url))
    }

    // Verify state parameter
    if (state) {
      if (!verifyOAuthState(state, user.id)) {
        logger.error('Invalid OAuth state parameter', new Error('State verification failed'))
        return NextResponse.redirect(new URL(`/integrations/notion?error=invalid_state`, request.url))
      }
    }

    // Get provider instance
    const provider = getKnowledgeProvider('notion')
    const redirectUri = provider.getRedirectUri()

    // Log redirect URI for debugging
    logger.info('OAuth callback for Notion', {
      redirectUri,
      hasCode: !!code,
      hasState: !!state,
      nodeEnv: process.env.NODE_ENV,
    })

    // Exchange code for tokens
    const tokens = await provider.exchangeCodeForTokens(code, redirectUri)

    // Encrypt tokens
    const accessTokenEncrypted = encryptToken(tokens.access_token)
    // Notion tokens don't expire, but store expiry if provided
    // Note: Notion OAuth response doesn't include token_expires_at, tokens are long-lived
    const expiresAt = null

    // Check if connection already exists (by user_id and workspace_id)
    const { data: existingConnection } = await supabase
      .from('notion_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', tokens.workspace_id)
      .single()

    if (existingConnection) {
      // Update existing connection (reconnection)
      const { error: updateError } = await supabase
        .from('notion_connections')
        .update({
          access_token_encrypted: accessTokenEncrypted,
          token_expires_at: expiresAt,
          workspace_name: tokens.workspace_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id)

      if (updateError) {
        logger.error('Failed to update Notion connection', updateError as Error)
        throw updateError
      }

      return NextResponse.redirect(new URL(`/integrations/notion?connected=notion&workspace_id=${tokens.workspace_id}`, request.url))
    }

    // Create new connection
    const { data: connection, error: insertError } = await supabase
      .from('notion_connections')
      .insert({
        user_id: user.id,
        workspace_id: tokens.workspace_id,
        workspace_name: tokens.workspace_name,
        access_token_encrypted: accessTokenEncrypted,
        token_expires_at: expiresAt,
        auto_context_enabled: true,
        auto_export_enabled: false,
      })
      .select('id')
      .single()

    if (insertError || !connection) {
      logger.error('Failed to create Notion connection', insertError as Error)
      throw insertError || new Error('Failed to create connection')
    }

    logger.info('Notion connection created successfully', {
      connectionId: connection.id,
      userId: user.id,
      workspaceId: tokens.workspace_id,
    })

    return NextResponse.redirect(new URL(`/integrations/notion?connected=notion&workspace_id=${tokens.workspace_id}`, request.url))
  } catch (error) {
    logger.error('Notion OAuth callback error', error as Error)
    return NextResponse.redirect(new URL(`/integrations/notion?error=callback_failed`, request.url))
  }
}

