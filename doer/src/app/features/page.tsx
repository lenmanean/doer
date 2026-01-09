'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { WaitlistModal } from '@/components/ui/WaitlistModal'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import Link from 'next/link'

// Feature section component with animation
function FeatureSection({ 
  feature, 
  index 
}: { 
  feature: {
    id: string
    title: string
    description: string
    videoUrl: string
    videoPrompt: string
  }
  index: number
}) {
  const featureAnim = useScrollAnimation({ delay: 100 + (index * 100), triggerOnce: true })
  
  return (
    <article
      ref={featureAnim.ref as React.RefObject<HTMLElement>}
      className={`relative overflow-hidden rounded-[3rem] border border-slate-800 bg-gray-800 shadow-[0_20px_70px_rgba(2,6,23,0.55)] transition-colors scroll-animate-fade-up ${featureAnim.isVisible ? 'visible' : ''}`}
    >
      <div className="relative grid gap-10 lg:gap-16 lg:grid-cols-2 p-6 sm:p-8 md:p-12 lg:p-16 items-center">
        <div className={index % 2 !== 0 ? 'lg:order-2' : ''}>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-slate-100 mb-6 transition-colors">
            {feature.title}
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            {feature.description}
          </p>
        </div>

        <div className={`${index % 2 !== 0 ? 'lg:order-1' : ''}`}>
          {feature.id === 'automation-integrations' ? (
            <div className="relative aspect-video">
              <img 
                src="/automations-preview.png" 
                alt={`${feature.title} preview`}
                className="w-full h-full object-contain max-w-full"
              />
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-700 bg-gray-900 shadow-[0_20px_70px_rgba(2,6,23,0.55)] transition-colors">
              <div className="overflow-hidden rounded-[2.3rem] border border-slate-800 bg-gray-900">
                {feature.videoUrl ? (
                  <div className="relative aspect-video">
                    <iframe
                      src={feature.videoUrl}
                      title={`${feature.title} preview`}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : feature.id === 'ai-plan-generator' ? (
                  <div className="relative aspect-video">
                    <img 
                      src="/ai-plan-preview.png" 
                      alt={`${feature.title} preview`}
                      className="w-full h-full object-contain max-w-full"
                    />
                  </div>
                ) : feature.id === 'smart-scheduling' ? (
                  <div className="relative aspect-video">
                    <img 
                      src="/smart-scheduling-preview.png" 
                      alt={`${feature.title} preview`}
                      className="w-full h-full object-contain max-w-full"
                    />
                  </div>
                ) : feature.id === 'progress-analytics' ? (
                  <div className="relative aspect-video">
                    <img 
                      src="/analytics-preview.png" 
                      alt={`${feature.title} preview`}
                      className="w-full h-full object-contain max-w-full"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center px-10 text-center">
                    <div>
                      <p className="text-lg font-semibold text-white mb-2">
                        Loom preview coming soon
                      </p>
                      <p className="text-sm text-slate-200/80">
                        {feature.videoPrompt}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default function FeaturesPage() {
  const t = useTranslations()
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)

  // Animation hooks
  const titleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const descAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const moreComingTitleAnim = useScrollAnimation({ delay: 500, triggerOnce: true })
  const moreComingDescAnim = useScrollAnimation({ delay: 550, triggerOnce: true })
  const ctaAnim = useScrollAnimation({ delay: 600, triggerOnce: true })

  const featureSections = [
    {
      id: 'ai-plan-generator',
      title: t('pages.features.sections.aiPlan.title'),
      description: t('pages.features.sections.aiPlan.description'),
      videoUrl: '',
      videoPrompt: t('pages.features.sections.aiPlan.videoPrompt')
    },
    {
      id: 'smart-scheduling',
      title: t('pages.features.sections.smartScheduling.title'),
      description: t('pages.features.sections.smartScheduling.description'),
      videoUrl: '',
      videoPrompt: t('pages.features.sections.smartScheduling.videoPrompt')
    },
    {
      id: 'automation-integrations',
      title: t('pages.features.sections.automations.title'),
      description: t('pages.features.sections.automations.description'),
      videoUrl: '',
      videoPrompt: t('pages.features.sections.automations.videoPrompt')
    },
    {
      id: 'progress-analytics',
      title: t('pages.features.sections.analytics.title'),
      description: t('pages.features.sections.analytics.description'),
      videoUrl: '',
      videoPrompt: t('pages.features.sections.analytics.videoPrompt')
    }
  ]

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8 bg-gray-900 transition-colors">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <h1 
              ref={titleAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-3xl sm:text-4xl md:text-5xl font-bold text-slate-100 mb-6 transition-colors scroll-animate-fade-up ${titleAnim.isVisible ? 'visible' : ''}`}
            >
              {t('pages.features.title')}
            </h1>
            <p 
              ref={descAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-lg sm:text-xl text-slate-300 mb-10 transition-colors scroll-animate-fade-up ${descAnim.isVisible ? 'visible' : ''}`}
            >
              {t('pages.features.description')}
            </p>
          </div>

          <div className="mt-24 space-y-24">
            {featureSections.map((feature, index) => (
              <FeatureSection key={feature.id} feature={feature} index={index} />
            ))}

            <section className="text-center space-y-6">
              <h2 
                ref={moreComingTitleAnim.ref as React.RefObject<HTMLHeadingElement>}
                className={`text-2xl sm:text-3xl md:text-4xl font-semibold text-slate-100 transition-colors scroll-animate-fade-up ${moreComingTitleAnim.isVisible ? 'visible' : ''}`}
              >
                {t('pages.features.moreComing')}
              </h2>
              <p 
                ref={moreComingDescAnim.ref as React.RefObject<HTMLParagraphElement>}
                className={`text-base sm:text-lg text-slate-300 transition-colors max-w-2xl mx-auto scroll-animate-fade-up ${moreComingDescAnim.isVisible ? 'visible' : ''}`}
              >
                {t('pages.features.moreComingDescription')}
              </p>
              <div
                ref={ctaAnim.ref as React.RefObject<HTMLDivElement>}
                className={`scroll-animate-fade-up ${ctaAnim.isVisible ? 'visible' : ''}`}
              >
                {IS_PRE_LAUNCH ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      setWaitlistModalOpen(true)
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-orange-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition-transform transition-shadow hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 min-h-[44px]"
                  >
                    Join Waitlist
                  </button>
                ) : (
                  <Link
                    href="/auth/signup"
                    className="inline-flex items-center justify-center rounded-full bg-orange-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition-transform transition-shadow hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 min-h-[44px]"
                  >
                    {t('pages.features.moreComingCta')}
                  </Link>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />

      {/* Waitlist Modal - Pre-launch only */}
      {IS_PRE_LAUNCH && (
        <WaitlistModal
          isOpen={waitlistModalOpen}
          onClose={() => setWaitlistModalOpen(false)}
          initialGoal=""
        />
      )}
    </div>
  )
}

