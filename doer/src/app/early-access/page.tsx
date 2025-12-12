'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { WaitlistModal } from '@/components/ui/WaitlistModal'

export default function EarlyAccessPage() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistSource, setWaitlistSource] = useState<string>('cold_ads_hero')

  const videos = [
    { src: '/doer_tut1.mp4', title: 'Getting Started with DOER' },
    { src: '/doer_tut2.mp4', title: 'Building Your Plan' },
    { src: '/doer_tut3.mp4', title: 'Tracking Progress' },
  ]

  // Handle video loading and playback when slide changes
  useEffect(() => {
    // Pause all videos
    videoRefs.current.forEach((video) => {
      if (video) {
        video.pause()
      }
    })

    // Load and play current video
    const currentVideo = videoRefs.current[currentVideoIndex]
    if (currentVideo) {
      currentVideo.load()
      const playPromise = currentVideo.play()
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log('Video autoplay prevented:', error)
        })
      }
    }
  }, [currentVideoIndex])

  const nextVideo = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % videos.length)
  }

  const prevVideo = () => {
    setCurrentVideoIndex((prev) => (prev - 1 + videos.length) % videos.length)
  }

  const goToVideo = (index: number) => {
    setCurrentVideoIndex(index)
  }

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

      {/* Video Carousel Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-12">
            See DOER in action
          </h2>

          {/* Carousel Container */}
          <div className="relative">
            {/* Video Container */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-700 bg-gray-900 shadow-[0_20px_70px_rgba(2,6,23,0.55)]">
              <div className="overflow-hidden rounded-[2.3rem] border border-slate-800 bg-gray-900">
                <div className="relative aspect-video bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-orange-900/20">
                  {videos.map((video, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        index === currentVideoIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                      }`}
                    >
                      <video
                        ref={(el) => {
                          videoRefs.current[index] = el
                        }}
                        src={video.src}
                        autoPlay={index === currentVideoIndex}
                        loop
                        muted
                        playsInline
                        preload={index === currentVideoIndex ? 'auto' : 'none'}
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
                          const video = videoRefs.current[index]
                          if (video) {
                            video.setAttribute('webkit-playsinline', 'true')
                            video.setAttribute('playsinline', 'true')
                            video.setAttribute('x5-playsinline', 'true')
                          }
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={prevVideo}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-gray-800/90 hover:bg-gray-700 rounded-full border border-gray-700 text-white transition-all shadow-lg"
              aria-label="Previous video"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextVideo}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-gray-800/90 hover:bg-gray-700 rounded-full border border-gray-700 text-white transition-all shadow-lg"
              aria-label="Next video"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Dot Indicators */}
            <div className="flex justify-center gap-3 mt-6">
              {videos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToVideo(index)}
                  className={`transition-all ${
                    index === currentVideoIndex
                      ? 'w-8 h-3 bg-orange-500 rounded-full'
                      : 'w-3 h-3 bg-gray-600 rounded-full hover:bg-gray-500'
                  }`}
                  aria-label={`Go to video ${index + 1}`}
                />
              ))}
            </div>

            {/* Video Title */}
            <div className="text-center mt-4">
              <p className="text-lg text-gray-300">{videos[currentVideoIndex].title}</p>
            </div>
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

