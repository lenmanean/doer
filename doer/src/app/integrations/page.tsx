'use client'

import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import Link from 'next/link'

export default function IntegrationsPage() {
  const t = useTranslations()

  const integrations = [
    { name: 'Google Calendar', icon: '📅', category: 'Calendar' },
    { name: 'Outlook', icon: '📅', category: 'Calendar' },
    { name: 'Apple Calendar', icon: '📅', category: 'Calendar' },
    { name: 'Todoist', icon: '✓', category: 'Task Management' },
    { name: 'Asana', icon: '✓', category: 'Task Management' },
    { name: 'Trello', icon: '✓', category: 'Task Management' },
    { name: 'Notion', icon: '📝', category: 'Note-taking' },
    { name: 'Evernote', icon: '📝', category: 'Note-taking' },
    { name: 'Slack', icon: '💬', category: 'Communication' },
    { name: 'Microsoft Teams', icon: '💬', category: 'Communication' },
    { name: 'Strava', icon: '🏃', category: 'Fitness' },
    { name: 'Apple Health', icon: '💪', category: 'Fitness' },
    { name: 'Coursera', icon: '📚', category: 'Learning' },
    { name: 'Udemy', icon: '📚', category: 'Learning' },
  ]

  const categories = Array.from(new Set(integrations.map(i => i.category)))

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors">
      <PublicHeader />
      
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 transition-colors">
              {t('pages.integrations.title')}
            </h1>
            <p className="text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto transition-colors">
              {t('pages.integrations.description')}
            </p>
          </div>

          {/* Integrations by Category */}
          {categories.map((category) => (
            <div key={category} className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-8 transition-colors">{category}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {integrations
                  .filter(integration => integration.category === category)
                  .map((integration) => (
                    <div
                      key={integration.name}
                      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 hover:border-gray-300 dark:hover:border-gray-700 transition-colors text-center shadow-sm dark:shadow-[0_10px_30px_rgba(2,6,23,0.35)]"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center text-3xl">
                        {integration.icon}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-slate-100 transition-colors">{integration.name}</h3>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Coming Soon Section */}
          <div className="mt-16 text-center">
            <p className="text-gray-600 dark:text-slate-300 mb-4 transition-colors">
              More integrations coming soon. Have a suggestion?
            </p>
            <Link href="/feature-request">
              <span className="text-orange-500 hover:text-orange-600 font-medium transition-colors">
                Request an integration
              </span>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

