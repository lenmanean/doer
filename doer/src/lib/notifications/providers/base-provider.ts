/**
 * Base Notification Provider Interface
 * Defines the contract that all notification providers (Slack, etc.) must implement
 */

/**
 * OAuth tokens returned from provider
 */
export interface Tokens {
  access_token: string
  refresh_token?: string // Optional, depends on provider
  expiry_date: number
}

/**
 * Notification payload for sending messages
 */
export interface NotificationPayload {
  channelId?: string
  blocks?: any[] // Block Kit blocks
  text?: string // Fallback text
  threadTs?: string // Thread timestamp for replies
}

/**
 * Channel representation from provider
 */
export interface Channel {
  id: string
  name: string
  is_private?: boolean
  is_im?: boolean // Direct message channel
}

/**
 * Notification Provider Interface
 * All notification providers must implement this interface
 */
export interface NotificationProvider {
  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state?: string): Promise<string>

  /**
   * Exchange authorization code for access and refresh tokens
   */
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<Tokens>

  /**
   * Refresh access token using refresh token (if supported)
   */
  refreshAccessToken(connectionId: string): Promise<Tokens>

  /**
   * Get the OAuth redirect URI for this provider
   */
  getRedirectUri(): string

  /**
   * Send a notification message
   */
  sendNotification(
    connectionId: string,
    notification: NotificationPayload
  ): Promise<boolean>

  /**
   * Send a Block Kit formatted message
   */
  sendBlockKitMessage(
    connectionId: string,
    channelId: string,
    blocks: any[]
  ): Promise<boolean>

  /**
   * Fetch list of available channels for the user
   */
  getChannels(connectionId: string): Promise<Channel[]>

  /**
   * Get user information
   */
  getUserInfo(connectionId: string, userId: string): Promise<any>

  /**
   * Verify request signature (for webhooks, commands, interactive)
   */
  verifyRequest(timestamp: string, signature: string, body: string): boolean

  /**
   * Validate that required configuration (env vars, etc.) is present
   * Throws error if configuration is invalid
   */
  validateConfig(): void
}

