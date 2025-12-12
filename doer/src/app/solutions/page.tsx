'use client'

import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function SolutionsPage() {
  const t = useTranslations()

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8 bg-gray-900 transition-colors">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-100 mb-6 transition-colors">
            {t('pages.solutions.title')}
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 mb-10 transition-colors">
            {t('pages.solutions.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
            <Link href="/solutions/teams">
              <Button variant="primary" size="lg">
                {t('header.forTeams')}
              </Button>
            </Link>
            <Link href="/solutions/coaches">
              <Button variant="primary" size="lg">
                {t('header.forCoaches')}
              </Button>
            </Link>
            <Link href="/solutions/educators">
              <Button variant="primary" size="lg">
                {t('header.forEducators')}
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}






