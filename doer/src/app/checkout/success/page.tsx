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
    console.log('[CheckoutSuccess] Page loaded with params:', { planSlug, billingCycle })
    
    if (!planSlug) {
      console.warn('[CheckoutSuccess] No planSlug found, redirecting to dashboard')
      router.push('/dashboard')
      return
    }

    console.log('[CheckoutSuccess] Starting countdown timer')
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Redirect to dashboard with upgrade flag to show updated subscription
          console.log('[CheckoutSuccess] Countdown complete, redirecting to dashboard')
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
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
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

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Subscription Successful!
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Your plan has been successfully upgraded to
            </p>
            <p className="text-lg sm:text-xl font-semibold text-orange-500 dark:text-orange-400 mb-8">
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

              <p className="text-sm text-gray-600 dark:text-gray-400">
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
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  )
}

