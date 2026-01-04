import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { verifyOAuthState } from '@/lib/calendar/providers/shared'
import { encryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * OAuth callback endpoint for Slack
 * GET /api/integrations/slack/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    logger.error('Slack OAuth error', new Error(error))
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return NextResponse.redirect(new URL(`/integrations/slack?error=oauth_failed`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/integrations/slack?error=missing_code`, request.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.redirect(new URL(`/login?redirect=/integrations/slack`, request.url))
    }

    // Verify state parameter
    if (state) {
      if (!verifyOAuthState(state, user.id)) {
        logger.error('Invalid OAuth state parameter', new Error('State verification failed'))
        return NextResponse.redirect(new URL(`/integrations/slack?error=invalid_state`, request.url))
      }
    }

    // Get provider instance
    const provider = getProvider('slack')
    const redirectUri = provider.getRedirectUri()

    // Log redirect URI for debugging
    logger.info('OAuth callback for Slack', {
      redirectUri,
      hasCode: !!code,
      hasState: !!state,
      nodeEnv: process.env.NODE_ENV,
    })

    // Exchange code for tokens with metadata
    const slackProvider = provider as import('@/lib/notifications/providers/slack-provider').SlackProvider
    const tokensWithMetadata = await slackProvider.exchangeCodeForTokensWithMetadata(code, redirectUri)

    // Encrypt tokens
    const botTokenEncrypted = encryptToken(tokensWithMetadata.access_token)
    const userTokenEncrypted = tokensWithMetadata.user_token
      ? encryptToken(tokensWithMetadata.user_token)
      : null
    const expiresAt = new Date(tokensWithMetadata.expiry_date).toISOString()

    // Default notification preferences
    const defaultNotificationPreferences = {
      plan_generation: { enabled: true, channel: null },
      schedule_generation: { enabled: true, channel: null },
      reschedule: { enabled: true, channel: null },
      task_completion: { enabled: true, channel: null },
      plan_completion: { enabled: true, channel: null },
      daily_digest: { enabled: false, time: '09:00', channel: null },
      weekly_digest: { enabled: false, day: 'monday', time: '09:00', channel: null },
    }

    // Check if connection already exists (by user_id and team_id)
    const { data: existingConnection } = await supabase
      .from('slack_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('team_id', tokensWithMetadata.team_id!)
      .single()

    if (existingConnection) {
      // Update existing connection (reconnection)
      const updateData: any = {
        bot_token_encrypted: botTokenEncrypted,
        user_token_encrypted: userTokenEncrypted,
        bot_user_id: tokensWithMetadata.bot_user_id,
        team_name: tokensWithMetadata.team_name,
        scopes: tokensWithMetadata.scopes || [],
        installed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('slack_connections')
        .update(updateData)
        .eq('id', existingConnection.id)

      if (updateError) {
        logger.error('Failed to update Slack connection', updateError as Error)
        throw updateError
      }

      return NextResponse.redirect(new URL(`/integrations/slack?connected=slack&team_id=${tokensWithMetadata.team_id}`, request.url))
    }

    // Create new connection
    const { data: connection, error: insertError } = await supabase
      .from('slack_connections')
      .insert({
        user_id: user.id,
        team_id: tokensWithMetadata.team_id!,
        team_name: tokensWithMetadata.team_name!,
        bot_token_encrypted: botTokenEncrypted,
        user_token_encrypted: userTokenEncrypted,
        bot_user_id: tokensWithMetadata.bot_user_id!,
        default_channel_id: null,
        notification_preferences: defaultNotificationPreferences,
        scopes: tokensWithMetadata.scopes || [],
        installed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !connection) {
      logger.error('Failed to create Slack connection', insertError as Error)
      throw insertError || new Error('Failed to create connection')
    }

    logger.info('Slack connection created successfully', {
      connectionId: connection.id,
      userId: user.id,
      teamId: tokensWithMetadata.team_id,
    })

    return NextResponse.redirect(new URL(`/integrations/slack?connected=slack&team_id=${tokensWithMetadata.team_id}`, request.url))
  } catch (error) {
    logger.error('Slack OAuth callback error', error as Error)
    return NextResponse.redirect(new URL(`/integrations/slack?error=callback_failed`, request.url))
  }
}

