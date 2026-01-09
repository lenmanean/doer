'use client'

import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function AffiliatesPage() {
  // Animation hook
  const cardAnim = useScrollAnimation({ delay: 0, triggerOnce: true })

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card
          ref={cardAnim.ref as React.RefObject<HTMLDivElement>}
          className={`scroll-animate-fade-up ${cardAnim.isVisible ? 'visible' : ''}`}
        >
          <CardHeader>
            <CardTitle className="text-3xl">Affiliate Program</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-[#d7d2cb]">
              Join our affiliate program and earn commissions by referring new users to DOER.
            </p>
            <p className="text-[#d7d2cb]">
              For more information about our affiliate program, please contact us at affiliates@usedoer.com
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

