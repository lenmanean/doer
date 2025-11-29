'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Cookie, CheckCircle, XCircle, Clock, Settings } from 'lucide-react'
import { getConsentCategories, saveConsentPreferences, hasConsent } from '@/lib/cookies/cookie-utils'
import { initializeAnalytics } from '@/lib/analytics/analytics-service'
import { initializeMarketing } from '@/lib/analytics/marketing-service'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase/client'
import type { CookieCategory } from '@/components/ui/CookieConsent'

interface CookieConsentData {
  accepted: boolean
  categories: CookieCategory[]
  timestamp: number
}

export function CookieManagement() {
  const { addToast } = useToast()
  const [consentData, setConsentData] = useState<CookieConsentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dbConsentData, setDbConsentData] = useState<any>(null)

  useEffect(() => {
    loadConsentData()
  }, [])

  const loadConsentData = async () => {
    try {
      // Load from localStorage
      const stored = localStorage.getItem('cookieConsent')
      if (stored) {
        const data = JSON.parse(stored)
        setConsentData(data)
      }

      // Load from database if user is logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('user_settings')
          .select('cookie_consent')
          .eq('user_id', user.id)
          .single()

        if (!error && data?.cookie_consent) {
          setDbConsentData(data.cookie_consent)
        }
      }
    } catch (error) {
      console.error('Error loading consent data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateConsent = async (categories: CookieCategory[]) => {
    setSaving(true)
    try {
      await saveConsentPreferences(categories)

      // Initialize services if consent given
      if (categories.includes('analytics')) {
        initializeAnalytics(categories)
      }
      if (categories.includes('marketing')) {
        initializeMarketing(categories)
      }

      // Reload data
      await loadConsentData()

      addToast({
        type: 'success',
        title: 'Preferences Updated',
        description: 'Your cookie preferences have been saved successfully.',
        duration: 3000,
      })
    } catch (error) {
      console.error('Error saving consent:', error)
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: 'Failed to save cookie preferences. Please try again.',
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRevokeAll = async () => {
    await handleUpdateConsent(['essential'])
  }

  const handleAcceptAll = async () => {
    await handleUpdateConsent(['essential', 'analytics', 'marketing', 'functional'])
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-[var(--muted-foreground)]">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  const categories: CookieCategory[] = ['essential', 'analytics', 'marketing', 'functional']
  const categoryLabels: Record<CookieCategory, string> = {
    essential: 'Essential Cookies',
    analytics: 'Analytics Cookies',
    marketing: 'Marketing Cookies',
    functional: 'Functional Cookies',
  }

  const categoryDescriptions: Record<CookieCategory, string> = {
    essential: 'Required for the website to function properly. These cannot be disabled.',
    analytics: 'Help us understand how visitors interact with our website by collecting anonymous information.',
    marketing: 'Used to deliver personalized advertisements and track campaign performance.',
    functional: 'Store your preferences and settings (theme, language, notifications) to personalize your experience.',
  }

  const hasGivenConsent = consentData?.accepted === true
  const consentDate = consentData?.timestamp ? new Date(consentData.timestamp) : null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Cookie className="w-5 h-5 text-[var(--primary)]" />
            <div>
              <CardTitle>Cookie Preferences</CardTitle>
              <CardDescription>
                Manage your cookie consent preferences and view your current settings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[var(--accent)] rounded-lg border border-[var(--border)]">
              <div className="flex items-center gap-3">
                {hasGivenConsent ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-[var(--muted-foreground)]" />
                )}
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {hasGivenConsent ? 'Consent Given' : 'No Consent Recorded'}
                  </p>
                  {consentDate && (
                    <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {consentDate.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              {hasGivenConsent && (
                <Badge variant="default">
                  {consentData?.categories?.length || 0} categories
                </Badge>
              )}
            </div>

            {/* Database Sync Status */}
            {dbConsentData && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Preferences synced to your account
                </p>
              </div>
            )}
          </div>

          {/* Current Categories */}
          {hasGivenConsent && (
            <div className="space-y-3">
              <h3 className="font-semibold text-[var(--foreground)]">Current Preferences</h3>
              <div className="space-y-2">
                {categories.map((category) => {
                  const isEnabled = hasConsent(category)
                  return (
                    <div
                      key={category}
                      className={`p-4 rounded-lg border ${
                        isEnabled
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-[var(--accent)] border-[var(--border)]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-[var(--foreground)]">
                              {categoryLabels[category]}
                            </h4>
                            {isEnabled ? (
                              <Badge variant="default" className="bg-green-500">
                                Enabled
                              </Badge>
                            ) : (
                              <Badge variant="outline">Disabled</Badge>
                            )}
                          </div>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {categoryDescriptions[category]}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-3 pt-4 border-t border-[var(--border)]">
            <h3 className="font-semibold text-[var(--foreground)]">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAcceptAll}
                disabled={saving}
              >
                Accept All Cookies
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeAll}
                disabled={saving}
              >
                Revoke All (Essential Only)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Open cookie consent modal
                  localStorage.removeItem('cookieConsent')
                  window.location.reload()
                }}
                disabled={saving}
              >
                <Settings className="w-4 h-4 mr-2" />
                Customize Preferences
              </Button>
            </div>
          </div>

          {/* Database Information */}
          <div className="pt-4 border-t border-[var(--border)]">
            <h3 className="font-semibold text-[var(--foreground)] mb-3">Database Information</h3>
            <div className="p-4 bg-[var(--accent)] rounded-lg border border-[var(--border)]">
              <p className="text-sm text-[var(--muted-foreground)] mb-2">
                Your cookie preferences are stored in:
              </p>
              <ul className="text-sm text-[var(--muted-foreground)] space-y-1 list-disc list-inside">
                <li>
                  <code className="bg-[var(--background)] px-2 py-1 rounded">localStorage</code> - 
                  For immediate access and anonymous users
                </li>
                <li>
                  <code className="bg-[var(--background)] px-2 py-1 rounded">user_settings.cookie_consent</code> - 
                  For logged-in users (synced to your account)
                </li>
              </ul>
              {dbConsentData && (
                <div className="mt-3 p-3 bg-[var(--background)] rounded border border-[var(--border)]">
                  <p className="text-xs font-mono text-[var(--muted-foreground)] break-all">
                    {JSON.stringify(dbConsentData, null, 2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

