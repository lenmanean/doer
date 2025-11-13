'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { motion } from 'framer-motion'

function CheckoutSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [countdown, setCountdown] = useState(3)

  const planSlug = searchParams.get('plan')
  const billingCycle = searchParams.get('cycle')

  useEffect(() => {
    if (!planSlug) {
      router.push('/dashboard')
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push(`/dashboard?upgraded=true&plan=${planSlug}`)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [planSlug, billingCycle, router])

  const planName = planSlug === 'pro' ? 'Pro' : 'Basic'
  const cycleText = billingCycle === 'annual' ? 'Annual' : 'Monthly'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full"
      >
        <Card>
          <CardContent className="pt-12 pb-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex justify-center mb-6"
            >
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-400" />
              </div>
            </motion.div>

            <h1 className="text-3xl font-bold text-[#d7d2cb] mb-4">
              Subscription Successful!
            </h1>

            <p className="text-[#d7d2cb]/80 mb-2">
              Your plan has been successfully upgraded to
            </p>
            <p className="text-xl font-semibold text-[#ff7f00] mb-8">
              {planName} - {cycleText}
            </p>

            <div className="space-y-4">
              <Button
                onClick={() => router.push(`/dashboard?upgraded=true&plan=${planSlug}`)}
                size="lg"
                className="w-full"
              >
                Continue to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-sm text-[#d7d2cb]/60">
                Redirecting automatically in {countdown} second{countdown !== 1 ? 's' : ''}...
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff7f00] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  )
}

