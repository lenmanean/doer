/**
 * Cookie Management Utilities
 * Handles cookie operations with proper security attributes
 */

import Cookies from 'js-cookie'
import type { CookieCategory } from '@/components/ui/CookieConsent'
import { supabase } from '@/lib/supabase/client'

const COOKIE_CONSENT_KEY = 'cookieConsent'

export interface CookieOptions {
  expires?: number | Date
  path?: string
  domain?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  httpOnly?: boolean // Note: js-cookie can't set httpOnly, this is for documentation
}

/**
 * Set a cookie with proper attributes
 */
export function setCookie(name: string, value: string, options?: CookieOptions): void {
  if (typeof window === 'undefined') return

  const defaultOptions: CookieOptions = {
    expires: 365, // 1 year default
    path: '/',
    secure: process.env.NODE_ENV === 'production', // Secure in production
    sameSite: 'lax',
  }

  const finalOptions = { ...defaultOptions, ...options }

  Cookies.set(name, value, {
    expires: finalOptions.expires,
    path: finalOptions.path,
    domain: finalOptions.domain,
    secure: finalOptions.secure,
    sameSite: finalOptions.sameSite,
  })
}

/**
 * Get a cookie value
 */
export function getCookie(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  return Cookies.get(name)
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string, options?: { path?: string; domain?: string }): void {
  if (typeof window === 'undefined') return

  Cookies.remove(name, {
    path: options?.path || '/',
    domain: options?.domain,
  })
}

/**
 * Check if user has consented to a specific cookie category
 */
export function hasConsent(category: CookieCategory): boolean {
  if (typeof window === 'undefined') return false

  const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
  if (!stored) return false

  try {
    const consentData = JSON.parse(stored)
    return consentData.categories?.includes(category) || false
  } catch {
    return false
  }
}

/**
 * Get all consented cookie categories
 */
export function getConsentCategories(): CookieCategory[] {
  if (typeof window === 'undefined') return []

  const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
  if (!stored) return []

  try {
    const consentData = JSON.parse(stored)
    return consentData.categories || []
  } catch {
    return []
  }
}

/**
 * Check if user has given any consent
 */
export function hasAnyConsent(): boolean {
  if (typeof window === 'undefined') return false

  const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
  if (!stored) return false

  try {
    const consentData = JSON.parse(stored)
    return consentData.accepted === true && Array.isArray(consentData.categories) && consentData.categories.length > 0
  } catch {
    return false
  }
}

/**
 * Save consent preferences to Supabase (if user is logged in) and localStorage
 */
export async function saveConsentPreferences(categories: CookieCategory[]): Promise<void> {
  if (typeof window === 'undefined') return

  const consentData = {
    accepted: true,
    categories,
    timestamp: Date.now(),
  }

  // Always save to localStorage for immediate access
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData))

  // Try to save to Supabase if user is logged in
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Update user_settings with consent preferences
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          cookie_consent: consentData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })

      if (error) {
        console.warn('Failed to save consent preferences to database:', error)
        // Don't throw - localStorage save succeeded
      }
    }
  } catch (error) {
    // If Supabase save fails, that's okay - localStorage is the fallback
    console.warn('Error saving consent preferences to database:', error)
  }
}

