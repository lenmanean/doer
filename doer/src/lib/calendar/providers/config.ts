/**
 * Provider Configuration Management
 * Handles provider-specific environment variables and configuration validation
 */

export type CalendarProviderType = 'google' | 'outlook' | 'apple'

export interface ProviderConfig {
  clientId: string
  clientSecret: string
  redirectUri?: string
}

/**
 * Get provider configuration from environment variables
 */
export function getProviderConfig(provider: CalendarProviderType): ProviderConfig {
  const envPrefix = provider.toUpperCase()
  
  const clientId = process.env[`${envPrefix}_CLIENT_ID`]
  const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`]
  const redirectUri = process.env[`${envPrefix}_REDIRECT_URI`]

  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing configuration for ${provider} provider. ` +
      `Required environment variables: ${envPrefix}_CLIENT_ID, ${envPrefix}_CLIENT_SECRET`
    )
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  }
}

/**
 * Validate that a provider has required configuration
 */
export function validateProviderConfig(provider: CalendarProviderType): void {
  try {
    getProviderConfig(provider)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Invalid configuration for ${provider} provider`)
  }
}

/**
 * Get redirect URI for a provider
 * Prioritizes explicit env var, then constructs from app URL
 */
export function getProviderRedirectUri(
  provider: CalendarProviderType,
  requestOrigin?: string
): string {
  const config = getProviderConfig(provider)
  
  // First priority: explicit redirect URI from environment
  if (config.redirectUri) {
    return config.redirectUri.trim()
  }
  
  // Second priority: production URL from NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL.trim()
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
    return `${baseUrl}/api/integrations/${provider}/connect`
  }
  
  // Third priority: production domain (usedoer.com)
  if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
    return `https://usedoer.com/api/integrations/${provider}/connect`
  }
  
  // Fourth priority: Vercel production URL
  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL.trim()
    const baseUrl = vercelUrl.startsWith('https://') 
      ? vercelUrl 
      : `https://${vercelUrl}`
    return `${baseUrl}/api/integrations/${provider}/connect`
  }
  
  // Fifth priority: request origin (development fallback)
  if (requestOrigin && process.env.NODE_ENV === 'development') {
    return `${requestOrigin}/api/integrations/${provider}/connect`
  }
  
  // Last resort: localhost
  console.warn(`⚠️ Using localhost redirect URI for ${provider}. Set ${provider.toUpperCase()}_REDIRECT_URI or NEXT_PUBLIC_APP_URL.`)
  return `http://localhost:3000/api/integrations/${provider}/connect`
}

