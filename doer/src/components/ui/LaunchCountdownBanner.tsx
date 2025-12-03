'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'

export function LaunchCountdownBanner() {
  const [isDismissed, setIsDismissed] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  // Banner always shows on load - removed localStorage persistence
  // User can dismiss it for the current session only

  // Calculate countdown to January 1st, 2026 12:00 AM PST
  useEffect(() => {
    if (isDismissed || !IS_PRE_LAUNCH) return

    const calculateTimeRemaining = () => {
      // January 1st, 2026 12:00 AM PST = January 1st, 2026 08:00 AM UTC
      // PST is UTC-8, but we need to account for DST
      // For January 1st, PST is in effect (not PDT), so UTC-8
      const targetDate = new Date('2026-01-01T08:00:00Z') // UTC time
      const now = new Date()
      const difference = targetDate.getTime() - now.getTime()

      if (difference <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      setTimeRemaining({ days, hours, minutes, seconds })
    }

    // Calculate immediately
    calculateTimeRemaining()

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [isDismissed])

  const handleDismiss = () => {
    // Only dismiss for current session, don't persist to localStorage
    setIsDismissed(true)
  }

  const handleJoinWaitlist = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openWaitlistModal', { detail: { goal: '' } }))
    }
  }

  if (!IS_PRE_LAUNCH || isDismissed) {
    return null
  }

  const formatTime = (value: number, label: string) => {
    return `${value} ${label}${value !== 1 ? 's' : ''}`
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-0 left-0 right-0 z-[99] bg-gradient-to-r from-[#ff7f00]/90 via-orange-600/90 to-[#ff7f00]/90 border-b border-orange-500/50 shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4 flex-wrap text-center">
              <span className="text-white font-semibold text-sm sm:text-base">
                Launch In{' '}
                <span className="font-bold">
                  {formatTime(timeRemaining.days, 'Day')}, {formatTime(timeRemaining.hours, 'Hour')}, {formatTime(timeRemaining.minutes, 'Minute')}, {formatTime(timeRemaining.seconds, 'Second')}
                </span>
              </span>
              <span className="hidden sm:inline text-white/80">|</span>
              <button
                onClick={handleJoinWaitlist}
                className="text-white font-bold underline hover:text-white/80 transition-colors text-sm sm:text-base"
              >
                Join The Waitlist Now For Early Access
              </button>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white transition-colors p-1 rounded hover:bg-white/10 flex-shrink-0"
              aria-label="Dismiss banner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

