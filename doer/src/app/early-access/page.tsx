'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { WaitlistModal } from '@/components/ui/WaitlistModal'

export default function EarlyAccessPage() {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistSource, setWaitlistSource] = useState<string>('cold_ads_hero')

  const videos = [
    { 
      src: '/doer_tut1.mp4', 
      description: 'Describe your goal or specific challenge.' 
    },
    { 
      src: '/doer_tut2.mp4', 
      description: 'Preview and refine your AI-generated plan.' 
    },
    { 
      src: '/doer_tut3.mp4', 
      description: 'Launch your customized plan and track your progress.' 
    },
  ]

  // Handle video loading and autoplay for all videos
  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (video) {
        video.load()
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log('Video autoplay prevented:', error)
          })
        }
      }
    })
  }, [])

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
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            An AI planner that turns any written goal into a day-by-day roadmap.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
            On January 1, DOER launches with auto-scheduling, progress tracking, and seamless calendar syncing. Join early to reserve your access and receive bonus AI credits on launch day.
          </p>

          {/* Screenshot */}
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

          {/* CTA */}
          <div className="max-w-xl mx-auto">
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleOpenWaitlist('cold_ads_hero')}
              className="w-full text-lg px-8 py-6"
            >
              Join the early access waitlist
            </Button>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-12">
            See DOER in action
          </h2>

          {/* Videos Stacked Vertically */}
          <div className="space-y-8">
            {videos.map((video, index) => (
              <div key={index} className="space-y-3">
                {/* Video Container */}
                <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-700 bg-gray-900 shadow-[0_20px_70px_rgba(2,6,23,0.55)]">
                  <div className="overflow-hidden rounded-[2.3rem] border border-slate-800 bg-gray-900">
                    <div className="relative aspect-video bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-orange-900/20">
                      <video
                        ref={(el) => {
                          videoRefs.current[index] = el
                        }}
                        src={video.src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          const videoEl = e.currentTarget
                          const error = videoEl.error
                          console.error('Video loading error:', {
                            code: error?.code,
                            message: error?.message,
                            src: videoEl.src,
                          })
                        }}
                        onLoadedMetadata={() => {
                          const videoEl = videoRefs.current[index]
                          if (videoEl) {
                            videoEl.setAttribute('webkit-playsinline', 'true')
                            videoEl.setAttribute('playsinline', 'true')
                            videoEl.setAttribute('x5-playsinline', 'true')
                          }
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </div>
                
                {/* Video Description */}
                <p className="text-center text-lg text-gray-300">
                  {video.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Benefits Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          {/* Trust Element */}
          <div className="mb-12">
            <p className="text-xl sm:text-2xl text-gray-300 mb-4">
              Launching January 1, 2025
            </p>
            <p className="text-lg text-gray-400">
              Join the waitlist now to secure your early access and bonus credits
            </p>
          </div>

          {/* Benefits */}
          <div className="mb-12">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-8">
              What you'll get:
            </h3>
            <ul className="space-y-4 text-left max-w-2xl mx-auto">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-gray-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Secondary CTA */}
          <div className="max-w-xl mx-auto">
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleOpenWaitlist('cold_ads_bottom')}
              className="w-full text-lg px-8 py-6"
            >
              Reserve your early access
            </Button>
          </div>
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

