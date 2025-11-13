'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function ResponsibleUsePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <FadeInWrapper>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Responsible Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-[#d7d2cb]">
                DOER is committed to promoting responsible use of AI technology.
              </p>
              <p className="text-[#d7d2cb]">
                We encourage users to use our platform ethically and in accordance with our community guidelines.
              </p>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
    </div>
  )
}

