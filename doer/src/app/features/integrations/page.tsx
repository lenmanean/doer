'use client'

import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import Link from 'next/link'
import { integrations } from '@/data/integrations'
import { 
  SiGooglecalendar, 
  SiApple, 
  SiTodoist, 
  SiAsana, 
  SiTrello, 
  SiNotion, 
  SiSlack, 
  SiStrava
} from 'react-icons/si'
import { FaMicrosoft } from 'react-icons/fa'
import { MdEmail } from 'react-icons/md'
import type { ComponentType } from 'react'

// Mapping integration keys to icon components (same as landing page carousel)
const integrationIconMap: Record<string, ComponentType<{ className?: string }>> = {
  googleCalendar: SiGooglecalendar,
  outlook: MdEmail,
  appleCalendar: SiApple,
  todoist: SiTodoist,
  asana: SiAsana,
  trello: SiTrello,
  notion: SiNotion,
  slack: SiSlack,
  microsoftTeams: FaMicrosoft,
  strava: SiStrava,
}

export default function IntegrationsPage() {
  const t = useTranslations()

  const categories = Array.from(new Set(integrations.map((integration) => integration.category)))

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col transition-colors">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-16">
          <section className="text-center space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">Connected systems</p>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-100 transition-colors">
              {t('pages.integrations.title')}
            </h1>
            <p className="text-lg text-slate-300 max-w-3xl mx-auto transition-colors">
              {t('pages.integrations.description')}
            </p>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto">
              {(() => {
                try {
                  const translated = t('pages.integrations.subtitle')
                  return translated === 'pages.integrations.subtitle' 
                    ? 'Each connector keeps the AI scheduler aware of your calendars, tasks, and energy so every update is reflected instantly.'
                    : translated
                } catch {
                  return 'Each connector keeps the AI scheduler aware of your calendars, tasks, and energy so every update is reflected instantly.'
                }
              })()}
            </p>
          </section>

          {categories.map((category) => (
            <section key={category} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-slate-100">{category}</h2>
                <span className="text-sm text-slate-400">
                  {integrations.filter((integration) => integration.category === category).length} tools
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {integrations
                  .filter((integration) => integration.category === category)
                  .map((integration) => {
                    const IconComponent = integrationIconMap[integration.key]
                    return (
                    <article
                      key={integration.key}
                      className="relative overflow-hidden rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-lg shadow-black/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        {IconComponent ? (
                          <div className="w-12 h-12 flex items-center justify-center text-white">
                            <IconComponent className="w-full h-full" />
                          </div>
                        ) : (
                          <span className="text-3xl">{integration.icon}</span>
                        )}
                        <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                          {category}
                        </span>
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-slate-50">
                        {integration.name}
                      </h3>
                      <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                        {(() => {
                          try {
                            const translated = t(integration.descriptionKey)
                            // If translation returns the key itself (no translation found), use fallback
                            return translated === integration.descriptionKey 
                              ? integration.description 
                              : translated
                          } catch {
                            return integration.description
                          }
                        })()}
                      </p>
                      <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-wide text-orange-500">
                        <span>AI Scheduler</span>
                        <Link
                          href="/settings/integrations"
                          className="text-xs font-semibold text-orange-600 hover:text-orange-500"
                        >
                          Learn how → 
                        </Link>
                      </div>
                    </article>
                    )
                  })}
              </div>
            </section>
          ))}

          <section className="text-center space-y-2">
            <p className="text-slate-300">
              Need a connector that is not listed?
            </p>
            <Link href="/feature-request">
              <span className="text-orange-500 hover:text-orange-600 font-semibold transition-colors">
                Request an integration
              </span>
            </Link>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

