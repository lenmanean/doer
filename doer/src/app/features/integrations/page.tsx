'use client'

import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import Link from 'next/link'
import { integrations } from '@/data/integrations'
import { 
  SiGooglecalendar, 
  SiApple, 
  SiTodoist, 
  SiAsana, 
  SiTrello, 
  SiNotion, 
  SiSlack, 
  SiStrava
} from 'react-icons/si'
import { MdEmail } from 'react-icons/md'
import type { ComponentType } from 'react'

// Mapping integration keys to icon components (same as landing page carousel)
const integrationIconMap: Record<string, ComponentType<{ className?: string }>> = {
  googleCalendar: SiGooglecalendar,
  outlook: MdEmail,
  appleCalendar: SiApple,
  todoist: SiTodoist,
  asana: SiAsana,
  trello: SiTrello,
  notion: SiNotion,
  slack: SiSlack,
  strava: SiStrava,
}

// Integration card component with animation
function IntegrationCard({
  integration,
  category,
  delay,
  IconComponent
}: {
  integration: any
  category: string
  delay: number
  IconComponent: any
}) {
  const cardAnim = useScrollAnimation({ delay, triggerOnce: true })
  const t = useTranslations()

  return (
    <article
      ref={cardAnim.ref as React.RefObject<HTMLElement>}
      className={`relative overflow-hidden rounded-3xl border border-gray-700 bg-gray-800 p-6 shadow-lg shadow-black/40 transition-colors scroll-animate-fade-up ${cardAnim.isVisible ? 'visible' : ''}`}
    >
      <div className="flex items-center justify-between">
        {IconComponent ? (
          <div className="w-12 h-12 flex items-center justify-center text-white">
            <IconComponent className="w-full h-full" />
          </div>
        ) : (
          <span className="text-3xl">{integration.icon}</span>
        )}
        <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          {category}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-slate-50">
        {integration.name}
      </h3>
      <p className="mt-3 text-sm text-slate-300 leading-relaxed">
        {(() => {
          try {
            const translated = t(integration.descriptionKey)
            return translated === integration.descriptionKey 
              ? integration.description 
              : translated
          } catch {
            return integration.description
          }
        })()}
      </p>
      <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-wide text-orange-500">
        <span>AI Scheduler</span>
        <Link
          href="/settings/integrations"
          className="text-xs font-semibold text-orange-600 hover:text-orange-500"
        >
          Learn how → 
        </Link>
      </div>
    </article>
  )
}

// Category section component with animation
function CategorySection({
  category,
  categoryIndex,
  integrations,
  integrationIconMap
}: {
  category: string
  categoryIndex: number
  integrations: any[]
  integrationIconMap: Record<string, any>
}) {
  const categoryAnim = useScrollAnimation({ delay: 600 + (categoryIndex * 100), triggerOnce: true })
  const t = useTranslations()

  return (
    <section className="space-y-6">
      <div 
        ref={categoryAnim.ref as React.RefObject<HTMLDivElement>}
        className={`flex items-center justify-between scroll-animate-fade-up ${categoryAnim.isVisible ? 'visible' : ''}`}
      >
        <h2 className="text-2xl font-semibold text-slate-100">{category}</h2>
        <span className="text-sm text-slate-400">
          {integrations.filter((integration) => integration.category === category).length} tools
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations
          .filter((integration) => integration.category === category)
          .map((integration, index) => {
            const IconComponent = integrationIconMap[integration.key]
            return (
              <IntegrationCard
                key={integration.key}
                integration={integration}
                category={category}
                delay={700 + (categoryIndex * 100) + (index * 50)}
                IconComponent={IconComponent}
              />
            )
          })}
      </div>
    </section>
  )
}

export default function IntegrationsPage() {
  const t = useTranslations()

  const categories = Array.from(new Set(integrations.map((integration) => integration.category)))

  // Animation hooks
  const badgeAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const titleAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const subtitleAnim = useScrollAnimation({ delay: 300, triggerOnce: true })
  const descAnim = useScrollAnimation({ delay: 450, triggerOnce: true })
  const footerAnim = useScrollAnimation({ delay: 600, triggerOnce: true })

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col transition-colors">
      <PublicHeader />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-16">
          <section className="text-center space-y-4">
            <p 
              ref={badgeAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-sm font-semibold uppercase tracking-widest text-orange-500 scroll-animate-fade-up ${badgeAnim.isVisible ? 'visible' : ''}`}
            >
              Connected systems
            </p>
            <h1 
              ref={titleAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-4xl md:text-5xl font-bold text-slate-100 transition-colors scroll-animate-fade-up ${titleAnim.isVisible ? 'visible' : ''}`}
            >
              {t('pages.integrations.title')}
            </h1>
            <p 
              ref={subtitleAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-lg text-slate-300 max-w-3xl mx-auto transition-colors scroll-animate-fade-up ${subtitleAnim.isVisible ? 'visible' : ''}`}
            >
              {t('pages.integrations.description')}
            </p>
            <p 
              ref={descAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-sm text-slate-400 max-w-2xl mx-auto scroll-animate-fade-up ${descAnim.isVisible ? 'visible' : ''}`}
            >
              {(() => {
                try {
                  const translated = t('pages.integrations.subtitle')
                  return translated === 'pages.integrations.subtitle' 
                    ? 'Each connector keeps the AI scheduler aware of your calendars, tasks, and energy so every update is reflected instantly.'
                    : translated
                } catch {
                  return 'Each connector keeps the AI scheduler aware of your calendars, tasks, and energy so every update is reflected instantly.'
                }
              })()}
            </p>
          </section>

          {categories.map((category, categoryIndex) => (
            <CategorySection
              key={category}
              category={category}
              categoryIndex={categoryIndex}
              integrations={integrations}
              integrationIconMap={integrationIconMap}
            />
          ))}

          <section 
            ref={footerAnim.ref as React.RefObject<HTMLElement>}
            className={`text-center space-y-2 scroll-animate-fade-up ${footerAnim.isVisible ? 'visible' : ''}`}
          >
            <p className="text-slate-300">
              Need a connector that is not listed?
            </p>
            <Link href="/feature-request">
              <span className="text-orange-500 hover:text-orange-600 font-semibold transition-colors">
                Request an integration
              </span>
            </Link>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

