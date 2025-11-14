/**
 * Retry logic for Stripe API calls with exponential backoff
 */

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryableErrors?: string[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['rate_limit', 'timeout', 'network_error', 'server_error'],
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return DEFAULT_OPTIONS.retryableErrors.some(retryable => message.includes(retryable))
  }

  // Check for Stripe API errors
  if (typeof error === 'object' && 'type' in error) {
    const errorType = String((error as { type?: string }).type).toLowerCase()
    return errorType === 'rate_limit_error' || errorType === 'api_connection_error'
  }

  return false
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) {
        break
      }

      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelayMs
      )

      // Wait before retrying
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Wrapper for Stripe API calls with retry logic
 */
export async function stripeWithRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return withRetry(fn, {
    ...options,
    retryableErrors: [
      'rate_limit',
      'timeout',
      'network_error',
      'server_error',
      'rate_limit_error',
      'api_connection_error',
    ],
  })
}

