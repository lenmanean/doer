'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <FadeInWrapper>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">About Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-[#d7d2cb]">
                DOER is an AI-powered goal achievement platform designed to help you turn your aspirations into reality.
              </p>
              <p className="text-[#d7d2cb]">
                Our mission is to empower individuals and teams to achieve their goals through intelligent planning, smart scheduling, and comprehensive progress tracking.
              </p>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
    </div>
  )
}

