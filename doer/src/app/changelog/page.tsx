'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { changelogEntries } from '@/data/changelog'

export default function ChangelogPage() {
  const t = useTranslations()

  const timelineItems = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Los_Angeles',
    })

    return [...changelogEntries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((entry) => {
        const dateObj = new Date(entry.date)
        return {
          ...entry,
          isoDate: dateObj.toISOString(),
          formattedDate: `${formatter.format(dateObj)} PT`,
        }
      })
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors">
      <PublicHeader />

      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-5xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6">
              {t('pages.changelog.title')}
            </h1>
            <p className="text-xl text-gray-600 dark:text-slate-300">
              {t('pages.changelog.description')}
            </p>
          </div>

          <section className="mt-16">
            <ol className="relative border-l border-slate-200 dark:border-slate-700 pl-8 sm:pl-12 space-y-12">
              {timelineItems.map((entry) => (
                <li key={`${entry.isoDate}-${entry.title}`} className="relative">
                  <span className="absolute -left-4 sm:-left-5 top-1 flex items-center justify-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-600 shadow-sm">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                    </span>
                  </span>

                  <time
                    dateTime={entry.isoDate}
                    className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300"
                  >
                    {entry.formattedDate}
                  </time>
                  <h3 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                    {entry.title}
                  </h3>
                  <p className="mt-3 text-base text-gray-600 dark:text-slate-300">
                    {entry.description}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

