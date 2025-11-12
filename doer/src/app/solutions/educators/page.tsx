'use client'

import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'

export default function EducatorsPage() {
  const t = useTranslations()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors">
      <PublicHeader />
      
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 transition-colors">
            {t('pages.solutionsEducators.title')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-slate-300 transition-colors">
            {t('pages.solutionsEducators.description')}
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}






