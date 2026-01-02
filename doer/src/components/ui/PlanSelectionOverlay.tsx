'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface PlanSelectionOverlayProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string | null
}

const PLAN_STORAGE_KEY = 'plan_selection_dismissed'

export function PlanSelectionOverlay({ isOpen, onClose, userEmail }: PlanSelectionOverlayProps) {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const handleSelectPlan = (planSlug: 'basic' | 'pro') => {
    router.push(`/checkout?plan=${planSlug}&cycle=${billingCycle}`)
  }

  const handleDismiss = () => {
    localStorage.setItem(PLAN_STORAGE_KEY, 'true')
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={handleDismiss}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[#d7d2cb]/60 hover:text-[#d7d2cb] hover:bg-white/10 rounded-lg transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#d7d2cb] mb-2">
                Choose Your Plan
              </h2>
              <p className="text-[#d7d2cb]/60">
                {billingCycle === 'annual' 
                  ? 'Select a plan to unlock the full potential of DOER (Annual plan recommended - save 33%)'
                  : 'Select a plan to unlock the full potential of DOER'}
              </p>
            </div>

            {/* Billing cycle toggle */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <span className="text-sm font-medium text-[#d7d2cb]/60">
                Billing Cycle
              </span>
              <div className="inline-flex rounded-full border border-white/20 bg-white/5 p-1 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`rounded-full px-4 py-1 transition-colors ${
                    billingCycle === 'monthly'
                      ? 'bg-[#ff7f00] text-white'
                      : 'text-[#d7d2cb]/60 hover:text-[#d7d2cb]'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`rounded-full px-4 py-1 transition-colors ${
                    billingCycle === 'annual'
                      ? 'bg-[#ff7f00] text-white'
                      : 'text-[#d7d2cb]/60 hover:text-[#d7d2cb]'
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>

            {/* Plan options */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Basic Plan */}
              <Card className="hover:border-white/20 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">Basic</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-[#d7d2cb]">Free</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-[#d7d2cb]/80">
                      <Shield className="w-4 h-4 text-green-400" />
                      <span>Basic Features</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSelectPlan('basic')}
                    variant="default"
                    className="w-full"
                  >
                    Select Basic
                  </Button>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="border-[#ff7f00]/50 hover:border-[#ff7f00] transition-colors relative">
                <div className="absolute top-4 right-4 bg-[#ff7f00] text-white text-xs font-semibold px-2 py-1 rounded">
                  Popular
                </div>
                {billingCycle === 'annual' && (
                  <div className="absolute top-4 left-4 bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-semibold px-2 py-1 rounded">
                    Save 33%
                  </div>
                )}
                {billingCycle === 'monthly' && (
                  <div className="absolute top-4 left-4 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold px-2 py-1 rounded">
                    14-day trial
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">Pro</CardTitle>
                  <div className="mt-2">
                    {billingCycle === 'annual' && (
                      <div className="mb-1">
                        <span className="text-sm text-[#d7d2cb]/60 line-through mr-2">$240/yr</span>
                        <span className="text-xs text-green-400 font-semibold">33% off</span>
                      </div>
                    )}
                    {billingCycle === 'monthly' && (
                      <div className="mb-1">
                        <span className="text-sm font-semibold text-blue-400">Start your free trial</span>
                        <p className="text-xs text-[#d7d2cb]/60 mt-0.5">After trial: $20/month</p>
                      </div>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-[#d7d2cb]">
                        ${billingCycle === 'monthly' ? '0' : '160'}
                      </span>
                      <span className="text-[#d7d2cb]/60">
                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                      {billingCycle === 'monthly' && (
                        <span className="text-lg text-[#d7d2cb]/40 line-through ml-2">$20</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-[#d7d2cb]/80">
                      <Zap className="w-4 h-4 text-[#ff7f00]" />
                      <span>All Premium Features</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSelectPlan('pro')}
                    variant="primary"
                    className="w-full"
                  >
                    Select Pro
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Maybe Later button */}
            <div className="text-center">
              <button
                onClick={handleDismiss}
                className="text-sm text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export function shouldShowPlanOverlay(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PLAN_STORAGE_KEY) !== 'true'
}




