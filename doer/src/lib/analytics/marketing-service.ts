/**
 * Marketing Service
 * Facebook Pixel and Google Ads integration with consent management
 */

import type { CookieCategory } from '@/components/ui/CookieConsent'
import { hasConsent } from '@/lib/cookies/cookie-utils'

declare global {
  interface Window {
    fbq?: (
      command: 'init' | 'track' | 'trackCustom',
      eventName: string,
      params?: Record<string, any>
    ) => void
    gtag?: (
      command: 'config' | 'event' | 'set' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void
    dataLayer?: any[]
  }
}

const FACEBOOK_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

let facebookPixelInitialized = false
let googleAdsInitialized = false
let hasWarnedAboutFacebookPixel = false
let hasWarnedAboutGoogleAds = false

/**
 * Initialize Facebook Pixel
 * Note: The actual script loading happens in AnalyticsScripts.tsx
 * This function just verifies fbq is available and marks as initialized
 */
export function initializeFacebookPixel(consentCategories: CookieCategory[]): void {
  if (typeof window === 'undefined') return
  if (facebookPixelInitialized) return
  if (!FACEBOOK_PIXEL_ID) {
    // Only warn once to avoid console spam (Facebook Pixel is optional)
    if (!hasWarnedAboutFacebookPixel) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Marketing] FACEBOOK_PIXEL_ID not configured - Facebook Pixel tracking will be disabled')
      }
      hasWarnedAboutFacebookPixel = true
    }
    return
  }

  // Check if user has consented to marketing
  if (!consentCategories.includes('marketing')) {
    return
  }

  // Script is loaded by AnalyticsScripts.tsx, just verify fbq exists
  // If fbq doesn't exist yet, the script may still be loading
  // We'll mark as initialized anyway - tracking functions will check for fbq
  if (window.fbq) {
    facebookPixelInitialized = true
  } else {
    // Script may still be loading, mark as initialized anyway
    // Tracking functions will handle the case where fbq isn't ready
    facebookPixelInitialized = true
  }
}

/**
 * Initialize Google Ads conversion tracking
 * Only initializes if marketing consent is given
 * 
 * Note: Google Ads is optional - the service will continue to work without it.
 * Only Facebook Pixel tracking will be active if GOOGLE_ADS_ID is not configured.
 */
export function initializeGoogleAds(consentCategories: CookieCategory[]): void {
  if (typeof window === 'undefined') return
  if (googleAdsInitialized) return
  if (!GOOGLE_ADS_ID) {
    // Only warn once to avoid console spam (Google Ads is optional)
    if (!hasWarnedAboutGoogleAds) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Marketing] GOOGLE_ADS_ID not configured - Google Ads conversion tracking will be disabled')
      }
      hasWarnedAboutGoogleAds = true
    }
    return
  }

  // Check if user has consented to marketing
  if (!consentCategories.includes('marketing')) {
    return
  }

  // Initialize dataLayer if not already initialized
  window.dataLayer = window.dataLayer || []
  const dataLayer = window.dataLayer
  window.gtag = window.gtag || function gtag(...args: any[]) {
    dataLayer.push(args)
  }

  // Set initial timestamp
  window.gtag('js', new Date())

  // Configure Google Ads
  window.gtag('config', GOOGLE_ADS_ID, {
    send_page_view: false, // We'll track page views separately if needed
  })

  googleAdsInitialized = true
}

/**
 * Track a conversion event
 */
export function trackConversion(
  eventName: string,
  value?: number,
  currency: string = 'USD',
  additionalParams?: Record<string, any>
): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('marketing')) return

  // Track in Facebook Pixel
  if (window.fbq && FACEBOOK_PIXEL_ID) {
    window.fbq('track', eventName, {
      value,
      currency,
      ...additionalParams,
    })
  }

  // Track in Google Ads
  if (window.gtag && GOOGLE_ADS_ID) {
    window.gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_ID,
      value,
      currency,
      event_category: 'conversion',
      event_label: eventName,
      ...additionalParams,
    })
  }
}

/**
 * Track a custom marketing event
 */
export function trackCustomEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('marketing')) return

  // Track in Facebook Pixel
  if (window.fbq && FACEBOOK_PIXEL_ID) {
    window.fbq('trackCustom', eventName, params)
  }

  // Track in Google Ads
  if (window.gtag && GOOGLE_ADS_ID) {
    window.gtag('event', eventName, {
      send_to: GOOGLE_ADS_ID,
      ...params,
    })
  }
}

/**
 * Track page view for marketing
 * All page views are tracked via unified service for consistency
 */
export function trackPageView(): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('marketing')) return

  // Track PageView in Facebook Pixel
  // Note: This is called by unified service on initial load and route changes
  if (window.fbq && FACEBOOK_PIXEL_ID) {
    window.fbq('track', 'PageView')
  }
}

/**
 * Track lead event (signup, form submission, etc.)
 * 
 * Note: Currently unused but available for future marketing campaigns
 */
export function trackLead(value?: number, currency: string = 'USD'): void {
  trackConversion('Lead', value, currency)
}

/**
 * Track complete registration (user completes onboarding)
 * 
 * Note: Currently unused but available for future marketing campaigns
 */
export function trackCompleteRegistration(value?: number, currency: string = 'USD'): void {
  trackConversion('CompleteRegistration', value, currency)
}

/**
 * Track purchase event (if applicable)
 * 
 * Note: Currently unused but available for future e-commerce tracking
 */
export function trackPurchase(value: number, currency: string = 'USD', additionalParams?: Record<string, any>): void {
  trackConversion('Purchase', value, currency, additionalParams)
}

/**
 * Track WaitlistSignup event
 * Fires a custom Meta Pixel event when a user successfully joins the waitlist
 * Event name: WaitlistSignup
 * 
 * Note: Advanced Matching is handled automatically by Facebook Pixel through:
 * - Automatic email detection from form fields
 * - Server-side matching (if configured in Events Manager)
 * We do not pass email directly to maintain privacy compliance.
 * 
 * @param source - Source of the waitlist signup (e.g., 'landing_page_hero', 'pricing_card', 'header_button')
 */
export function trackWaitlistSignup(source: string): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('marketing')) return
  
  // Fire the custom event to Meta Pixel
  try {
    if (window.fbq && FACEBOOK_PIXEL_ID) {
      window.fbq('trackCustom', 'WaitlistSignup', {
        source: source,
      })
    }
  } catch (error) {
    console.error('[Marketing] Error tracking WaitlistSignup:', error)
  }
}

/**
 * Initialize all marketing services (Facebook Pixel and Google Ads)
 * Only initializes if marketing consent is given
 */
export function initializeMarketing(consentCategories: CookieCategory[]): void {
  initializeFacebookPixel(consentCategories)
  initializeGoogleAds(consentCategories)
}

