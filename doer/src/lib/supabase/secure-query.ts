/**
 * Secure Supabase Query Wrapper
 * 
 * This module provides secure, authenticated query functions that:
 * - Verify user authentication before executing queries
 * - Implement retry logic with exponential backoff
 * - Handle connection errors gracefully
 * - Validate RLS policies are working
 * - Provide proper error messages without exposing sensitive data
 */

import { supabase } from './client'
import { SupabaseClient } from '@supabase/supabase-js'

export interface QueryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial retry delay in milliseconds (default: 1000) */
  retryDelay?: number
  /** Maximum retry delay in milliseconds (default: 10000) */
  maxRetryDelay?: number
  /** Timeout for the query in milliseconds (default: 30000) */
  timeout?: number
  /** Whether to require authentication (default: true) */
  requireAuth?: boolean
  /** Custom error handler */
  onError?: (error: Error) => void
}

export interface QueryResult<T> {
  data: T | null
  error: Error | null
  retries: number
}

/**
 * Check if an error is retryable (network errors, timeouts, etc.)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false
  
  // Network errors
  if (error.message?.includes('fetch') || 
      error.message?.includes('network') ||
      error.message?.includes('timeout') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ENOTFOUND')) {
    return true
  }
  
  // Supabase connection errors
  if (error.code === 'PGRST301' || // Connection error
      error.code === 'PGRST302' || // Timeout
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError')) {
    return true
  }
  
  // Rate limiting (429) - retry with backoff
  if (error.status === 429 || error.code === '429') {
    return true
  }
  
  // Server errors (5xx) - retryable
  if (error.status >= 500 && error.status < 600) {
    return true
  }
  
  return false
}

/**
 * Check if an error is an authentication error
 */
function isAuthError(error: any): boolean {
  if (!error) return false
  
  // Supabase auth errors
  if (error.message?.includes('JWT') ||
      error.message?.includes('session') ||
      error.message?.includes('authentication') ||
      error.message?.includes('unauthorized') ||
      error.message?.includes('Auth session missing') ||
      error.name === 'AuthSessionMissingError') {
    return true
  }
  
  // HTTP 401 Unauthorized
  if (error.status === 401 || error.code === '401') {
    return true
  }
  
  return false
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay
  return delay + jitter
}

/**
 * Verify user authentication before query
 */
async function verifyAuthentication(): Promise<{ valid: boolean; userId: string | null; error: Error | null }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      return {
        valid: false,
        userId: null,
        error: new Error(`Authentication failed: ${error.message}`)
      }
    }
    
    if (!user) {
      return {
        valid: false,
        userId: null,
        error: new Error('No authenticated user found')
      }
    }
    
    return {
      valid: true,
      userId: user.id,
      error: null
    }
  } catch (error: any) {
    return {
      valid: false,
      userId: null,
      error: new Error(`Authentication verification failed: ${error.message || 'Unknown error'}`)
    }
  }
}

/**
 * Execute a query with timeout
 */
async function executeWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  ])
}

/**
 * Secure query wrapper with authentication verification and retry logic
 */
export async function secureQuery<T>(
  queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>,
  options: QueryOptions = {}
): Promise<QueryResult<T>> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    maxRetryDelay = 10000,
    timeout = 30000,
    requireAuth = true,
    onError
  } = options

  let lastError: Error | null = null
  let retries = 0

  // Verify authentication if required
  if (requireAuth) {
    const authCheck = await verifyAuthentication()
    if (!authCheck.valid) {
      const error = authCheck.error || new Error('Authentication required')
      if (onError) onError(error)
      return {
        data: null,
        error,
        retries: 0
      }
    }
  }

  // Execute query with retries
  while (retries <= maxRetries) {
    try {
      const result = await executeWithTimeout(
        () => queryFn(supabase),
        timeout
      )

      // Check for Supabase errors in the result
      if (result.error) {
        // Authentication errors should not be retried
        if (isAuthError(result.error)) {
          const error = new Error('Authentication failed. Please sign in again.')
          if (onError) onError(error)
          return {
            data: null,
            error,
            retries
          }
        }

        // Retryable errors
        if (isRetryableError(result.error) && retries < maxRetries) {
          lastError = new Error(result.error.message || 'Query failed')
          retries++
          const delay = calculateBackoffDelay(retries - 1, retryDelay, maxRetryDelay)
          console.warn(`[SecureQuery] Retryable error, retrying in ${delay}ms (attempt ${retries}/${maxRetries}):`, result.error.message)
          await sleep(delay)
          continue
        }

        // Non-retryable error
        const error = new Error(result.error.message || 'Query failed')
        if (onError) onError(error)
        return {
          data: null,
          error,
          retries
        }
      }

      // Success
      return {
        data: result.data,
        error: null,
        retries
      }
    } catch (error: any) {
      lastError = error

      // Authentication errors should not be retried
      if (isAuthError(error)) {
        const authError = new Error('Authentication failed. Please sign in again.')
        if (onError) onError(authError)
        return {
          data: null,
          error: authError,
          retries
        }
      }

      // Retryable errors
      if (isRetryableError(error) && retries < maxRetries) {
        retries++
        const delay = calculateBackoffDelay(retries - 1, retryDelay, maxRetryDelay)
        console.warn(`[SecureQuery] Retryable error, retrying in ${delay}ms (attempt ${retries}/${maxRetries}):`, error.message)
        await sleep(delay)
        continue
      }

      // Non-retryable error or max retries reached
      if (retries >= maxRetries) {
        const finalError = new Error(`Query failed after ${maxRetries} retries: ${error.message || 'Unknown error'}`)
        if (onError) onError(finalError)
        return {
          data: null,
          error: finalError,
          retries
        }
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  const finalError = lastError || new Error('Query failed')
  if (onError) onError(finalError)
  return {
    data: null,
    error: finalError,
    retries
  }
}

/**
 * Check Supabase connection health
 */
export async function checkConnectionHealth(): Promise<{
  healthy: boolean
  latency?: number
  error?: string
}> {
  try {
    const startTime = Date.now()
    const { error } = await supabase
      .from('user_settings')
      .select('user_id')
      .limit(0)
    const latency = Date.now() - startTime

    if (error) {
      // PGRST116 is "no rows returned" which is fine for health check
      if (error.code === 'PGRST116') {
        return { healthy: true, latency }
      }
      return { healthy: false, error: error.message }
    }

    return { healthy: true, latency }
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message || 'Connection check failed'
    }
  }
}

/**
 * Verify RLS policies are working correctly
 * This ensures users can only access their own data
 */
export async function verifyRLS(userId: string): Promise<{
  valid: boolean
  error?: string
}> {
  try {
    // Try to access another user's data (should fail)
    const { data, error } = await supabase
      .from('user_settings')
      .select('user_id')
      .neq('user_id', userId)
      .limit(1)

    // If we get data, RLS is not working correctly
    if (data && data.length > 0) {
      return {
        valid: false,
        error: 'RLS policy violation: Can access other users\' data'
      }
    }

    // If we get a permission error, that's expected and good
    if (error && (error.code === '42501' || error.message?.includes('permission'))) {
      return { valid: true }
    }

    // No error and no data is also fine (no other users exist)
    return { valid: true }
  } catch (error: any) {
    return {
      valid: false,
      error: `RLS verification failed: ${error.message}`
    }
  }
}

