'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { WaitlistModal } from '@/components/ui/WaitlistModal'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { FadeInWrapper } from '@/components/ui/FadeInWrapper'

export default function EarlyAccessPage() {
  const [expandedStep, setExpandedStep] = useState<string | null>('step1')
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistSource, setWaitlistSource] = useState<string>('cold_ads_hero')

  const steps = [
    { 
      id: 'step1', 
      stepNum: 1, 
      label: 'Share your goal', 
      title: 'Describe your goal or specific challenge.', 
      description: 'Tell DOER what you want to achieve, and we\'ll transform it into a structured plan with checkpoints, tasks, and a personalized timeline.' 
    },
    { 
      id: 'step2', 
      stepNum: 2, 
      label: 'Customize your plan', 
      title: 'Preview and refine your AI-generated plan.', 
      description: 'Review your personalized plan, adjust checkpoints, and customize your plan to match your preferences.' 
    },
    { 
      id: 'step3', 
      stepNum: 3, 
      label: 'Execute and track', 
      title: 'Launch your customized plan and track your progress.', 
      description: 'Activate your plan, monitor progress in real-time, and work together with others to accomplish your goals.' 
    },
  ]

  const handleOpenWaitlist = (source: string) => {
    setWaitlistSource(source)
    setWaitlistModalOpen(true)
  }

  const benefits = [
    'Auto-scheduling that adapts to your calendar',
    'Real-time progress tracking and insights',
    'Seamless calendar syncing (Google, Apple, Outlook)',
    'Bonus AI credits on launch day for early joiners',
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-32">
        <div className="max-w-5xl mx-auto text-center">
          {/* Headline */}
          <FadeInWrapper delay={0} direction="up">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              An AI planner that turns any written goal into a day-by-day roadmap.
            </h1>
          </FadeInWrapper>

          {/* Subheadline */}
          <FadeInWrapper delay={0.2} direction="up">
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              On January 1, DOER launches with auto-scheduling, progress tracking, and seamless calendar syncing. Join early to reserve your access and receive bonus AI credits on launch day.
            </p>
          </FadeInWrapper>

          {/* Screenshot */}
          <FadeInWrapper delay={0.3} direction="up">
            <div className="mb-12 max-w-4xl mx-auto">
              <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-700 bg-gray-900 shadow-[0_20px_70px_rgba(2,6,23,0.55)]">
                <div className="overflow-hidden rounded-[2.3rem] border border-slate-800 bg-gray-900">
                  <div className="relative aspect-video">
                    <img
                      src="/ai-plan-preview.png"
                      alt="DOER AI Plan Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>
          </FadeInWrapper>

          {/* CTA */}
          <FadeInWrapper delay={0.4} direction="up">
            <div className="max-w-xl mx-auto">
              <Button
                variant="primary"
                size="lg"
                onClick={() => handleOpenWaitlist('cold_ads_hero')}
                className="w-full text-lg px-8 py-6 pulsing-glow"
              >
                Join the early access waitlist
              </Button>
            </div>
          </FadeInWrapper>
        </div>
      </section>

      {/* Steps Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <FadeInWrapper delay={0.2} direction="up">
            <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-12">
              See DOER in action
            </h2>
          </FadeInWrapper>

          {/* Vertical Expandable Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isExpanded = expandedStep === step.id
              return (
                <StepCardWithAnimation
                  key={step.id}
                  step={step}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedStep(isExpanded ? null : step.id)}
                  delay={index * 100}
                />
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust & Benefits Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          {/* Trust Element */}
          <FadeInWrapper delay={0.2} direction="up">
            <div className="mb-12">
              <p className="text-xl sm:text-2xl text-gray-300 mb-4">
                Launching January 1, 2025
              </p>
              <p className="text-lg text-gray-400">
                Join the waitlist now to secure your early access and bonus credits
              </p>
            </div>
          </FadeInWrapper>

          {/* Benefits */}
          <FadeInWrapper delay={0.3} direction="up">
            <div className="mb-12">
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-8">
                What you'll get:
              </h3>
              <ul className="space-y-4 text-left max-w-2xl mx-auto">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={index}
                    className="flex items-start gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                  >
                    <CheckCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-gray-300">{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </FadeInWrapper>

          {/* Secondary CTA */}
          <FadeInWrapper delay={0.6} direction="up">
            <div className="max-w-xl mx-auto">
              <Button
                variant="primary"
                size="lg"
                onClick={() => handleOpenWaitlist('cold_ads_bottom')}
                className="w-full text-lg px-8 py-6 pulsing-glow"
              >
                Reserve your early access
              </Button>
            </div>
          </FadeInWrapper>
        </div>
      </section>

      {/* Waitlist Modal */}
      <WaitlistModal
        isOpen={waitlistModalOpen}
        onClose={() => setWaitlistModalOpen(false)}
        source={waitlistSource}
      />
    </div>
  )
}

// Hero Video Card Component
function HeroVideoCard({
  step,
  isExpanded,
  onToggle
}: {
  step: { id: string; stepNum: number; label: string; title: string; description: string }
  isExpanded: boolean
  onToggle: () => void
}) {
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

  // Handle video loading and playback when step is expanded
  useEffect(() => {
    if ((step.id === 'step1' || step.id === 'step2' || step.id === 'step3') && videoRef.current) {
      if (isExpanded) {
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
      } else {
        if (videoRef.current) {
          videoRef.current.pause()
        }
      }
    }
  }, [isExpanded, step.id, isMobile])

  // Ensure video is always visible and loaded
  useEffect(() => {
    if ((step.id === 'step1' || step.id === 'step2' || step.id === 'step3') && videoRef.current && isExpanded) {
      videoRef.current.style.display = 'block'
      if (videoRef.current.readyState === 0) {
        videoRef.current.load()
      }
    }
  }, [step.id, isExpanded])

  const videoSrc = step.id === 'step1' ? '/doer_tut1.mp4' : step.id === 'step2' ? '/doer_tut2.mp4' : '/doer_tut3.mp4'

  return (
    <div className="bg-gray-800 border-2 border-gray-700 rounded-lg overflow-hidden">
      {/* Step Header - Clickable */}
      <button
        onClick={onToggle}
        onMouseEnter={(e) => {
          const isDark = document.documentElement.classList.contains('dark')
          if (!isDark) {
            e.currentTarget.style.setProperty('background-color', '#4b5563', 'important')
            const h3 = e.currentTarget.querySelector('h3')
            if (h3) (h3 as HTMLElement).style.setProperty('color', '#ffffff', 'important')
          }
        }}
        onMouseLeave={(e) => {
          const isDark = document.documentElement.classList.contains('dark')
          if (!isDark) {
            e.currentTarget.style.removeProperty('background-color')
            const h3 = e.currentTarget.querySelector('h3')
            if (h3) (h3 as HTMLElement).style.removeProperty('color')
          }
        }}
        className="w-full px-6 py-5 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors text-left border-b border-gray-700"
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all flex-shrink-0"
            style={{
              backgroundColor: isExpanded ? '#f97316' : '#6b7280',
              color: '#ffffff'
            }}
          >
            {step.stepNum}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white">
              {step.label}
            </h3>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {/* Expandable Content */}
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 pb-6 pt-2 bg-gray-900 border-t border-gray-700">
          <div className="mb-6">
            <h4 className="text-xl font-bold text-white mb-3">
              {step.title}
            </h4>
            <p className="text-base text-gray-300 leading-relaxed">
              {step.description}
            </p>
          </div>
          
          {/* Video */}
          {isExpanded && (
            <div className="bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-orange-900/20 rounded-lg border-2 border-gray-700 overflow-hidden w-full mx-auto" style={{ minHeight: '200px' }}>
              <video
                ref={videoRef}
                src={videoSrc}
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Step Card Component with Animation
function StepCardWithAnimation({
  step,
  isExpanded,
  onToggle,
  delay
}: {
  step: { id: string; stepNum: number; label: string; title: string; description: string }
  isExpanded: boolean
  onToggle: () => void
  delay: number
}) {
  const { ref, isVisible } = useScrollAnimation({ delay, triggerOnce: true })
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`bg-gray-800 border-2 border-gray-700 rounded-lg overflow-hidden transition-all duration-300 scroll-animate-fade-up ${isVisible ? 'visible' : ''}`}
    >
      <StepCardContent
        step={step}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
    </div>
  )
}

// Helper component for step card content
function StepCardContent({
  step,
  isExpanded,
  onToggle
}: {
  step: { id: string; stepNum: number; label: string; title: string; description: string }
  isExpanded: boolean
  onToggle: () => void
}) {
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

  // Handle video loading and playback when step is expanded
  useEffect(() => {
    if ((step.id === 'step1' || step.id === 'step2' || step.id === 'step3') && videoRef.current) {
      if (isExpanded) {
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
      } else {
        if (videoRef.current) {
          videoRef.current.pause()
        }
      }
    }
  }, [isExpanded, step.id, isMobile])

  // Ensure video is always visible and loaded
  useEffect(() => {
    if ((step.id === 'step1' || step.id === 'step2' || step.id === 'step3') && videoRef.current && isExpanded) {
      videoRef.current.style.display = 'block'
      if (videoRef.current.readyState === 0) {
        videoRef.current.load()
      }
    }
  }, [step.id, isExpanded])

  const videoSrc = step.id === 'step1' ? '/doer_tut1.mp4' : step.id === 'step2' ? '/doer_tut2.mp4' : '/doer_tut3.mp4'

  return (
    <>
      {/* Step Header - Clickable */}
      <button
        onClick={onToggle}
        onMouseEnter={(e) => {
          const isDark = document.documentElement.classList.contains('dark')
          if (!isDark) {
            e.currentTarget.style.setProperty('background-color', '#4b5563', 'important')
            const h3 = e.currentTarget.querySelector('h3')
            if (h3) (h3 as HTMLElement).style.setProperty('color', '#ffffff', 'important')
          }
        }}
        onMouseLeave={(e) => {
          const isDark = document.documentElement.classList.contains('dark')
          if (!isDark) {
            e.currentTarget.style.removeProperty('background-color')
            const h3 = e.currentTarget.querySelector('h3')
            if (h3) (h3 as HTMLElement).style.removeProperty('color')
          }
        }}
        className="w-full px-6 py-5 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors text-left border-b border-gray-700"
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all flex-shrink-0"
            style={{
              backgroundColor: isExpanded ? '#f97316' : '#6b7280',
              color: '#ffffff'
            }}
          >
            {step.stepNum}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white">
              {step.label}
            </h3>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {/* Expandable Content */}
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 pb-6 pt-2 bg-gray-900 border-t border-gray-700">
          <div className="mb-6">
            <h4 className="text-xl font-bold text-white mb-3">
              {step.title}
            </h4>
            <p className="text-base text-gray-300 leading-relaxed">
              {step.description}
            </p>
          </div>
          
          {/* Video */}
          {isExpanded && (
            <div className="bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-orange-900/20 rounded-lg border-2 border-gray-700 overflow-hidden w-full mx-auto" style={{ minHeight: '200px' }}>
              <video
                ref={videoRef}
                src={videoSrc}
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
            </div>
          )}
        </div>
      </div>
    </>
  )
}

