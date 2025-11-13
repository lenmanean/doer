'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <FadeInWrapper>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-[#d7d2cb]">
                Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information.
              </p>
              <p className="text-[#d7d2cb]">
                We are committed to protecting your personal data and ensuring transparency in our data practices.
              </p>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
    </div>
  )
}

