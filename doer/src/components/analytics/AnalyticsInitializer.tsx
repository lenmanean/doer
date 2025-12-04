'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getConsentCategories } from '@/lib/cookies/cookie-utils'
import { initializeAnalytics, trackPageView } from '@/lib/analytics/analytics-service'
import { initializeMarketing, trackPageView as trackMarketingPageView } from '@/lib/analytics/marketing-service'

/**
 * Client component that initializes analytics and marketing services
 * based on user consent preferences
 */
export function AnalyticsInitializer() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const consentCategories = getConsentCategories()

    // Initialize analytics if consent given
    if (consentCategories.includes('analytics')) {
      initializeAnalytics(consentCategories)
    }

    // Initialize marketing if consent given
    if (consentCategories.includes('marketing')) {
      initializeMarketing(consentCategories)
    }
  }, [])

  // Track page views on route changes for both platforms
  useEffect(() => {
    const consentCategories = getConsentCategories()
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    
    // Track GA4 page view
    if (consentCategories.includes('analytics')) {
      trackPageView(url, document.title)
    }
    
    // Track Facebook Pixel page view
    if (consentCategories.includes('marketing')) {
      trackMarketingPageView()
    }
  }, [pathname, searchParams])

  return null
}

