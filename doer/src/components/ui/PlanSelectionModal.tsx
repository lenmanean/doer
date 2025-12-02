'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from 'lucide-react'
import { Button } from './Button'
import { useRouter } from 'next/navigation'

interface PlanSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
}

export function PlanSelectionModal({
  isOpen,
  onClose,
  onContinue
}: PlanSelectionModalProps) {
  const router = useRouter()
  const [canClose, setCanClose] = useState(false)
  const [showContinue, setShowContinue] = useState(false)

  // 5-second lock
  useEffect(() => {
    if (!isOpen) return

    setCanClose(false)
    setShowContinue(false)

    const timer = setTimeout(() => {
      setCanClose(true)
      setShowContinue(true)
    }, 5000)

    return () => clearTimeout(timer)
  }, [isOpen])

  const handlePlanSelect = (cycle: 'monthly' | 'annual') => {
    // Redirect to checkout page with plan parameters
    router.push(`/checkout?plan=pro&cycle=${cycle}`)
    onClose()
  }

  const handleContinue = () => {
    onContinue()
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
                Unlock unlimited potential with Pro features
              </p>
            </div>
            {canClose && (
              <button
                onClick={onClose}
                className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 rounded-lg hover:bg-white/5"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
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
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-[#d7d2cb] mb-2">Pro Monthly</h3>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-[#d7d2cb]">$20</span>
                      <span className="text-[#d7d2cb]/60 ml-2">/month</span>
                    </div>
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

            {/* Continue to dashboard - fades in after 5 seconds */}
            {showContinue && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 pt-6 border-t border-white/20 text-center"
              >
                <button
                  onClick={handleContinue}
                  className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors underline"
                >
                  Continue to dashboard
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

