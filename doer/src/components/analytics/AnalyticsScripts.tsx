'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { getConsentCategories } from '@/lib/cookies/cookie-utils'

const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

/**
 * Conditionally loads analytics and marketing scripts based on user consent
 */
export function AnalyticsScripts() {
  const [consentCategories, setConsentCategories] = useState<string[]>([])

  useEffect(() => {
    // Check consent on mount and when it changes
    const checkConsent = () => {
      const categories = getConsentCategories()
      setConsentCategories(categories)
    }

    checkConsent()

    // Listen for consent changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookieConsent') {
        checkConsent()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Also check periodically (in case consent was updated in same tab)
    const interval = setInterval(checkConsent, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const hasAnalyticsConsent = consentCategories.includes('analytics')
  const hasMarketingConsent = consentCategories.includes('marketing')
  const isDevelopment = process.env.NODE_ENV !== 'production'

  return (
    <>
      {/* Google Analytics 4 */}
      {GA4_MEASUREMENT_ID && hasAnalyticsConsent && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA4_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                  page_title: document.title,
                  // Enhanced measurement settings
                  send_page_view: true,
                  // Privacy settings
                  anonymize_ip: true,
                  allow_google_signals: false,
                  allow_ad_personalization_signals: false,
                  // Enhanced measurement - automatic event tracking
                  scroll_depth_threshold: 90${isDevelopment ? ',\n                  debug_mode: true' : ''}
                });
              `,
            }}
          />
        </>
      )}

      {/* Google Ads Conversion Tracking */}
      {/* Note: Facebook Pixel is loaded in root layout to avoid duplication */}
      {GOOGLE_ADS_ID && hasMarketingConsent && (
        <Script
          id="google-ads"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
        />
      )}
      {GOOGLE_ADS_ID && hasMarketingConsent && (
        <Script
          id="google-ads-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ADS_ID}');
            `,
          }}
        />
      )}
    </>
  )
}

