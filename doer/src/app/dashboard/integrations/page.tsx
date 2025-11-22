'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Sidebar } from '@/components/ui/Sidebar'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { useGlobalPendingReschedules } from '@/hooks/useGlobalPendingReschedules'
import { useSupabase } from '@/components/providers/supabase-provider'
import { isEmailConfirmed } from '@/lib/email-confirmation'
import { integrations } from '@/data/integrations'

export default function DashboardIntegrationsPage() {
  const t = useTranslations()
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const { loading: providerLoading } = useSupabase()
  const { hasPending } = useGlobalPendingReschedules(user?.id || null)
  const [emailConfirmed, setEmailConfirmed] = useState(true)

  useEffect(() => {
    if (!user) {
      setEmailConfirmed(true)
      return
    }
    setEmailConfirmed(isEmailConfirmed(user))
  }, [user?.id])

  const authLoading = loading || providerLoading
  const categories = Array.from(new Set(integrations.map((integration) => integration.category)))

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--foreground)]">
          {authLoading ? 'Loading your workspace...' : 'Redirecting...'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/dashboard/integrations"
        hasPendingReschedules={hasPending}
        emailConfirmed={emailConfirmed}
      />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="space-y-16">
          <section className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Connected systems
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-white dark:text-slate-100">
              {t('pages.integrations.title')}
            </h1>
            <p className="text-lg text-white/80 max-w-3xl mx-auto">
              {t('pages.integrations.description')}
            </p>
            <p className="text-sm text-white/70 max-w-2xl mx-auto">
              {t('pages.integrations.subtitle')}
            </p>
          </section>

          {categories.map((category) => (
            <section key={category} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white dark:text-slate-100">{category}</h2>
                <span className="text-sm text-white/60">
                  {integrations.filter((integration) => integration.category === category).length} tools
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {integrations
                  .filter((integration) => integration.category === category)
                  .map((integration) => (
                    <article
                      key={integration.key}
                      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-3xl">{integration.icon}</span>
                        <span className="text-xs font-semibold tracking-wide text-white/60 uppercase">
                          {category}
                        </span>
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-white">
                        {integration.name}
                      </h3>
                      <p className="mt-3 text-sm text-white/80 leading-relaxed">
                        {t(integration.descriptionKey)}
                      </p>
                      <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-wide text-orange-400">
                        <span>AI Scheduler</span>
                        <Link
                          href="/settings/integrations"
                          className="text-xs font-semibold text-orange-300 hover:text-orange-200"
                        >
                          Manage → 
                        </Link>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}

          <section className="text-center space-y-2">
            <p className="text-sm text-white/70">
              Missing a connector you rely on?
            </p>
            <Link href="/feature-request">
              <span className="text-orange-500 hover:text-orange-400 font-semibold">
                Request an integration
              </span>
            </Link>
          </section>
        </div>
      </main>
    </div>
  )
}

