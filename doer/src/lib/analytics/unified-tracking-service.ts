/**
 * Unified Tracking Service
 * Central service that dispatches events to GA4, Facebook Pixel, and Vercel Analytics
 * Ensures consistent event tracking across all platforms with proper consent management
 */

import { track as vercelTrack } from '@vercel/analytics/react'
import { trackPageView as analyticsTrackPageView, trackEvent as analyticsTrackEvent, trackWaitlistSignup as analyticsTrackWaitlistSignup } from './analytics-service'
import { trackPageView as marketingTrackPageView, trackWaitlistSignup as marketingTrackWaitlistSignup, trackCustomEvent as marketingTrackCustomEvent } from './marketing-service'
import { hasConsent } from '@/lib/cookies/cookie-utils'

/**
 * Track a page view across all analytics platforms
 * @param url - The page URL
 * @param title - Optional page title
 */
export function trackPageView(url: string, title?: string): void {
  if (typeof window === 'undefined') return

  // Track in GA4 (analytics consent)
  if (hasConsent('analytics')) {
    analyticsTrackPageView(url, title)
  }

  // Track in Facebook Pixel (marketing consent)
  if (hasConsent('marketing')) {
    marketingTrackPageView()
  }

  // Note: Vercel Analytics automatically tracks page views via the <Analytics /> component
  // No manual tracking needed to avoid duplicates
}

/**
 * Track a custom event across all analytics platforms
 * @param eventName - The event name
 * @param eventParams - Optional event parameters
 */
export function trackEvent(eventName: string, eventParams?: Record<string, any>): void {
  if (typeof window === 'undefined') return

  // Track in GA4 (analytics consent)
  if (hasConsent('analytics')) {
    analyticsTrackEvent(eventName, eventParams)
  }

  // Track in Facebook Pixel (marketing consent) - only for marketing events
  // Note: We don't track all events to Pixel, only marketing-relevant ones
  // Use trackMarketingEvent for Pixel-specific events

  // Track in Vercel Analytics (analytics consent)
  if (hasConsent('analytics')) {
    try {
      vercelTrack(eventName, eventParams || {})
    } catch (error) {
      console.warn('[Vercel Analytics] Error tracking event:', error)
    }
  }
}

/**
 * Track a button click across all analytics platforms
 * @param buttonId - Unique identifier for the button
 * @param buttonText - The button text/label
 * @param location - Where the button is located (e.g., 'header', 'hero', 'pricing')
 * @param additionalParams - Optional additional parameters
 */
export function trackButtonClick(
  buttonId: string,
  buttonText: string,
  location: string,
  additionalParams?: Record<string, any>
): void {
  const eventParams = {
    button_id: buttonId,
    button_text: buttonText,
    location,
    ...additionalParams,
  }

  // Track as button_click event
  trackEvent('button_click', eventParams)
}

/**
 * Track navigation between pages
 * @param from - Source page/route
 * @param to - Destination page/route
 * @param method - Navigation method (e.g., 'link', 'button', 'programmatic')
 */
export function trackNavigation(
  from: string,
  to: string,
  method: string = 'link'
): void {
  trackEvent('navigation', {
    from,
    to,
    method,
  })
}

/**
 * Track waitlist signup across all platforms
 * @param source - Source of the waitlist signup
 */
export function trackWaitlistSignup(source: string): void {
  if (typeof window === 'undefined') return

  // Track in GA4 (analytics consent)
  if (hasConsent('analytics')) {
    analyticsTrackWaitlistSignup(source)
  }

  // Track in Facebook Pixel (marketing consent)
  if (hasConsent('marketing')) {
    marketingTrackWaitlistSignup(source)
  }

  // Track in Vercel Analytics (analytics consent)
  if (hasConsent('analytics')) {
    try {
      vercelTrack('waitlist_signup', {
        source,
      })
    } catch (error) {
      console.warn('[Vercel Analytics] Error tracking waitlist signup:', error)
    }
  }
}

/**
 * Track a marketing-specific event (Facebook Pixel only)
 * @param eventName - The event name
 * @param params - Optional event parameters
 */
export function trackMarketingEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return
  if (!hasConsent('marketing')) return

  marketingTrackCustomEvent(eventName, params)
}
