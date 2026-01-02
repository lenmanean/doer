'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from 'lucide-react'
import { Button } from './Button'
import { useRouter } from 'next/navigation'

interface PlanSelectionModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PlanSelectionModal({
  isOpen,
  onClose
}: PlanSelectionModalProps) {
  const router = useRouter()
  const [canClose, setCanClose] = useState(false)
  const [trialEligible, setTrialEligible] = useState<boolean | null>(null)

  // 5-second lock - X button appears after delay
  useEffect(() => {
    if (!isOpen) return

    setCanClose(false)

    const timer = setTimeout(() => {
      setCanClose(true)
    }, 5000)

    return () => clearTimeout(timer)
  }, [isOpen])

  // Check trial eligibility
  useEffect(() => {
    if (!isOpen) return

    const checkTrialEligibility = async () => {
      try {
        const response = await fetch('/api/subscription/trial-eligibility')
        if (response.ok) {
          const data = await response.json()
          setTrialEligible(data.eligible)
        } else {
          setTrialEligible(false)
        }
      } catch (error) {
        console.error('[PlanSelectionModal] Error checking trial eligibility:', error)
        setTrialEligible(false)
      }
    }

    checkTrialEligibility()
  }, [isOpen])

  const handlePlanSelect = (cycle: 'monthly' | 'annual') => {
    // Redirect to checkout page with plan parameters
    router.push(`/checkout?plan=pro&cycle=${cycle}`)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={canClose ? onClose : undefined}
          className={`fixed inset-0 bg-black/60 backdrop-blur-xl ${canClose ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        />

        {/* Modal Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative w-full max-w-4xl bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-b from-white/5 to-transparent">
            <div>
              <h2 className="text-2xl font-bold text-[#d7d2cb]">Upgrade to Pro</h2>
              <p className="text-sm text-[#d7d2cb]/60 mt-1">
                Integrations require a Pro plan subscription. Choose your preferred billing cycle.
              </p>
            </div>
            <AnimatePresence>
              {canClose && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  onClick={onClose}
                  className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 rounded-lg hover:bg-white/5"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pro Monthly */}
                <motion.button
                  onClick={() => handlePlanSelect('monthly')}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/30 rounded-xl p-6 text-left transition-all duration-150"
                >
                  {/* Trial Badge - only show if eligible */}
                  {trialEligible !== false && (
                    <div className="absolute top-4 right-4 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold px-2 py-1 rounded">
                      14-day trial
                    </div>
                  )}
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-[#d7d2cb] mb-2">Pro Monthly</h3>
                    {trialEligible !== false ? (
                      <>
                        <div className="mb-2">
                          <p className="text-sm font-semibold text-blue-400">Start your free trial</p>
                          <p className="text-xs text-[#d7d2cb]/60 mt-0.5">After trial: $20/month</p>
                        </div>
                        <div className="mb-4">
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-[#d7d2cb]">$0</span>
                            <span className="text-[#d7d2cb]/60">/month</span>
                            <span className="text-lg text-[#d7d2cb]/40 line-through ml-2">$20</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mb-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-[#d7d2cb]">$20</span>
                          <span className="text-[#d7d2cb]/60">/month</span>
                        </div>
                      </div>
                    )}
                    <ul className="space-y-2 text-sm text-[#d7d2cb]/70">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>Unlimited API credits</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>All integrations</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>Priority support</span>
                      </li>
                    </ul>
                  </div>
                </motion.button>

                {/* Pro Annual - Highlighted */}
                <motion.button
                  onClick={() => handlePlanSelect('annual')}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-[#ff7f00]/20 via-purple-500/20 to-pink-500/20 hover:from-[#ff7f00]/30 hover:via-purple-500/30 hover:to-pink-500/30 border-2 border-[#ff7f00]/50 rounded-xl p-6 text-left transition-all duration-150"
                >
                  {/* Best Value Badge */}
                  <div className="absolute top-4 right-4 bg-[#ff7f00] text-white text-xs font-bold px-3 py-1 rounded-full">
                    Best Value
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-[#d7d2cb] mb-2">Pro Annual</h3>
                    <div className="mb-2">
                      <span className="text-sm text-[#d7d2cb]/60 line-through mr-2">$240/year</span>
                      <span className="text-xs font-semibold text-green-400 bg-green-400/20 px-2 py-1 rounded">
                        Save 33%
                      </span>
                    </div>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-[#d7d2cb]">$14</span>
                      <span className="text-[#d7d2cb]/60 ml-2">/month</span>
                      <span className="text-sm text-[#d7d2cb]/60 ml-2">($168/year)</span>
                    </div>
                    <ul className="space-y-2 text-sm text-[#d7d2cb]/70">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>Everything in Monthly</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>33% savings</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>Annual commitment</span>
                      </li>
                    </ul>
                  </div>
                </motion.button>
              </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

