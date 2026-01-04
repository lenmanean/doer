/**
 * Notification Provider Factory
 * Creates and manages notification provider instances
 */

import { SlackProvider } from './slack-provider'
import type { NotificationProvider } from './base-provider'

export type NotificationProviderType = 'slack'

/**
 * Get a notification provider instance
 */
export function getProvider(type: NotificationProviderType): NotificationProvider {
  switch (type) {
    case 'slack':
      return new SlackProvider()
    default:
      throw new Error(`Unsupported notification provider: ${type}`)
  }
}

/**
 * Check if a provider type is supported
 */
export function isProviderSupported(type: string): type is NotificationProviderType {
  return type === 'slack'
}

/**
 * Validate that a provider type is supported
 */
export function validateProvider(type: string): void {
  if (!isProviderSupported(type)) {
    throw new Error(`Invalid notification provider: ${type}. Supported providers: slack`)
  }
}

