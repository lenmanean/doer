import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider, validateProvider, type TaskManagementProviderType } from '@/lib/task-management/providers/provider-factory'
import { verifyOAuthState } from '@/lib/calendar/providers/shared'
import { encryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * OAuth callback endpoint for Asana
 * GET /api/integrations/asana/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    logger.error('Asana OAuth error', new Error(error))
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // Log error event if needed (similar to calendar connections)
    return NextResponse.redirect(new URL(`/integrations/asana?error=oauth_failed`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/integrations/asana?error=missing_code`, request.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.redirect(new URL(`/login?redirect=/integrations/asana`, request.url))
    }

    // Verify state parameter
    if (state) {
      if (!verifyOAuthState(state, user.id)) {
        logger.error('Invalid OAuth state parameter', new Error('State verification failed'))
        return NextResponse.redirect(new URL(`/integrations/asana?error=invalid_state`, request.url))
      }
    }

    // Get provider instance
    // Validate provider first to ensure it's supported (defensive check)
    let provider
    try {
      const providerString = 'asana'
      const providerType = validateProvider(providerString)
      logger.info('Getting Asana provider instance in callback', {
        providerString,
        providerType,
        typeOf: typeof providerType,
      })
      provider = getProvider(providerType)
    } catch (providerError) {
      logger.error('Failed to get Asana provider instance', {
        error: providerError instanceof Error ? providerError.message : String(providerError),
        errorStack: providerError instanceof Error ? providerError.stack : undefined,
        errorName: providerError instanceof Error ? providerError.name : undefined,
      })
      throw providerError
    }
    const redirectUri = provider.getRedirectUri()

    // Log redirect URI for debugging
    logger.info('OAuth callback for Asana', {
      redirectUri,
      hasCode: !!code,
      hasState: !!state,
      nodeEnv: process.env.NODE_ENV,
    })

    // Exchange code for tokens
    let tokens
    try {
      tokens = await provider.exchangeCodeForTokens(code, redirectUri)
    } catch (tokenError) {
      logger.error('Failed to exchange Asana OAuth code for tokens', {
        error: tokenError instanceof Error ? tokenError.message : String(tokenError),
        errorStack: tokenError instanceof Error ? tokenError.stack : undefined,
        hasCode: !!code,
        redirectUri,
      })
      throw tokenError
    }

    // Encrypt tokens
    let accessTokenEncrypted: string
    let refreshTokenEncrypted: string = ''
    try {
      accessTokenEncrypted = encryptToken(tokens.access_token)
      refreshTokenEncrypted = tokens.refresh_token ? encryptToken(tokens.refresh_token) : ''
    } catch (encryptError) {
      logger.error('Failed to encrypt Asana tokens', {
        error: encryptError instanceof Error ? encryptError.message : String(encryptError),
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
      })
      throw new Error('Failed to encrypt tokens for storage')
    }
    
    const expiresAt = new Date(tokens.expiry_date).toISOString()

    // Check if connection already exists
    const { data: existingConnection, error: checkError } = await supabase
      .from('task_management_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'asana')
      .maybeSingle()
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected when no connection exists
      logger.error('Error checking for existing Asana connection', {
        error: checkError,
        errorMessage: checkError.message,
        errorCode: checkError.code,
      })
      throw checkError
    }

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
        logger.error('Failed to update Asana connection', {
          error: updateError,
          errorMessage: updateError.message,
          errorCode: updateError.code,
          errorDetails: updateError.details,
          connectionId: existingConnection.id,
        })
        throw updateError
      }

      return NextResponse.redirect(new URL(`/integrations/asana?connected=asana`, request.url))
    }

    // Create new connection
    const { data: connection, error: insertError } = await supabase
      .from('task_management_connections')
      .insert({
        user_id: user.id,
        provider: 'asana',
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted || null,
        token_expires_at: expiresAt,
        auto_push_enabled: false,
        auto_completion_sync: false,
      })
      .select('id')
      .single()

    if (insertError || !connection) {
      logger.error('Failed to create Asana connection', {
        error: insertError,
        errorMessage: insertError?.message,
        errorCode: insertError?.code,
        errorDetails: insertError?.details,
        hasConnection: !!connection,
      })
      throw insertError || new Error('Failed to create connection')
    }

    return NextResponse.redirect(new URL(`/integrations/asana?connected=asana`, request.url))
  } catch (error) {
    // Log comprehensive error information
    const errorDetails = {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      // Check for specific error types
      isProviderError: error instanceof Error && error.message.includes('provider'),
      isValidationError: error instanceof Error && error.message.includes('Invalid provider'),
      isDatabaseError: error && typeof error === 'object' && 'code' in error,
      // Include database error details if present
      dbErrorCode: error && typeof error === 'object' && 'code' in error ? (error as any).code : undefined,
      dbErrorMessage: error && typeof error === 'object' && 'message' in error ? (error as any).message : undefined,
      dbErrorDetails: error && typeof error === 'object' && 'details' in error ? (error as any).details : undefined,
      // Include request context
      hasCode: !!code,
      hasState: !!state,
      rawError: error,
    }
    
    logger.error('🚨 FAILED TO CONNECT ASANA - DETAILED ERROR', errorDetails)

    // Provide more specific error message in redirect if possible
    let errorParam = 'connection_failed'
    if (error instanceof Error) {
      if (error.message.includes('Invalid provider') || error.message.includes('Unsupported')) {
        errorParam = 'provider_error'
      } else if (error.message.includes('ASANA_CLIENT_ID') || error.message.includes('ASANA_CLIENT_SECRET')) {
        errorParam = 'config_error'
      } else if (error.message.includes('database') || error.message.includes('connection') || (error && typeof error === 'object' && 'code' in error)) {
        errorParam = 'database_error'
      }
    }

    return NextResponse.redirect(new URL(`/integrations/asana?error=${errorParam}`, request.url))
  }
}

