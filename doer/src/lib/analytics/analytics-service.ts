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
 * Only initializes if analytics consent is given
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

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer.push(args)
  }

  // Set initial timestamp
  window.gtag('js', new Date())

  // Configure GA4
  window.gtag('config', GA4_MEASUREMENT_ID, {
    page_path: window.location.pathname,
    page_title: document.title,
  })

  isInitialized = true
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

