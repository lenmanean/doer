/**
 * Calendar Provider Factory
 * Returns the appropriate provider implementation based on provider type
 */

import type { CalendarProvider } from './base-provider'
import type { CalendarProviderType } from './config'
import { validateProviderConfig } from './config'
import { GoogleCalendarProvider } from './google-provider'
import { OutlookCalendarProvider } from './outlook-provider'
// Future providers:
// import { AppleCalendarProvider } from './apple-provider'

/**
 * Get a calendar provider instance for the specified provider type
 */
export function getProvider(provider: CalendarProviderType): CalendarProvider {
  // Validate provider configuration before returning
  validateProviderConfig(provider)

  switch (provider) {
    case 'google':
      return new GoogleCalendarProvider()
    
    case 'outlook':
      return new OutlookCalendarProvider()
    
    // Future providers will be added here:
    // case 'apple':
    //   return new AppleCalendarProvider()
    
    default:
      throw new Error(`Unsupported calendar provider: ${provider}`)
  }
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): provider is CalendarProviderType {
  return ['google', 'outlook', 'apple'].includes(provider)
}

/**
 * Validate provider string and return typed provider or throw error
 */
export function validateProvider(provider: string): CalendarProviderType {
  if (!isProviderSupported(provider)) {
    throw new Error(`Invalid provider: ${provider}. Supported providers: google, outlook, apple`)
  }
  return provider
}

