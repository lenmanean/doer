'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <FadeInWrapper>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Terms of Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-[#d7d2cb]">
                By using DOER, you agree to our Terms of Service.
              </p>
              <p className="text-[#d7d2cb]">
                Please review our terms carefully before using our service.
              </p>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
    </div>
  )
}

