/**
 * Button Click Tracking Utilities
 * Provides functions and hooks for tracking button clicks across all analytics platforms
 */

import { useCallback } from 'react'
import { trackButtonClick as unifiedTrackButtonClick } from './unified-tracking-service'

/**
 * Track a button click event
 * @param buttonId - Unique identifier for the button
 * @param buttonText - The button text/label
 * @param location - Where the button is located (e.g., 'header', 'hero', 'pricing')
 * @param additionalParams - Optional additional parameters (e.g., href, button_type, variant)
 */
export function trackButtonClick(
  buttonId: string,
  buttonText: string,
  location: string,
  additionalParams?: Record<string, any>
): void {
  unifiedTrackButtonClick(buttonId, buttonText, location, additionalParams)
}

/**
 * React hook for tracking button clicks
 * Returns a callback function that can be used in onClick handlers
 * 
 * @example
 * ```tsx
 * const trackClick = useTrackButtonClick('hero-cta', 'Get Started', 'hero')
 * 
 * <button onClick={trackClick}>Get Started</button>
 * ```
 */
export function useTrackButtonClick(
  buttonId: string,
  buttonText: string,
  location: string,
  additionalParams?: Record<string, any>
) {
  return useCallback(
    (e?: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      // Get additional context from the event if available
      const eventParams: Record<string, any> = {
        ...additionalParams,
      }

      if (e?.currentTarget) {
        const element = e.currentTarget
        if ('href' in element && element.href) {
          eventParams.href = element.href
        }
        if ('target' in element && element.target) {
          eventParams.target = element.target
        }
      }

      trackButtonClick(buttonId, buttonText, location, eventParams)
    },
    [buttonId, buttonText, location, additionalParams]
  )
}

/**
 * Generate a button ID from button text and location
 * Useful for creating consistent button IDs
 * 
 * Note: Currently unused but available as a utility for consistent button ID generation
 */
export function generateButtonId(buttonText: string, location: string): string {
  return `${location}-${buttonText.toLowerCase().replace(/\s+/g, '-')}`
}
