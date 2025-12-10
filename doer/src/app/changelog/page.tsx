'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { ChangelogEntryCard } from '@/components/changelog/ChangelogEntryCard'
import { changelogEntries } from '@/data/changelog'

export default function ChangelogPage() {
  const t = useTranslations()

  const sortedEntries = useMemo(() => {
    return [...changelogEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [])

  // Helper function for translations with fallbacks
  const getTranslation = (key: string, fallback: string) => {
    try {
      const translated = t(key)
      return translated === key ? fallback : translated
    } catch {
      return fallback
    }
  }

  const changelogTitle = getTranslation('changelog.title', 'Changelog')
  const changelogDescription = getTranslation('changelog.description', 'See the latest updates, new features, and improvements.')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />

      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-16">
            <div className="inline-block mb-4">
              <span className="text-sm font-semibold uppercase tracking-widest text-orange-500 bg-orange-500/10 px-4 py-2 rounded-full">
                Updates
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-slate-100 mb-6 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              {changelogTitle}
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-slate-300 max-w-3xl mx-auto">
              {changelogDescription}
            </p>
          </div>

          {/* Changelog Grid */}
          <section className="mt-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedEntries.map((entry, index) => (
                <ChangelogEntryCard
                  key={`${entry.date}-${entry.title}`}
                  date={entry.date}
                  title={entry.title}
                  description={entry.description}
                  index={index}
                />
              ))}
            </div>
          </section>

          {/* Footer Note */}
          <div className="mt-16 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Stay updated with the latest improvements and features
            </p>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
