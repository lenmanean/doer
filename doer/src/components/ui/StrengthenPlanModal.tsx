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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-[#d7d2cb]" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-2xl font-semibold text-[#d7d2cb]">Strengthen Your Plan?</h3>
            </div>

            {/* Description */}
            <div className="mb-6">
              <p className="text-base text-[#d7d2cb]/80 mb-4">
                Improve your plan by answering a few clarifying questions. This will help us create a more personalized and effective roadmap for your goals.
              </p>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <p className="text-sm text-[#d7d2cb]/70">
                  <strong className="text-orange-500">Cost:</strong> 1 API credit
                </p>
              </div>
            </div>

            {/* Video placeholder - ready for MP4 embed */}
            <div className="mb-6">
              <div className="bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-orange-900/20 rounded-lg border-2 border-gray-700 overflow-hidden w-full mx-auto" style={{ minHeight: '200px' }}>
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
                <div className="flex items-center justify-center h-full min-h-[200px] text-[#d7d2cb]/40">
                  <p className="text-sm">Video placeholder - MP4 video will be embedded here</p>
                </div>
              </div>
            </div>

            {/* Do not show again checkbox */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-[#0a0a0a] text-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] cursor-pointer"
                />
                <span className="text-sm text-[#d7d2cb]/80 group-hover:text-[#d7d2cb] transition-colors">
                  Do not show this again
                </span>
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                onClick={onStrengthen}
                className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary)]/90 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Strengthen Plan
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

