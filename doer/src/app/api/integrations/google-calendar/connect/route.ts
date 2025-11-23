import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/calendar/google-calendar-sync'
import { encryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'
import { cookies } from 'next/headers'

/**
 * OAuth callback endpoint for Google Calendar
 * GET /api/integrations/google-calendar/connect?code=...&state=...
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  
  if (error) {
    logger.error('Google OAuth error', new Error(error))
    return NextResponse.redirect(new URL('/dashboard/integrations?error=oauth_failed', request.url))
  }
  
  if (!code) {
    return NextResponse.redirect(new URL('/dashboard/integrations?error=missing_code', request.url))
  }
  
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.redirect(new URL('/login?redirect=/dashboard/integrations', request.url))
    }
    
    // Verify state parameter
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())
        if (decodedState.userId !== user.id) {
          throw new Error('Invalid state parameter')
        }
      } catch (stateError) {
        logger.error('Invalid OAuth state parameter', stateError as Error)
        return NextResponse.redirect(new URL('/dashboard/integrations?error=invalid_state', request.url))
      }
    }
    
    // Exchange code for tokens - redirect URI is determined by environment variables
    // (production domain is prioritized via getRedirectUri function)
    const tokens = await exchangeCodeForTokens(code)
    
    // Encrypt tokens
    const accessTokenEncrypted = encryptToken(tokens.access_token)
    const refreshTokenEncrypted = encryptToken(tokens.refresh_token)
    const expiresAt = new Date(tokens.expiry_date).toISOString()
    
    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()
    
    if (existingConnection) {
      // Update existing connection
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
        throw updateError
      }
      
      return NextResponse.redirect(new URL('/dashboard/integrations?connected=google', request.url))
    }
    
    // Create new connection
    const { data: connection, error: insertError } = await supabase
      .from('calendar_connections')
      .insert({
        user_id: user.id,
        provider: 'google',
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
      throw insertError || new Error('Failed to create connection')
    }
    
    return NextResponse.redirect(new URL('/dashboard/integrations?connected=google', request.url))
  } catch (error) {
    logger.error('Failed to connect Google Calendar', error as Error)
    return NextResponse.redirect(new URL('/dashboard/integrations?error=connection_failed', request.url))
  }
}


