/**
 * In-memory rate limiting utility
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()

  /**
   * Check if a request should be rate limited
   * @param key - Unique identifier for the rate limit (e.g., userId, IP address)
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if request should be allowed, false if rate limited
   */
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now >= entry.resetAt) {
      // Create new entry or reset expired entry
      this.store.set(key, {
        count: 1,
        resetAt: now + windowMs,
      })
      return true
    }

    if (entry.count >= limit) {
      return false
    }

    entry.count++
    return true
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string, limit: number): number {
    const entry = this.store.get(key)
    if (!entry || Date.now() >= entry.resetAt) {
      return limit
    }
    return Math.max(0, limit - entry.count)
  }

  /**
   * Get reset time for a key
   */
  getResetTime(key: string): number | null {
    const entry = this.store.get(key)
    if (!entry) return null
    return entry.resetAt
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.store.delete(key)
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.store.delete(key))
  }
}

export const rateLimiter = new RateLimiter()

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    rateLimiter.cleanup()
  }, 5 * 60 * 1000)
}

/**
 * Rate limit configuration for different endpoint types
 */
export const RateLimitConfig = {
  // API endpoints
  api: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  // AI generation endpoints (more restrictive)
  aiGeneration: {
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  // Authentication endpoints
  auth: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Default
  default: {
    limit: 50,
    windowMs: 60 * 1000, // 1 minute
  },
} as const

/**
 * Create rate limit key from request
 */
export function getRateLimitKey(req: Request, userId?: string): string {
  // Use userId if available, otherwise use IP address
  if (userId) {
    return `user:${userId}`
  }

  // Try to get IP from headers
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

