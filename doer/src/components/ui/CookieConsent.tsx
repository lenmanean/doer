'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, Check, Cookie } from 'lucide-react'
import { Button } from './Button'
import Link from 'next/link'

export type CookieCategory = 'essential' | 'analytics' | 'marketing' | 'functional'

export interface CookieConsentData {
  accepted: boolean
  categories: CookieCategory[]
  timestamp: number
}

const COOKIE_CONSENT_KEY = 'cookieConsent'

const COOKIE_CATEGORIES: Record<CookieCategory, { name: string; description: string; required: boolean }> = {
  essential: {
    name: 'Essential Cookies',
    description: 'Required for the website to function properly. These cannot be disabled.',
    required: true,
  },
  analytics: {
    name: 'Analytics Cookies',
    description: 'Help us understand how visitors interact with our website by collecting anonymous information.',
    required: false,
  },
  marketing: {
    name: 'Marketing Cookies',
    description: 'Used to deliver personalized advertisements and track campaign performance.',
    required: false,
  },
  functional: {
    name: 'Functional Cookies',
    description: 'Enable enhanced functionality and personalization, such as remembering your preferences.',
    required: false,
  },
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<CookieCategory[]>(['essential'])

  useEffect(() => {
    // Check if consent has already been given
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!stored) {
      // Show consent banner after a short delay
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const saveConsent = (categories: CookieCategory[]) => {
    if (typeof window === 'undefined') return

    const consentData: CookieConsentData = {
      accepted: true,
      categories,
      timestamp: Date.now(),
    }

    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData))
    setIsVisible(false)
    setShowCustomize(false)
  }

  const handleAcceptAll = () => {
    saveConsent(['essential', 'analytics', 'marketing', 'functional'])
  }

  const handleRejectAll = () => {
    saveConsent(['essential']) // Essential cookies are always required
  }

  const handleAcceptNecessary = () => {
    saveConsent(['essential'])
  }

  const handleCustomize = () => {
    setShowCustomize(true)
  }

  const handleSaveCustom = () => {
    // Always include essential cookies
    const categories: CookieCategory[] = ['essential', ...selectedCategories.filter(c => c !== 'essential')]
    saveConsent(categories)
  }

  const toggleCategory = (category: CookieCategory) => {
    if (category === 'essential') return // Essential cannot be toggled

    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            onClick={() => {
              // Don't allow closing by clicking backdrop - user must make a choice
            }}
          />

          {/* Consent Banner */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[101] p-4 sm:p-6"
          >
            <div className="max-w-4xl mx-auto bg-black/90 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl p-6 sm:p-8">
              {!showCustomize ? (
                // Main consent view
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 bg-[#ff7f00]/20 rounded-lg flex-shrink-0">
                        <Cookie className="w-6 h-6 text-[#ff7f00]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-[#d7d2cb] mb-2">
                          We Value Your Privacy
                        </h3>
                        <p className="text-sm text-[#d7d2cb]/70 leading-relaxed">
                          We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                          By clicking "Accept All", you consent to our use of cookies. You can also choose to customize your preferences 
                          or reject non-essential cookies.{' '}
                          <Link
                            href="/privacy"
                            className="text-[#ff7f00] hover:text-[#ff9500] underline"
                            target="_blank"
                          >
                            Learn more
                          </Link>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAcceptAll}
                      className="flex-1 sm:flex-none"
                    >
                      Accept All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRejectAll}
                      className="flex-1 sm:flex-none"
                    >
                      Reject All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAcceptNecessary}
                      className="flex-1 sm:flex-none"
                    >
                      Only Necessary
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCustomize}
                      className="flex items-center gap-2 flex-1 sm:flex-none"
                    >
                      <Settings className="w-4 h-4" />
                      Customize
                    </Button>
                  </div>
                </div>
              ) : (
                // Customize view
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 bg-[#ff7f00]/20 rounded-lg flex-shrink-0">
                        <Settings className="w-6 h-6 text-[#ff7f00]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-[#d7d2cb] mb-2">
                          Customize Cookie Preferences
                        </h3>
                        <p className="text-sm text-[#d7d2cb]/70 leading-relaxed">
                          Choose which types of cookies you want to accept. Essential cookies are required for the website to function.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowCustomize(false)}
                      className="flex-shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(Object.keys(COOKIE_CATEGORIES) as CookieCategory[]).map((category) => {
                      const categoryInfo = COOKIE_CATEGORIES[category]
                      const isSelected = selectedCategories.includes(category)

                      return (
                        <div
                          key={category}
                          className={`p-4 rounded-lg border transition-colors ${
                            categoryInfo.required
                              ? 'bg-white/5 border-white/10'
                              : isSelected
                              ? 'bg-[#ff7f00]/10 border-[#ff7f00]/30'
                              : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-semibold text-[#d7d2cb]">
                                  {categoryInfo.name}
                                </h4>
                                {categoryInfo.required && (
                                  <span className="text-xs text-[#d7d2cb]/50 bg-white/5 px-2 py-0.5 rounded">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#d7d2cb]/60 leading-relaxed">
                                {categoryInfo.description}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleCategory(category)}
                              disabled={categoryInfo.required}
                              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                categoryInfo.required
                                  ? 'bg-[#ff7f00]/20 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-[#ff7f00] text-white'
                                  : 'bg-white/10 text-[#d7d2cb]/50 hover:bg-white/20'
                              }`}
                            >
                              {isSelected ? (
                                <Check className="w-5 h-5" />
                              ) : (
                                <div className="w-5 h-5 border-2 border-current rounded" />
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveCustom}
                      className="flex-1 sm:flex-none"
                    >
                      Save Preferences
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCustomize(false)}
                      className="flex-1 sm:flex-none"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/**
 * Hook to check if a specific cookie category is consented
 */
export function useCookieConsent(category?: CookieCategory): boolean {
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!stored) {
      setHasConsent(false)
      return
    }

    try {
      const consentData: CookieConsentData = JSON.parse(stored)
      
      if (!category) {
        // If no category specified, check if any consent was given
        setHasConsent(consentData.accepted)
      } else {
        // Check if the specific category is consented
        setHasConsent(consentData.categories.includes(category))
      }
    } catch (error) {
      console.error('Error parsing cookie consent:', error)
      setHasConsent(false)
    }
  }, [category])

  return hasConsent
}

