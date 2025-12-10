'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <FadeInWrapper>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl">Product Roadmap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  We're constantly working on improving DOER. Check back soon for our product roadmap.
                </p>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Have a feature request? Visit our <a href="/feature-request" className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 underline min-h-[44px] inline-flex items-center">Feature Request</a> page.
                </p>
              </CardContent>
            </Card>
          </FadeInWrapper>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}

