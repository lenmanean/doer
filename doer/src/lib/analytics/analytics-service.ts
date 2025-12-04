/**
 * Analytics Service
 * Google Analytics 4 integration with consent management
 */

import type { CookieCategory } from '@/components/ui/CookieConsent'
import { hasConsent } from '@/lib/cookies/cookie-utils'

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'set' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void
    dataLayer?: any[]
  }
}

const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID

let isInitialized = false

/**
 * Initialize Google Analytics 4
 * Note: The actual script loading happens in AnalyticsScripts.tsx
 * This function just verifies gtag is available and marks as initialized
 */
export function initializeAnalytics(consentCategories: CookieCategory[]): void {
  if (typeof window === 'undefined') return
  if (isInitialized) return
  if (!GA4_MEASUREMENT_ID) {
    console.warn('[Analytics] GA4_MEASUREMENT_ID not configured')
    return
  }

  // Check if user has consented to analytics
  if (!consentCategories.includes('analytics')) {
    return
  }

  // Script is loaded by AnalyticsScripts.tsx, just verify gtag exists
  // If gtag doesn't exist yet, the script may still be loading
  // We'll mark as initialized anyway - tracking functions will check for gtag
  if (window.gtag && window.dataLayer) {
    isInitialized = true
  } else {
    // Script may still be loading, mark as initialized anyway
    // Tracking functions will handle the case where gtag isn't ready
    isInitialized = true
  }
}

/**
 * Track a page view
 */
export function trackPageView(url: string, title?: string): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('analytics')) return
  if (!window.gtag || !GA4_MEASUREMENT_ID) return

  window.gtag('config', GA4_MEASUREMENT_ID, {
    page_path: url,
    page_title: title || document.title,
  })
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, eventParams?: Record<string, any>): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('analytics')) return
  if (!window.gtag || !GA4_MEASUREMENT_ID) return

  window.gtag('event', eventName, {
    ...eventParams,
  })
}

/**
 * Track user actions (task creation, completion, etc.)
 */
export function trackUserAction(action: string, details?: Record<string, any>): void {
  trackEvent('user_action', {
    action,
    ...details,
  })
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(feature: string, metadata?: Record<string, any>): void {
  trackEvent('feature_usage', {
    feature_name: feature,
    ...metadata,
  })
}

/**
 * Track performance metrics
 */
export function trackPerformance(metric: string, value: number, unit?: string): void {
  trackEvent('performance_metric', {
    metric_name: metric,
    metric_value: value,
    metric_unit: unit || 'ms',
  })
}

/**
 * Set user properties (anonymized - no PII)
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('analytics')) return
  if (!window.gtag || !GA4_MEASUREMENT_ID) return

  window.gtag('set', 'user_properties', properties)
}

/**
 * Track conversion events
 */
export function trackConversion(eventName: string, value?: number, currency: string = 'USD'): void {
  trackEvent('conversion', {
    conversion_name: eventName,
    value,
    currency,
  })
}

/**
 * Track waitlist signup event
 * Fires GA4 sign_up event with waitlist-specific parameters
 * 
 * @param source - Source of the waitlist signup (e.g., 'landing_page_hero', 'final_cta')
 */
export function trackWaitlistSignup(source: string): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('analytics')) return
  if (!window.gtag || !GA4_MEASUREMENT_ID) return

  try {
    // Use standard GA4 sign_up event
    window.gtag('event', 'sign_up', {
      method: 'waitlist',
      source: source,
    })
  } catch (error) {
    console.error('[Analytics] Error tracking waitlist signup:', error)
  }
}

