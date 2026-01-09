'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

export default function CareersPage() {
  const titleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const cardAnim = useScrollAnimation({ delay: 150, triggerOnce: true })

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 
            ref={titleAnim.ref as React.RefObject<HTMLHeadingElement>}
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 scroll-animate-fade-up ${titleAnim.isVisible ? 'visible' : ''}`}
          >
            Careers
          </h1>
        </div>
        <Card
          ref={cardAnim.ref as React.RefObject<HTMLDivElement>}
          className={`scroll-animate-fade-up ${cardAnim.isVisible ? 'visible' : ''}`}
        >
            <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl">Careers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We're always looking for talented individuals to join our team.
              </p>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  For career opportunities, please send your resume to{' '}
                  <a href="mailto:careers@usedoer.com" className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 underline min-h-[44px] inline-flex items-center">
                    careers@usedoer.com
                  </a>
              </p>
            </CardContent>
          </Card>
      </div>
      </main>
      <PublicFooter />
    </div>
  )
}

