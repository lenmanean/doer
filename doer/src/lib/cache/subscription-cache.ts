/**
 * In-memory cache for Stripe subscription lookups
 * Reduces API calls to Stripe and improves performance
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SubscriptionCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private readonly defaultTtl = 5 * 60 * 1000 // 5 minutes in milliseconds

  /**
   * Get cached value if not expired
   * Returns undefined if not cached, or the cached value (which may be null)
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.data as T
  }

  /**
   * Set cache value with TTL
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtl)
    this.cache.set(key, { data: value, expiresAt })
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all cache entries for a user
   */
  invalidateUser(userId: string): void {
    const keysToDelete: string[] = []
    for (const key of this.cache.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clean up expired entries (should be called periodically)
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key))
  }
}

export const subscriptionCache = new SubscriptionCache()

// Clean up expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    subscriptionCache.cleanup()
  }, 10 * 60 * 1000)
}

