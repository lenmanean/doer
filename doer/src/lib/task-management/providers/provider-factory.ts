/**
 * Task Management Provider Factory
 * Returns the appropriate provider implementation based on provider type
 */

import type { TaskManagementProvider } from './base-provider'
import { TodoistProvider } from './todoist-provider'

export type TaskManagementProviderType = 'todoist'

/**
 * Get a task management provider instance for the specified provider type
 */
export function getProvider(provider: TaskManagementProviderType): TaskManagementProvider {
  switch (provider) {
    case 'todoist':
      return new TodoistProvider()
    
    default:
      throw new Error(`Unsupported task management provider: ${provider}`)
  }
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): provider is TaskManagementProviderType {
  return provider === 'todoist'
}

/**
 * Validate provider string and return typed provider or throw error
 */
export function validateProvider(provider: string): TaskManagementProviderType {
  if (!isProviderSupported(provider)) {
    throw new Error(`Invalid provider: ${provider}. Supported providers: todoist`)
  }
  return provider
}

