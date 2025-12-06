/**
 * Analytics Hook (GA4-only)
 * Provides easy access to GA4-specific tracking functions
 * 
 * Note: For multi-platform tracking (GA4 + Vercel + Pixel), use the unified tracking service.
 * This hook is for GA4-specific features like user actions, feature usage, and performance metrics.
 * 
 * Page view tracking is handled automatically by AnalyticsInitializer via unified service.
 * 
 * @see unified-tracking-service.ts for multi-platform tracking
 */

import { useCallback, useEffect } from 'react'
import {
  trackEvent,
  trackUserAction,
  trackFeatureUsage,
  trackPerformance,
  initializeAnalytics,
} from '@/lib/analytics/analytics-service'
import { getConsentCategories } from '@/lib/cookies/cookie-utils'

export function useAnalytics() {
  // Initialize analytics on mount if consent given
  useEffect(() => {
    const consentCategories = getConsentCategories()
    if (consentCategories.includes('analytics')) {
      initializeAnalytics(consentCategories)
    }
  }, [])

  // Note: Page view tracking is handled by AnalyticsInitializer via unified service
  // to avoid duplicates and ensure multi-platform tracking

  const trackCustomEvent = useCallback((eventName: string, eventParams?: Record<string, any>) => {
    trackEvent(eventName, eventParams)
  }, [])

  const trackAction = useCallback((action: string, details?: Record<string, any>) => {
    trackUserAction(action, details)
  }, [])

  const trackFeature = useCallback((feature: string, metadata?: Record<string, any>) => {
    trackFeatureUsage(feature, metadata)
  }, [])

  const trackPerf = useCallback((metric: string, value: number, unit?: string) => {
    trackPerformance(metric, value, unit)
  }, [])

  return {
    trackEvent: trackCustomEvent,
    trackUserAction: trackAction,
    trackFeatureUsage: trackFeature,
    trackPerformance: trackPerf,
  }
}

