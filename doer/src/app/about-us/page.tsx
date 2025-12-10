'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <FadeInWrapper>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl">About Us</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  DOER is an AI-powered goal achievement platform designed to help you turn your aspirations into reality.
                </p>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Our mission is to empower individuals and teams to achieve their goals through intelligent planning, smart scheduling, and comprehensive progress tracking.
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

