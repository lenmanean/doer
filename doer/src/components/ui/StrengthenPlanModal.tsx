'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface StrengthenPlanModalProps {
  isOpen: boolean
  onClose: () => void
  onStrengthen: () => void
  onSkip: (dontShowAgain: boolean) => void
}

export function StrengthenPlanModal({
  isOpen,
  onClose,
  onStrengthen,
  onSkip,
}: StrengthenPlanModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle video loading when modal opens
  useEffect(() => {
    if (isOpen && videoRef.current) {
      // Video will be added later - placeholder for now
      // When video is added, uncomment and configure:
      /*
      const timer = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load()
          const playPromise = videoRef.current.play()
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.log('Video autoplay prevented (may need user interaction on mobile):', error)
              if (isMobile && videoRef.current) {
                videoRef.current.currentTime = 0
              }
            })
          }
        }
      }, 300)
      return () => clearTimeout(timer)
      */
    } else {
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }
  }, [isOpen, isMobile])

  const handleSkip = () => {
    onSkip(dontShowAgain)
  }

  const handleClose = () => {
    onSkip(dontShowAgain)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Dimming/Blur Overlay - covers entire screen but button and modal are above */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Small Popup Modal - positioned near bottom-right where button is */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0a0a0a] border border-white/20 rounded-xl p-4 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[#d7d2cb]" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 pr-8">
                <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-[#d7d2cb]">Strengthen Your Plan?</h3>
              </div>

              {/* Description */}
              <div className="mb-4 sm:mb-6">
                <p className="text-sm sm:text-base text-[#d7d2cb]/80 mb-3">
                  Improve your plan by answering a few clarifying questions. This will help us create a more personalized and effective roadmap for your goals.
                </p>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 sm:p-3">
                  <p className="text-xs sm:text-sm text-[#d7d2cb]/70">
                    <strong className="text-purple-400">Cost:</strong> 1 API credit
                  </p>
                </div>
              </div>

              {/* Video placeholder - ready for MP4 embed */}
              <div className="mb-4 sm:mb-6">
                <div className="bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-orange-900/20 rounded-lg border-2 border-gray-700 overflow-hidden w-full mx-auto" style={{ minHeight: '150px' }}>
                  {/* Video will be added here later */}
                  {/* Structure ready for <video> tag:
                  <video
                    ref={videoRef}
                    src="/path/to/video.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    className="w-full h-auto rounded-lg"
                    style={{ 
                      display: 'block',
                      objectFit: 'contain'
                    }}
                    onError={(e) => {
                      const video = e.currentTarget
                      const error = video.error
                      console.error('Video loading error:', {
                        code: error?.code,
                        message: error?.message,
                        src: video.src,
                      })
                    }}
                    onLoadedData={() => {
                      if (isMobile && videoRef.current) {
                        videoRef.current.play().catch(() => {
                          // Silently fail - user may need to interact
                        })
                      }
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        videoRef.current.style.display = 'block'
                        videoRef.current.setAttribute('webkit-playsinline', 'true')
                        videoRef.current.setAttribute('playsinline', 'true')
                        videoRef.current.setAttribute('x5-playsinline', 'true')
                      }
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                  */}
                  <div className="flex items-center justify-center h-full min-h-[150px] text-[#d7d2cb]/40">
                    <p className="text-xs sm:text-sm text-center px-4">Video placeholder - MP4 video will be embedded here</p>
                  </div>
                </div>
              </div>

              {/* Do not show again checkbox */}
              <div className="mb-4 sm:mb-6">
                <label className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded border-white/20 bg-[#0a0a0a] text-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm text-[#d7d2cb]/80 group-hover:text-[#d7d2cb] transition-colors">
                    Do not show this again
                  </span>
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 sm:gap-3">
                <Button
                  onClick={handleSkip}
                  variant="outline"
                  className="flex-1 text-xs sm:text-sm"
                >
                  Skip
                </Button>
                <Button
                  onClick={onStrengthen}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  Strengthen Plan
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
