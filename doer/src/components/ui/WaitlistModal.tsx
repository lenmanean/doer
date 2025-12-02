'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { WaitlistForm } from './WaitlistForm'
import { useEffect } from 'react'

interface WaitlistModalProps {
  isOpen: boolean
  onClose: () => void
  initialGoal?: string // Optional goal passed from GoalInput
}

export function WaitlistModal({
  isOpen,
  onClose,
  initialGoal
}: WaitlistModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle successful waitlist submission
  const handleSuccess = () => {
    // Close modal after a short delay to show success message
    setTimeout(() => {
      onClose()
    }, 2000)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[100]"
          />

          {/* Modal Panel */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-b from-white/5 to-transparent">
                  <div>
                    <h2 className="text-2xl font-bold text-[#d7d2cb]">Join the Waitlist</h2>
                    <p className="text-sm text-[#d7d2cb]/60 mt-1">
                      Be among the first to experience DOER. Enter your goal and email to get early access.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 rounded-lg hover:bg-white/5"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  <WaitlistForm
                    source="waitlist_modal"
                    enableGoalCapture={true}
                    initialGoal={initialGoal}
                    onSuccess={handleSuccess}
                    className=""
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

