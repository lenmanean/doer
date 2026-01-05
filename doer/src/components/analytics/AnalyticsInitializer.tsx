'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getConsentCategories } from '@/lib/cookies/cookie-utils'
import { initializeAnalytics } from '@/lib/analytics/analytics-service'
import { initializeMarketing } from '@/lib/analytics/marketing-service'
import { trackPageView } from '@/lib/analytics/unified-tracking-service'

/**
 * Client component that initializes analytics and marketing services
 * based on user consent preferences
 */
export function AnalyticsInitializer() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Skip analytics initialization on early-access or start pages
    if (pathname === '/early-access' || pathname === '/start') {
      return
    }

    const consentCategories = getConsentCategories()

    // Initialize analytics if consent given
    if (consentCategories.includes('analytics')) {
      initializeAnalytics(consentCategories)
    }

    // Initialize marketing if consent given
    if (consentCategories.includes('marketing')) {
      initializeMarketing(consentCategories)
    }
  }, [pathname])

  // Track page views on route changes across all platforms (GA4, Pixel, Vercel Analytics)
  useEffect(() => {
    // Skip tracking on early-access or start pages
    if (pathname === '/early-access' || pathname === '/start') {
      return
    }

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
    
    // Unified tracking service handles all platforms with proper consent checks
    trackPageView(url, document.title)
  }, [pathname, searchParams])

  return null
}

