'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Button } from '@/components/ui/Button'
import { useSupabase } from '@/components/providers/supabase-provider'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

// Hide pricing page during pre-launch - redirect to homepage
const SHOW_PRICING_PAGE = !IS_PRE_LAUNCH

// Pricing card component with animation
function PricingCard({
  plan,
  delay,
  proAnimating,
  billingCycle,
  trialEligible
}: {
  plan: {
    id: string
    name: string
    blurb: string
    price: string
    suffix: string
    note: string
    highlights: string[]
    ctaLabel: string
    href: string
    emphasis: boolean
    trialBadge?: string
    trialDescription?: string
    afterTrial?: string
  }
  delay: number
  proAnimating: boolean
  billingCycle: 'monthly' | 'annual'
  trialEligible: boolean | null
}) {
  const cardAnim = useScrollAnimation({ delay, triggerOnce: true })
  const t = useTranslations()

  return (
    <div
      ref={cardAnim.ref as React.RefObject<HTMLDivElement>}
      className={`relative flex h-full flex-col gap-6 rounded-3xl border border-gray-800 bg-gray-900 p-6 sm:p-8 shadow-sm transition-colors scroll-animate-fade-up ${cardAnim.isVisible ? 'visible' : ''} ${
        plan.emphasis
          ? 'ring-2 ring-white/10'
          : ''
      } ${plan.id === 'pro' && proAnimating ? 'pro-plan-fade' : ''}`}
    >
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {plan.name}
          </p>
          {plan.id === 'pro' && billingCycle === 'annual' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800">
              Save 33%
            </span>
          )}
          {plan.id === 'pro' && billingCycle === 'monthly' && trialEligible !== false && plan.trialBadge && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800">
              {plan.trialBadge}
            </span>
          )}
        </div>
        {plan.price && (
          <div className="mt-4">
            {plan.id === 'pro' && billingCycle === 'annual' && (
              <div className="mb-2">
                <span className="text-sm text-slate-400 line-through mr-2">
                  $20/mo
                </span>
                <span className="text-xs font-semibold text-green-400">
                  33% off
                </span>
              </div>
            )}
            {plan.id === 'pro' && billingCycle === 'monthly' && trialEligible !== false && plan.trialDescription && (
              <div className="mb-2">
                <p className="text-sm font-semibold text-blue-400">
                  {plan.trialDescription}
                </p>
                {plan.afterTrial && (
                  <p className="text-xs text-slate-400 mt-1">
                    {plan.afterTrial}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-bold text-slate-100">
                {plan.id === 'pro' && billingCycle === 'monthly' && trialEligible !== false ? '$0' : (plan.id === 'pro' && billingCycle === 'annual' ? '$14' : plan.price)}
                <span className="text-base font-medium text-slate-400">
                  {plan.id === 'pro' && billingCycle === 'annual' ? '/mo' : plan.suffix}
                </span>
              </p>
              {plan.id === 'pro' && billingCycle === 'monthly' && trialEligible !== false && (
                <span className="text-lg sm:text-xl text-slate-400 line-through">$20</span>
              )}
            </div>
          </div>
        )}
        {plan.note && (
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            {plan.note}
          </p>
        )}
      </div>

      <p className="text-sm text-slate-300">{plan.blurb}</p>

      {plan.highlights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t('pages.pricing.includedFeatures')}
          </h3>
          <ul className="space-y-2 text-sm list-disc pl-4 marker:text-slate-500">
            {plan.highlights.map((feature) => (
              <li
                key={feature}
                className="text-slate-200 !opacity-100"
              >
                <span className="font-medium leading-relaxed text-slate-100">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto">
        <Link href={plan.href}>
          <Button
            size="lg"
            variant={plan.emphasis ? 'primary' : 'default'}
            className={`w-full transition-colors duration-200 ${
              plan.emphasis
                ? 'hover:bg-[#e67300]'
                : 'bg-gray-900 text-slate-100 border border-gray-700 hover:bg-gray-800 hover:border-gray-600'
            }`}
          >
            {plan.ctaLabel}
          </Button>
        </Link>
      </div>
    </div>
  )
}


export default function PricingPage() {
  const router = useRouter()
  
  // Redirect to homepage if pricing is hidden
  useEffect(() => {
    if (!SHOW_PRICING_PAGE) {
      router.push('/')
    }
  }, [router])

  // Don't render anything while redirecting
  if (!SHOW_PRICING_PAGE) {
    return null
  }
  const t = useTranslations()
  const { user } = useSupabase()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [proAnimating, setProAnimating] = useState(false)
  const [trialEligible, setTrialEligible] = useState<boolean | null>(null)
  const isFirstRender = useRef(true)

  // Animation hooks
  const titleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const descAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const billingToggleAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const customPlanAnim = useScrollAnimation({ delay: 600, triggerOnce: true })

  // Log translation availability on mount
  useEffect(() => {
    try {
      const testTranslation = t('pages.pricing.title')
      if (testTranslation === 'pages.pricing.title') {
        logger.error('Translation key returned as-is (translation missing)', {
          key: 'pages.pricing.title',
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      } else {
        logger.info('Pricing page translations loaded successfully', {
          sampleTranslation: testTranslation,
          userAgent: navigator.userAgent.substring(0, 100)
        })
      }
    } catch (error) {
      logger.error('Error accessing translations on pricing page', {
        error: error instanceof Error ? error.message : String(error),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }
  }, [t])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    setProAnimating(true)
    const timeout = setTimeout(() => setProAnimating(false), 350)

    return () => clearTimeout(timeout)
  }, [billingCycle])

  // Check trial eligibility for Pro Monthly
  useEffect(() => {
    if (!user?.id) {
      setTrialEligible(null)
      return
    }

    const checkTrialEligibility = async () => {
      try {
        const response = await fetch('/api/subscription/trial-eligibility')
        if (response.ok) {
          const data = await response.json()
          setTrialEligible(data.eligible)
        } else {
          // On error, assume not eligible (fail closed for security)
          setTrialEligible(false)
        }
      } catch (error) {
        console.error('[Pricing] Error checking trial eligibility:', error)
        // On error, assume not eligible (fail closed for security)
        setTrialEligible(false)
      }
    }

    checkTrialEligibility()
  }, [user?.id])

  const plans = useMemo(() => {
    const basicPlan: {
      id: string
      name: string
      blurb: string
      price: string
      suffix: string
      note: string
      credits: string[]
      highlights: string[]
      ctaLabel: string
      href: string
      emphasis: boolean
      trialBadge?: string
      trialDescription?: string
      afterTrial?: string
    } = {
      id: 'basic',
      name: t('pages.pricing.plans.basic.name'),
      blurb: t('pages.pricing.plans.basic.blurb'),
      price: t('pages.pricing.plans.basic.price'),
      suffix: t('pages.pricing.plans.basic.suffix'),
      note: t('pages.pricing.plans.basic.note'),
      credits: [],
      highlights: [
        t('pages.pricing.plans.basic.highlights.0'),
        t('pages.pricing.plans.basic.highlights.1'),
        t('pages.pricing.plans.basic.highlights.2'),
        t('pages.pricing.plans.basic.highlights.3'),
        t('pages.pricing.plans.basic.highlights.4'),
      ],
      ctaLabel: t('pages.pricing.plans.basic.ctaLabel'),
      href: user ? `/checkout?plan=basic&cycle=monthly` : '/auth/signup?plan=free',
      emphasis: false,
    }

    const proPlan: {
      id: string
      name: string
      blurb: string
      price: string
      suffix: string
      note: string
      credits: string[]
      highlights: string[]
      ctaLabel: string
      href: string
      emphasis: boolean
      trialBadge?: string
      trialDescription?: string
      afterTrial?: string
    } = {
      id: 'pro',
      name: t('pages.pricing.plans.pro.name'),
      blurb: t('pages.pricing.plans.pro.blurb'),
      price: t(`pages.pricing.plans.pro.price.${billingCycle}.primary`),
      suffix: t(`pages.pricing.plans.pro.price.${billingCycle}.suffix`),
      note: t(`pages.pricing.plans.pro.note.${billingCycle}`),
      trialBadge: billingCycle === 'monthly' ? t('pages.pricing.plans.pro.trial.badge') : undefined,
      trialDescription: billingCycle === 'monthly' ? t('pages.pricing.plans.pro.trial.description') : undefined,
      afterTrial: billingCycle === 'monthly' ? t('pages.pricing.plans.pro.trial.afterTrial') : undefined,
      credits: [],
      highlights: [
        t('pages.pricing.plans.pro.highlights.0'),
        t('pages.pricing.plans.pro.highlights.1'),
        t('pages.pricing.plans.pro.highlights.2'),
        t('pages.pricing.plans.pro.highlights.3'),
        t('pages.pricing.plans.pro.highlights.4'),
        t('pages.pricing.plans.pro.highlights.5'),
        t('pages.pricing.plans.pro.highlights.6'),
      ],
      ctaLabel: t('pages.pricing.plans.pro.ctaLabel'),
      href: user ? `/checkout?plan=pro&cycle=${billingCycle}` : `/auth/signup?plan=pro&cycle=${billingCycle}`,
      emphasis: true,
    }

    return [basicPlan, proPlan]
  }, [billingCycle, t, user, trialEligible])

  const customPlan = useMemo(
    () => ({
      id: 'custom',
      name: t('pages.pricing.plans.custom.name'),
      blurb: t('pages.pricing.plans.custom.blurb'),
      ctaLabel: t('pages.pricing.plans.custom.ctaLabel'),
      href: '/contact?topic=sales',
    }),
    [t]
  )

  const creditTooltipText = t('pages.pricing.creditTooltip')

  return (
    <>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 6px rgba(249, 115, 22, 0.4), 0 0 10px rgba(249, 115, 22, 0.2);
          }
          50% {
            box-shadow: 0 0 10px rgba(249, 115, 22, 0.6), 0 0 15px rgba(249, 115, 22, 0.3);
          }
        }
        @keyframes pulse-glow-dark {
          0%, 100% {
            box-shadow: 0 0 6px rgba(251, 146, 60, 0.4), 0 0 10px rgba(251, 146, 60, 0.2);
          }
          50% {
            box-shadow: 0 0 10px rgba(251, 146, 60, 0.6), 0 0 15px rgba(251, 146, 60, 0.3);
          }
        }
        @keyframes pulse-glow-subtle {
          0%, 100% {
            box-shadow: 0 0 3px rgba(249, 115, 22, 0.25);
          }
          50% {
            box-shadow: 0 0 5px rgba(249, 115, 22, 0.35);
          }
        }
        @keyframes pulse-glow-subtle-dark {
          0%, 100% {
            box-shadow: 0 0 3px rgba(251, 146, 60, 0.25);
          }
          50% {
            box-shadow: 0 0 5px rgba(251, 146, 60, 0.35);
          }
        }
        .glow-animated {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .glow-animated {
          animation: pulse-glow-dark 2s ease-in-out infinite;
        }
        .glow-animated-subtle {
          animation: pulse-glow-subtle-dark 2s ease-in-out infinite;
        }
      `}</style>
      <div className="min-h-screen bg-gray-900 flex flex-col transition-colors">
        <PublicHeader />
      
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-12 bg-gray-900 transition-colors">
        <div className="max-w-4xl mx-auto text-center">
          <h1 
            ref={titleAnim.ref as React.RefObject<HTMLHeadingElement>}
            className={`text-3xl sm:text-4xl md:text-5xl font-bold text-slate-100 mb-4 scroll-animate-fade-up ${titleAnim.isVisible ? 'visible' : ''}`}
          >
            {t('pages.pricing.title')}
          </h1>
          <p 
            ref={descAnim.ref as React.RefObject<HTMLParagraphElement>}
            className={`text-base sm:text-lg md:text-xl text-slate-300 mb-10 max-w-3xl mx-auto scroll-animate-fade-up ${descAnim.isVisible ? 'visible' : ''}`}
          >
            {t('pages.pricing.description')}
          </p>
        </div>

        <div className="mx-auto max-w-6xl space-y-10">
          <div 
            ref={billingToggleAnim.ref as React.RefObject<HTMLDivElement>}
            className={`flex items-center justify-center gap-3 scroll-animate-fade-up ${billingToggleAnim.isVisible ? 'visible' : ''}`}
          >
            <span className="text-sm font-medium text-slate-300">
              {t('pages.pricing.billing.label')}
            </span>
            <div className="inline-flex rounded-full border border-slate-700 bg-slate-800/90 p-1 text-sm font-semibold shadow-sm">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-4 py-2 min-h-[44px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-200 ${
                  billingCycle === 'monthly'
                    ? 'bg-orange-400 text-slate-950 shadow-sm'
                    : 'text-slate-300 bg-transparent hover:text-slate-100 hover:bg-slate-700/70'
                }`}
              >
                {t('pages.pricing.billing.monthly')}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-full px-4 py-2 min-h-[44px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-200 ${
                  billingCycle === 'annual'
                    ? 'bg-orange-400 text-slate-950 glow-animated'
                    : 'text-slate-300 bg-transparent hover:text-slate-100 hover:bg-slate-700/70 glow-animated-subtle'
                }`}
              >
                {t('pages.pricing.billing.annual')}
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {plans.map((plan, index) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                delay={300 + (index * 150)}
                proAnimating={proAnimating}
                billingCycle={billingCycle}
                trialEligible={trialEligible}
              />
            ))}
          </div>

          <div className="mx-auto max-w-3xl">
            <div 
              ref={customPlanAnim.ref as React.RefObject<HTMLDivElement>}
              className={`relative flex h-full flex-col gap-4 rounded-3xl border border-gray-800 bg-gray-900 p-6 sm:p-8 text-center shadow-sm transition-colors scroll-animate-fade-up ${customPlanAnim.isVisible ? 'visible' : ''}`}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {customPlan.name}
              </p>
              <p className="text-base text-slate-300">{customPlan.blurb}</p>
              <div className="mt-auto">
                <Link href={customPlan.href}>
                  <Button
                    size="lg"
                    variant="default"
                    className="w-full bg-gray-900 text-slate-100 border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors duration-200"
                  >
                    {customPlan.ctaLabel}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
      </div>
    </>
  )
}





