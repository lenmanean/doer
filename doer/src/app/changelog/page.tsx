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
    return [...changelogEntries].sort((a, b) => {
      // Parse dates more robustly - handle format "2025-10-15 11:16:16 -0700"
      const parseDate = (dateStr: string): number => {
        // Try parsing as-is first
        let date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          return date.getTime()
        }
        // If that fails, try removing timezone and parsing
        const cleaned = dateStr.replace(/\s+-\d{4}$/, '')
        date = new Date(cleaned)
        if (!isNaN(date.getTime())) {
          return date.getTime()
        }
        // Last resort: return 0 (will appear at end)
        return 0
      }
      return parseDate(b.date) - parseDate(a.date)
    })
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
    <div className="min-h-screen bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
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
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-100 mb-6 bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              {changelogTitle}
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto">
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
            <p className="text-sm text-gray-400">
              Stay updated with the latest improvements and features
            </p>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
