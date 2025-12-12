/**
 * Safe translation utilities that handle missing messages gracefully
 * Prevents SSR errors when translations aren't available
 */

import { useTranslations as useNextIntlTranslations } from 'next-intl'

/**
 * Safe wrapper around useTranslations that handles missing messages
 * Returns the key if translation is missing instead of throwing
 */
export function useSafeTranslations() {
  const t = useNextIntlTranslations()
  
  return (key: string, fallback?: string): string => {
    try {
      const translated = t(key)
      // If the translation returns the key itself, it means it's missing
      if (translated === key) {
        return fallback || key
      }
      return translated
    } catch (error) {
      // If translation fails (e.g., during SSR), return fallback or key
      return fallback || key
    }
  }
}

/**
 * Get a translation with a fallback value
 */
export function useTranslation(key: string, fallback: string): string {
  const t = useSafeTranslations()
  return t(key, fallback)
}

