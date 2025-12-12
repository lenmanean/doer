import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider, validateProvider } from '@/lib/calendar/providers/provider-factory'
import { encryptTokens } from '@/lib/calendar/providers/shared'
import { verifyOAuthState } from '@/lib/calendar/providers/shared'
import { logConnectionEvent, getClientIp, getUserAgent } from '@/lib/calendar/connection-events'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * OAuth callback endpoint for calendar provider
 * GET /api/integrations/[provider]/connect?code=...&state=...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Validate provider
  let provider: 'google' | 'outlook' | 'apple'
  try {
    provider = validateProvider(params.provider)
  } catch (error) {
    return NextResponse.redirect(new URL(`/integrations?error=invalid_provider`, request.url))
  }

  if (error) {
    logger.error(`${provider} OAuth error`, new Error(error))
    // Log OAuth failure event (will be done after we get user)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await logConnectionEvent(
        user.id,
        'oauth_failed',
        {
          details: {
            oauth_error: error,
            provider: provider,
          },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        }
      )
    }
    return NextResponse.redirect(new URL(`/integrations/${provider}?error=oauth_failed`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/integrations/${provider}?error=missing_code`, request.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.redirect(new URL(`/login?redirect=/integrations/${provider}`, request.url))
    }

    // Verify state parameter
    if (state) {
      if (!verifyOAuthState(state, user.id)) {
        logger.error('Invalid OAuth state parameter', new Error('State verification failed'))
        await logConnectionEvent(
          user.id,
          'oauth_failed',
          {
            details: {
              oauth_error: 'invalid_state',
              error_message: 'Invalid state parameter',
              provider: provider,
            },
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
          }
        )
        return NextResponse.redirect(new URL(`/integrations/${provider}?error=invalid_state`, request.url))
      }
    }

    // Get provider instance
    const calendarProvider = getProvider(provider)
    const redirectUri = calendarProvider.getRedirectUri()

    // Log redirect URI for debugging
    logger.info(`OAuth callback for ${provider}`, {
      redirectUri,
      hasCode: !!code,
      hasState: !!state,
      nodeEnv: process.env.NODE_ENV,
    })

    // Exchange code for tokens
    const tokens = await calendarProvider.exchangeCodeForTokens(code, redirectUri)

    // Encrypt tokens
    const { accessTokenEncrypted, refreshTokenEncrypted, expiresAt } = encryptTokens(tokens)

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (existingConnection) {
      // Update existing connection (reconnection)
      const { error: updateError } = await supabase
        .from('calendar_connections')
        .update({
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id)

      if (updateError) {
        logger.error('Failed to update calendar connection', updateError as Error)
        await logConnectionEvent(
          user.id,
          'oauth_failed',
          {
            connectionId: existingConnection.id,
            details: {
              error_message: updateError.message,
              error_code: updateError.code,
              provider: provider,
            },
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
          }
        )
        throw updateError
      }

      // Log reconnection event
      await logConnectionEvent(
        user.id,
        'reconnected',
        {
          connectionId: existingConnection.id,
          details: {
            provider: provider,
            expires_at: expiresAt,
          },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        }
      )

      return NextResponse.redirect(new URL(`/integrations/${provider}?connected=${provider}`, request.url))
    }

    // Create new connection
    const { data: connection, error: insertError } = await supabase
      .from('calendar_connections')
      .insert({
        user_id: user.id,
        provider: provider,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: expiresAt,
        selected_calendar_ids: [], // Will be set after user selects calendars
        auto_sync_enabled: false,
      })
      .select('id')
      .single()

    if (insertError || !connection) {
      logger.error('Failed to create calendar connection', insertError as Error)
      const errorMsg = insertError || new Error('Failed to create connection')

      // Try to log the error
      try {
        if (user) {
          await logConnectionEvent(
            user.id,
            'oauth_failed',
            {
              details: {
                error_message: errorMsg instanceof Error ? errorMsg.message : String(errorMsg),
                error_code: insertError?.code,
                provider: provider,
              },
              ipAddress: getClientIp(request),
              userAgent: getUserAgent(request),
            }
          )
        }
      } catch (logError) {
        // Ignore logging errors
      }

      throw errorMsg
    }

    // Log successful connection event
    await logConnectionEvent(
      user.id,
      'connected',
      {
        connectionId: connection.id,
        details: {
          provider: provider,
          expires_at: expiresAt,
          calendar_count: 0, // Will be populated when calendars are selected
        },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      }
    )

    return NextResponse.redirect(new URL(`/integrations/${provider}?connected=${provider}`, request.url))
  } catch (error) {
    logger.error(`Failed to connect ${provider} Calendar`, {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      provider,
    })

    // Try to log the error
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await logConnectionEvent(
          user.id,
          'oauth_failed',
          {
            details: {
              error_message: error instanceof Error ? error.message : String(error),
              provider: provider,
            },
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
          }
        )
      }
    } catch (logError) {
      // Ignore logging errors
    }

    return NextResponse.redirect(new URL(`/integrations/${provider}?error=connection_failed`, request.url))
  }
}

/**
 * OAuth callback endpoint for calendar provider (POST - for Apple form_post)
 * POST /api/integrations/[provider]/connect
 * Apple Sign in with Apple uses form_post response mode
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  // Validate provider
  let provider: 'google' | 'outlook' | 'apple'
  try {
    provider = validateProvider(params.provider)
  } catch (error) {
    return NextResponse.redirect(new URL(`/integrations?error=invalid_provider`, request.url))
  }

  // Only handle POST for Apple (form_post)
  if (provider !== 'apple') {
    return NextResponse.json({ error: 'POST not supported for this provider' }, { status: 405 })
  }

  try {
    const formData = await request.formData()
    const code = formData.get('code') as string | null
    const state = formData.get('state') as string | null
    const error = formData.get('error') as string | null

    if (error) {
      logger.error(`${provider} OAuth error`, new Error(error))
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await logConnectionEvent(
          user.id,
          'oauth_failed',
          {
            details: {
              oauth_error: error,
              provider: provider,
            },
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
          }
        )
      }
      return NextResponse.redirect(new URL(`/integrations/${provider}?error=oauth_failed`, request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL(`/integrations/${provider}?error=missing_code`, request.url))
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.redirect(new URL(`/login?redirect=/integrations/${provider}`, request.url))
    }

    // Verify state parameter
    if (state) {
      if (!verifyOAuthState(state, user.id)) {
        logger.error('Invalid OAuth state parameter', new Error('State verification failed'))
        await logConnectionEvent(
          user.id,
          'oauth_failed',
          {
            details: {
              oauth_error: 'invalid_state',
              error_message: 'Invalid state parameter',
              provider: provider,
            },
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
          }
        )
        return NextResponse.redirect(new URL(`/integrations/${provider}?error=invalid_state`, request.url))
      }
    }

    // Get provider instance
    const calendarProvider = getProvider(provider)
    const redirectUri = calendarProvider.getRedirectUri()

    // Log redirect URI for debugging
    logger.info(`OAuth callback (POST) for ${provider}`, {
      redirectUri,
      hasCode: !!code,
      hasState: !!state,
      nodeEnv: process.env.NODE_ENV,
    })

    // Exchange code for tokens
    const tokens = await calendarProvider.exchangeCodeForTokens(code, redirectUri)

    // Encrypt tokens
    const { accessTokenEncrypted, refreshTokenEncrypted, expiresAt } = encryptTokens(tokens)

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (existingConnection) {
      // Update existing connection (reconnection)
      const { error: updateError } = await supabase
        .from('calendar_connections')
        .update({
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id)

      if (updateError) {
        logger.error('Failed to update calendar connection', updateError as Error)
        await logConnectionEvent(
          user.id,
          'oauth_failed',
          {
            connectionId: existingConnection.id,
            details: {
              error_message: updateError.message,
              error_code: updateError.code,
              provider: provider,
            },
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
          }
        )
        throw updateError
      }

      // Log reconnection event
      await logConnectionEvent(
        user.id,
        'reconnected',
        {
          connectionId: existingConnection.id,
          details: {
            provider: provider,
            expires_at: expiresAt,
          },
          ipAddress: getClientIp(request),
          userAgent: getUserAgent(request),
        }
      )

      return NextResponse.redirect(new URL(`/integrations/${provider}?connected=${provider}`, request.url))
    }

    // Create new connection
    const { data: connection, error: insertError } = await supabase
      .from('calendar_connections')
      .insert({
        user_id: user.id,
        provider: provider,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: expiresAt,
        selected_calendar_ids: [], // Will be set after user selects calendars
        auto_sync_enabled: false,
      })
      .select('id')
      .single()

    if (insertError || !connection) {
      logger.error('Failed to create calendar connection', insertError as Error)
      const errorMsg = insertError || new Error('Failed to create connection')

      // Try to log the error
      try {
        if (user) {
          await logConnectionEvent(
            user.id,
            'oauth_failed',
            {
              details: {
                error_message: errorMsg instanceof Error ? errorMsg.message : String(errorMsg),
                error_code: insertError?.code,
                provider: provider,
              },
              ipAddress: getClientIp(request),
              userAgent: getUserAgent(request),
            }
          )
        }
      } catch (logError) {
        // Ignore logging errors
      }

      throw errorMsg
    }

    // Log successful connection event
    await logConnectionEvent(
      user.id,
      'connected',
      {
        connectionId: connection.id,
        details: {
          provider: provider,
          expires_at: expiresAt,
          calendar_count: 0, // Will be populated when calendars are selected
        },
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      }
    )

    return NextResponse.redirect(new URL(`/integrations/${provider}?connected=${provider}`, request.url))
  } catch (error) {
    logger.error(`Failed to connect ${provider} Calendar`, {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      provider,
    })

    // Try to log the error
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await logConnectionEvent(
          user.id,
          'oauth_failed',
          {
            details: {
              error_message: error instanceof Error ? error.message : String(error),
              provider: provider,
            },
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
          }
        )
      }
    } catch (logError) {
      // Ignore logging errors
    }

    return NextResponse.redirect(new URL(`/integrations/${provider}?error=connection_failed`, request.url))
  }
}

