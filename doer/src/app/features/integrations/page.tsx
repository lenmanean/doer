'use client'

import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import Link from 'next/link'
import { integrations } from '@/data/integrations'

export default function IntegrationsPage() {
  const t = useTranslations()

  const categories = Array.from(new Set(integrations.map((integration) => integration.category)))

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-16">
          <section className="text-center space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">Connected systems</p>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 transition-colors">
              {t('pages.integrations.title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-slate-300 max-w-3xl mx-auto transition-colors">
              {t('pages.integrations.description')}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
              {t('pages.integrations.subtitle')}
            </p>
          </section>

          {categories.map((category) => (
            <section key={category} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">{category}</h2>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  {integrations.filter((integration) => integration.category === category).length} tools
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {integrations
                  .filter((integration) => integration.category === category)
                  .map((integration) => (
                    <article
                      key={integration.key}
                      className="relative overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-950 dark:to-gray-900 p-6 shadow-lg shadow-gray-200/40 dark:shadow-black/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-3xl">{integration.icon}</span>
                        <span className="text-xs font-semibold tracking-wide text-gray-500 dark:text-slate-400 uppercase">
                          {category}
                        </span>
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-slate-50">
                        {integration.name}
                      </h3>
                      <p className="mt-3 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                        {t(integration.descriptionKey)}
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
                  ))}
              </div>
            </section>
          ))}

          <section className="text-center space-y-2">
            <p className="text-gray-600 dark:text-slate-300">
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

