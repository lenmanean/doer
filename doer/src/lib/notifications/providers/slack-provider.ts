/**
 * Slack Provider Implementation
 * Implements NotificationProvider interface for Slack integration
 */

import { createClient } from '@/lib/supabase/server'
import { encryptToken, decryptToken } from '@/lib/calendar/encryption'
import { logger } from '@/lib/logger'
import type {
  NotificationProvider,
  Tokens,
  NotificationPayload,
  Channel,
} from './base-provider'
import crypto from 'crypto'

const SLACK_API_BASE = 'https://slack.com/api'

/**
 * Slack API Error Response
 */
interface SlackError {
  ok: boolean
  error?: string
  warning?: string
}

/**
 * Slack OAuth Response
 */
interface SlackOAuthResponse {
  ok: boolean
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  bot_user_id?: string
  app_id?: string
  team?: {
    id: string
    name: string
  }
  authed_user?: {
    id: string
    access_token?: string
  }
  error?: string
}

/**
 * Slack Channel Response
 */
interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_im: boolean
  is_channel: boolean
  is_group: boolean
}

/**
 * Slack Channels List Response
 */
interface SlackChannelsResponse {
  ok: boolean
  channels?: SlackChannel[]
  error?: string
  response_metadata?: {
    next_cursor?: string
  }
}

/**
 * Slack User Info Response
 */
interface SlackUserInfoResponse {
  ok: boolean
  user?: {
    id: string
    name: string
    real_name?: string
    profile?: {
      display_name?: string
      email?: string
    }
  }
  error?: string
}

/**
 * Slack Chat PostMessage Response
 */
interface SlackChatPostMessageResponse {
  ok: boolean
  channel?: string
  ts?: string
  message?: any
  error?: string
}

/**
 * Slack Provider
 */
export class SlackProvider implements NotificationProvider {
  private readonly provider = 'slack' as const

  validateConfig(): void {
    if (!process.env.SLACK_CLIENT_ID) {
      throw new Error('SLACK_CLIENT_ID environment variable is not set')
    }
    if (!process.env.SLACK_CLIENT_SECRET) {
      throw new Error('SLACK_CLIENT_SECRET environment variable is not set')
    }
    if (!process.env.SLACK_SIGNING_SECRET) {
      throw new Error('SLACK_SIGNING_SECRET environment variable is not set')
    }
  }

  getRedirectUri(): string {
    // First priority: explicit URL from environment
    if (process.env.SLACK_REDIRECT_URI) {
      return process.env.SLACK_REDIRECT_URI.trim()
    }

    // Second priority: explicit URL from NEXT_PUBLIC_APP_URL
    if (process.env.NEXT_PUBLIC_APP_URL) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL.trim()
      const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
      return `${baseUrl}/api/integrations/slack/callback`
    }

    // Third priority: production domain (usedoer.com) - always use https
    const nodeEnv = process.env.NODE_ENV as string | undefined
    const vercelEnv = process.env.VERCEL_ENV as string | undefined
    const isProduction = vercelEnv === 'production' ||
                        nodeEnv === 'production' ||
                        (!nodeEnv && process.env.VERCEL)

    if (isProduction) {
      return `https://usedoer.com/api/integrations/slack/callback`
    }

    // Fourth priority: Vercel preview/deployment URL
    if (process.env.VERCEL_URL && vercelEnv !== 'production') {
      const vercelUrl = process.env.VERCEL_URL.trim()
      const baseUrl = vercelUrl.startsWith('https://')
        ? vercelUrl
        : `https://${vercelUrl}`
      return `${baseUrl}/api/integrations/slack/callback`
    }

    // Last resort: localhost (development only)
    return `http://localhost:3000/api/integrations/slack/callback`
  }

  async generateAuthUrl(state?: string): Promise<string> {
    this.validateConfig()
    const clientId = process.env.SLACK_CLIENT_ID!
    const redirectUri = this.getRedirectUri()

    const scopes = [
      'chat:write',
      'commands',
      'users:read',
      'channels:read',
      'groups:read',
      'chat:write.public',
    ].join(',')

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      ...(state && { state }),
    })

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens> {
    const result = await this.exchangeCodeForTokensWithMetadata(code, redirectUri)
    return {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expiry_date: result.expiry_date,
    }
  }

  /**
   * Exchange code for tokens and return full OAuth response metadata
   * Used by callback route to extract team_id, bot_user_id, etc.
   */
  async exchangeCodeForTokensWithMetadata(
    code: string,
    redirectUri: string
  ): Promise<Tokens & {
    user_token?: string
    team_id?: string
    team_name?: string
    bot_user_id?: string
    scopes?: string[]
  }> {
    this.validateConfig()
    const clientId = process.env.SLACK_CLIENT_ID!
    const clientSecret = process.env.SLACK_CLIENT_SECRET!

    const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const error: SlackOAuthResponse = await response.json().catch(() => ({ ok: false, error: 'Unknown error' }))
      throw new Error(`Failed to exchange code for tokens: ${error.error || response.statusText}`)
    }

    const data: SlackOAuthResponse = await response.json()

    if (!data.ok || !data.access_token) {
      throw new Error(`Slack OAuth error: ${data.error || 'Unknown error'}`)
    }

    if (!data.team || !data.bot_user_id) {
      throw new Error('Missing required OAuth response data (team or bot_user_id)')
    }

    // Calculate expiry date (default to 1 hour if not provided)
    const expiryDate = data.expires_in
      ? Date.now() + (data.expires_in * 1000)
      : Date.now() + 3600000

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: expiryDate,
      user_token: data.authed_user?.access_token,
      team_id: data.team.id,
      team_name: data.team.name,
      bot_user_id: data.bot_user_id,
      scopes: data.scope ? data.scope.split(',') : [],
    }
  }

  async refreshAccessToken(connectionId: string): Promise<Tokens> {
    // Slack tokens don't expire in the traditional sense, but we can check validity
    // For now, return existing token (Slack handles token refresh differently)
    const supabase = await createClient()

    const { data: connection, error } = await supabase
      .from('slack_connections')
      .select('id, bot_token_encrypted, user_token_encrypted')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    const botToken = decryptToken(connection.bot_token_encrypted)
    const userToken = connection.user_token_encrypted
      ? decryptToken(connection.user_token_encrypted)
      : undefined

    // Test token validity by calling auth.test
    const testResponse = await fetch(`${SLACK_API_BASE}/auth.test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!testResponse.ok) {
      const errorData: SlackError = await testResponse.json().catch(() => ({ ok: false }))
      if (errorData.error === 'invalid_auth' || errorData.error === 'token_expired') {
        throw new Error('Slack token expired or invalid - reconnection required')
      }
    }

    // Return existing token (Slack doesn't use refresh tokens in the same way)
    return {
      access_token: botToken,
      refresh_token: userToken,
      expiry_date: Date.now() + 3600000, // Set to 1 hour from now
    }
  }

  async sendNotification(
    connectionId: string,
    notification: NotificationPayload
  ): Promise<boolean> {
    const channelId = notification.channelId
    if (!channelId) {
      throw new Error('Channel ID is required for notification')
    }

    if (notification.blocks) {
      return this.sendBlockKitMessage(connectionId, channelId, notification.blocks)
    }

    if (!notification.text) {
      throw new Error('Either blocks or text is required for notification')
    }

    return this.sendMessage(connectionId, channelId, notification.text, notification.threadTs)
  }

  async sendBlockKitMessage(
    connectionId: string,
    channelId: string,
    blocks: any[]
  ): Promise<boolean> {
    const supabase = await createClient()

    const { data: connection, error } = await supabase
      .from('slack_connections')
      .select('id, bot_token_encrypted')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      logger.error('Slack connection not found', { connectionId, error })
      return false
    }

    const botToken = decryptToken(connection.bot_token_encrypted)

    const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        blocks,
        text: 'DOER notification', // Fallback text
      }),
    })

    if (!response.ok) {
      const errorData: SlackChatPostMessageResponse = await response.json().catch(() => ({ ok: false }))
      logger.error('Failed to send Slack message', {
        connectionId,
        channelId,
        error: errorData.error,
      })
      return false
    }

    const data: SlackChatPostMessageResponse = await response.json()
    return data.ok === true
  }

  async sendMessage(
    connectionId: string,
    channelId: string,
    text: string,
    threadTs?: string
  ): Promise<boolean> {
    const supabase = await createClient()

    const { data: connection, error } = await supabase
      .from('slack_connections')
      .select('id, bot_token_encrypted')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      logger.error('Slack connection not found', { connectionId, error })
      return false
    }

    const botToken = decryptToken(connection.bot_token_encrypted)

    const payload: any = {
      channel: channelId,
      text,
    }

    if (threadTs) {
      payload.thread_ts = threadTs
    }

    const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData: SlackChatPostMessageResponse = await response.json().catch(() => ({ ok: false }))
      logger.error('Failed to send Slack message', {
        connectionId,
        channelId,
        error: errorData.error,
      })
      return false
    }

    const data: SlackChatPostMessageResponse = await response.json()
    return data.ok === true
  }

  async getChannels(connectionId: string): Promise<Channel[]> {
    const supabase = await createClient()

    const { data: connection, error } = await supabase
      .from('slack_connections')
      .select('id, bot_token_encrypted')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      logger.error('Slack connection not found for getChannels', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error(`Connection not found: ${connectionId}`)
    }

    const botToken = decryptToken(connection.bot_token_encrypted)
    const tokenPreview = botToken.length > 4 ? `...${botToken.slice(-4)}` : '***'

    try {
      // Fetch channels with pagination support
      const allChannels: SlackChannel[] = []
      let cursor: string | undefined = undefined
      let hasMore = true

      while (hasMore) {
        const params = new URLSearchParams({
          types: 'public_channel,private_channel',
          exclude_archived: 'true',
          limit: '200',
        })
        if (cursor) {
          params.append('cursor', cursor)
        }

        const channelsResponse = await fetch(`${SLACK_API_BASE}/conversations.list?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (!channelsResponse.ok) {
          const errorText = await channelsResponse.text()
          logger.error('Failed to fetch Slack channels - HTTP error', {
            connectionId,
            status: channelsResponse.status,
            statusText: channelsResponse.statusText,
            errorText,
            tokenPreview,
          })
          throw new Error(`Failed to fetch channels: HTTP ${channelsResponse.status}`)
        }

        const channelsData: SlackChannelsResponse = await channelsResponse.json()

        if (!channelsData.ok) {
          logger.error('Slack API error in conversations.list', {
            connectionId,
            error: channelsData.error || 'Unknown error',
            tokenPreview,
          })
          throw new Error(`Slack API error: ${channelsData.error || 'Unknown error'}`)
        }

        if (channelsData.channels) {
          allChannels.push(...channelsData.channels)
        }

        // Check for pagination
        cursor = channelsData.response_metadata?.next_cursor
        hasMore = !!cursor && cursor.length > 0
      }

      logger.info('Successfully fetched Slack channels', {
        connectionId,
        channelCount: allChannels.length,
        tokenPreview,
      })

      return allChannels.map(channel => ({
        id: channel.id,
        name: channel.name || channel.id,
        is_private: channel.is_private || false,
        is_im: channel.is_im || false,
      }))
    } catch (error) {
      logger.error('Error in getChannels', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        tokenPreview,
      })
      throw error
    }
  }

  async getUserInfo(connectionId: string, userId: string): Promise<any> {
    const supabase = await createClient()

    const { data: connection, error } = await supabase
      .from('slack_connections')
      .select('id, bot_token_encrypted')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error(`Connection not found: ${connectionId}`)
    }

    const botToken = decryptToken(connection.bot_token_encrypted)

    const response = await fetch(`${SLACK_API_BASE}/users.info?user=${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData: SlackUserInfoResponse = await response.json().catch(() => ({ ok: false }))
      throw new Error(`Failed to fetch user info: ${errorData.error || 'Unknown error'}`)
    }

    const data: SlackUserInfoResponse = await response.json()

    if (!data.ok || !data.user) {
      throw new Error(`Slack API error: ${data.error || 'Unknown error'}`)
    }

    return data.user
  }

  verifyRequest(timestamp: string, signature: string, body: string): boolean {
    this.validateConfig()
    const signingSecret = process.env.SLACK_SIGNING_SECRET!

    // Check timestamp to prevent replay attacks (within 5 minutes)
    const requestTimestamp = parseInt(timestamp, 10)
    const currentTimestamp = Math.floor(Date.now() / 1000)
    if (Math.abs(currentTimestamp - requestTimestamp) > 300) {
      logger.warn('Slack request timestamp too old or too far in future', {
        requestTimestamp,
        currentTimestamp,
        difference: Math.abs(currentTimestamp - requestTimestamp),
      })
      return false
    }

    // Create signature base string
    const sigBaseString = `v0:${timestamp}:${body}`

    // Create HMAC signature
    const hmac = crypto.createHmac('sha256', signingSecret)
    hmac.update(sigBaseString)
    const expectedSignature = `v0=${hmac.digest('hex')}`

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }
}

