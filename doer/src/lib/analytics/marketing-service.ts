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

/**
 * Initialize Facebook Pixel
 * Only initializes if marketing consent is given
 */
export function initializeFacebookPixel(consentCategories: CookieCategory[]): void {
  if (typeof window === 'undefined') return
  if (facebookPixelInitialized) return
  if (!FACEBOOK_PIXEL_ID) {
    console.warn('[Marketing] FACEBOOK_PIXEL_ID not configured')
    return
  }

  // Check if user has consented to marketing
  if (!consentCategories.includes('marketing')) {
    return
  }

  // Initialize Facebook Pixel
  if (!window.fbq) {
    const fbqQueue: any[] = []
    const fbqFunction = function fbq(...args: any[]) {
      fbqQueue.push(args)
    } as any
    fbqFunction.q = fbqQueue
    window.fbq = fbqFunction
  }
  const fbq = window.fbq
  if (fbq) {
    (fbq as any).l = +new Date()
    // Initialize pixel
    fbq('init', FACEBOOK_PIXEL_ID)
    fbq('track', 'PageView')
  }

  facebookPixelInitialized = true
}

/**
 * Initialize Google Ads conversion tracking
 * Only initializes if marketing consent is given
 */
export function initializeGoogleAds(consentCategories: CookieCategory[]): void {
  if (typeof window === 'undefined') return
  if (googleAdsInitialized) return
  if (!GOOGLE_ADS_ID) {
    console.warn('[Marketing] GOOGLE_ADS_ID not configured')
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
 */
export function trackPageView(): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('marketing')) return

  // Facebook Pixel automatically tracks PageView on init
  // But we can track it again if needed
  if (window.fbq && FACEBOOK_PIXEL_ID) {
    window.fbq('track', 'PageView')
  }
}

/**
 * Track lead event (signup, form submission, etc.)
 */
export function trackLead(value?: number, currency: string = 'USD'): void {
  trackConversion('Lead', value, currency)
}

/**
 * Track complete registration (user completes onboarding)
 */
export function trackCompleteRegistration(value?: number, currency: string = 'USD'): void {
  trackConversion('CompleteRegistration', value, currency)
}

/**
 * Track purchase event (if applicable)
 */
export function trackPurchase(value: number, currency: string = 'USD', additionalParams?: Record<string, any>): void {
  trackConversion('Purchase', value, currency, additionalParams)
}

/**
 * Initialize all marketing services (Facebook Pixel and Google Ads)
 * Only initializes if marketing consent is given
 */
export function initializeMarketing(consentCategories: CookieCategory[]): void {
  initializeFacebookPixel(consentCategories)
  initializeGoogleAds(consentCategories)
}

