'use client'

import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <FadeInWrapper>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Careers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-[#d7d2cb]">
                We're always looking for talented individuals to join our team.
              </p>
              <p className="text-[#d7d2cb]">
                For career opportunities, please send your resume to careers@usedoer.com
              </p>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
    </div>
  )
}

