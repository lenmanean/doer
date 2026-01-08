'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSupabase } from '@/components/providers/supabase-provider'
import { GoalInput } from '@/components/ui/GoalInput'
import { WaitlistModal } from '@/components/ui/WaitlistModal'
import { LaunchCountdownBanner } from '@/components/ui/LaunchCountdownBanner'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

export default function StartPage() {
  const { user, loading, sessionReady } = useSupabase()
  const t = useTranslations()
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistInitialGoal, setWaitlistInitialGoal] = useState<string>('')

  // Scroll animation hooks
  const heroHeadlineAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const heroSubheadlineAnim = useScrollAnimation({ delay: 150, triggerOnce: true })

  const isAuthenticated = Boolean(user && sessionReady && !loading)

  // Listen for custom event from PublicHeader to open waitlist modal (if needed)
  useEffect(() => {
    if (!IS_PRE_LAUNCH) return

    const handleOpenWaitlistModal = (event: CustomEvent) => {
      setWaitlistInitialGoal(event.detail?.goal || '')
      setWaitlistModalOpen(true)
    }

    window.addEventListener('openWaitlistModal' as any, handleOpenWaitlistModal as EventListener)
    return () => {
      window.removeEventListener('openWaitlistModal' as any, handleOpenWaitlistModal as EventListener)
    }
  }, [])


  return (
    <div className="min-h-screen bg-gray-900 flex flex-col overflow-x-hidden">
      {/* Launch Countdown Banner - Pre-launch only */}
      {IS_PRE_LAUNCH && <LaunchCountdownBanner />}

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1
              ref={heroHeadlineAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight scroll-animate-fade-up ${heroHeadlineAnim.isVisible ? 'visible' : ''}`}
            >
              {t('hero.headline')}
            </h1>
            <p
              ref={heroSubheadlineAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-lg sm:text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed scroll-animate-fade-up ${heroSubheadlineAnim.isVisible ? 'visible' : ''}`}
            >
              {t('hero.subheadline')}
            </p>
          </div>

          {/* Goal Input Field - Works for both pre-launch and post-launch */}
          <div className="max-w-3xl mx-auto">
            <GoalInput
              placeholder="e.g., Learn to play guitar, Start a blog, Get in shape..."
              buttonText="Get Started"
              source="landing_page_hero"
              showSuggestions={false}
              onGoalSubmit={(goal) => {
                setWaitlistInitialGoal(goal)
                setWaitlistModalOpen(true)
              }}
            />
          </div>
        </div>
      </section>

      {/* Waitlist Modal - Pre-launch only */}
      {IS_PRE_LAUNCH && (
        <WaitlistModal
          isOpen={waitlistModalOpen}
          onClose={() => setWaitlistModalOpen(false)}
          initialGoal={waitlistInitialGoal}
        />
      )}

      {/* Homepage Link */}
      <div className="mt-auto pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <Link
            href="/"
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors duration-200 text-sm sm:text-base"
          >
            Visit our homepage
            <span className="ml-1">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

