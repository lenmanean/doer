/**
 * Task Management Provider Factory
 * Returns the appropriate provider implementation based on provider type
 */

import type { TaskManagementProvider } from './base-provider'
import { TodoistProvider } from './todoist-provider'
import { AsanaProvider } from './asana-provider'

export type TaskManagementProviderType = 'todoist' | 'asana'

/**
 * Get a task management provider instance for the specified provider type
 */
export function getProvider(provider: TaskManagementProviderType): TaskManagementProvider {
  // Normalize provider string to ensure exact match
  const normalizedProvider = String(provider).toLowerCase().trim() as TaskManagementProviderType
  
  switch (normalizedProvider) {
    case 'todoist':
      return new TodoistProvider()
    case 'asana':
      return new AsanaProvider()
    
    default:
      // Log the actual value for debugging
      console.error('Provider factory received unexpected value:', {
        provider,
        normalizedProvider,
        type: typeof provider,
        length: String(provider).length,
        charCodes: Array.from(String(provider)).map(c => c.charCodeAt(0)),
      })
      throw new Error(`Unsupported task management provider: ${provider}`)
  }
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): provider is TaskManagementProviderType {
  return provider === 'todoist' || provider === 'asana'
}

/**
 * Validate provider string and return typed provider or throw error
 */
export function validateProvider(provider: string): TaskManagementProviderType {
  if (!isProviderSupported(provider)) {
    throw new Error(`Invalid provider: ${provider}. Supported providers: todoist, asana`)
  }
  return provider
}

