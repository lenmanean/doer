/**
 * Analytics Hook
 * Provides easy access to analytics tracking functions with automatic consent checking
 */

import { useCallback, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  trackPageView as analyticsTrackPageView,
  trackEvent,
  trackUserAction,
  trackFeatureUsage,
  trackPerformance,
  initializeAnalytics,
} from '@/lib/analytics/analytics-service'
import { getConsentCategories } from '@/lib/cookies/cookie-utils'

export function useAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialize analytics on mount if consent given
  useEffect(() => {
    const consentCategories = getConsentCategories()
    if (consentCategories.includes('analytics')) {
      initializeAnalytics(consentCategories)
    }
  }, [])

  // Track page view when route changes
  useEffect(() => {
    const consentCategories = getConsentCategories()
    if (consentCategories.includes('analytics')) {
      const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
      analyticsTrackPageView(url, document.title)
    }
  }, [pathname, searchParams])

  const trackPageView = useCallback((url: string, title?: string) => {
    analyticsTrackPageView(url, title)
  }, [])

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
    trackPageView,
    trackEvent: trackCustomEvent,
    trackUserAction: trackAction,
    trackFeatureUsage: trackFeature,
    trackPerformance: trackPerf,
  }
}

