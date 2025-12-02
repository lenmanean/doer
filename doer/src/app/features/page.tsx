'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { WaitlistModal } from '@/components/ui/WaitlistModal'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'
import Link from 'next/link'

export default function FeaturesPage() {
  const t = useTranslations()
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)

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
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors">
      <PublicHeader />
      
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 transition-colors">
              {t('pages.features.title')}
            </h1>
            <p className="text-xl text-gray-600 dark:text-slate-300 mb-10 transition-colors">
              {t('pages.features.description')}
            </p>
          </div>

          <div className="mt-24 space-y-24">
            {featureSections.map((feature, index) => (
              <article
                key={feature.id}
                className="relative overflow-hidden rounded-[3rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-800 shadow-[0_25px_80px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_70px_rgba(2,6,23,0.55)] transition-colors"
              >
                <div className="relative grid gap-10 lg:gap-16 lg:grid-cols-2 p-8 sm:p-12 lg:p-16 items-center">
                  <div className={index % 2 !== 0 ? 'lg:order-2' : ''}>
                    <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-slate-100 mb-6 transition-colors">
                      {feature.title}
                    </h2>
                    <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  <div className={`${index % 2 !== 0 ? 'lg:order-1' : ''}`}>
                    <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_70px_rgba(2,6,23,0.55)] transition-colors">
                      <div className="overflow-hidden rounded-[2.3rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-gray-900">
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
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : feature.id === 'smart-scheduling' ? (
                          <div className="relative aspect-video">
                            <img 
                              src="/smart-scheduling-preview.png" 
                              alt={`${feature.title} preview`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : feature.id === 'automation-integrations' ? (
                          <div className="relative aspect-video">
                            <img 
                              src="/automations-preview.png" 
                              alt={`${feature.title} preview`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : feature.id === 'progress-analytics' ? (
                          <div className="relative aspect-video">
                            <img 
                              src="/analytics-preview.png" 
                              alt={`${feature.title} preview`}
                              className="w-full h-full object-contain"
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
                  </div>
                </div>
              </article>
            ))}

            <section className="text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-slate-100 transition-colors">
                {t('pages.features.moreComing')}
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 transition-colors max-w-2xl mx-auto">
                {t('pages.features.moreComingDescription')}
              </p>
              {IS_PRE_LAUNCH ? (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setWaitlistModalOpen(true)
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition-transform transition-shadow hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                >
                  Join Waitlist
                </button>
              ) : (
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/30 transition-transform transition-shadow hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                >
                  {t('pages.features.moreComingCta')}
                </Link>
              )}
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

