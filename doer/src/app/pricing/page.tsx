'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Button } from '@/components/ui/Button'
import { useSupabase } from '@/components/providers/supabase-provider'

// Hide pricing page until launch - redirect to homepage
const SHOW_PRICING_PAGE = false

type CreditTooltipProps = {
  text: string
}

function CreditTooltip({ text }: CreditTooltipProps) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300" />
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 shadow-lg group-hover:block dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {text}
      </span>
    </span>
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
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    setProAnimating(true)
    const timeout = setTimeout(() => setProAnimating(false), 350)

    return () => clearTimeout(timeout)
  }, [billingCycle])

  const plans = useMemo(() => {
    const basicPlan = {
      id: 'basic',
      name: t('pages.pricing.plans.basic.name'),
      blurb: t('pages.pricing.plans.basic.blurb'),
      price: t('pages.pricing.plans.basic.price'),
      suffix: t('pages.pricing.plans.basic.suffix'),
      note: t('pages.pricing.plans.basic.note'),
      credits: [
        {
          label: t('pages.pricing.plans.basic.credits.api.label'),
          value: t('pages.pricing.plans.basic.credits.api.value'),
        },
      ],
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

    const proPlan = {
      id: 'pro',
      name: t('pages.pricing.plans.pro.name'),
      blurb: t('pages.pricing.plans.pro.blurb'),
      price: t(`pages.pricing.plans.pro.price.${billingCycle}.primary`),
      suffix: t(`pages.pricing.plans.pro.price.${billingCycle}.suffix`),
      note: t(`pages.pricing.plans.pro.note.${billingCycle}`),
      credits: [
        {
          label: t('pages.pricing.plans.pro.credits.api.label'),
          value: t(`pages.pricing.plans.pro.credits.api.value.${billingCycle}`),
        },
        {
          label: t('pages.pricing.plans.pro.credits.integrations.label'),
          value: t(`pages.pricing.plans.pro.credits.integrations.value.${billingCycle}`),
        },
      ],
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
  }, [billingCycle, t, user])

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
        .dark .glow-animated {
          animation: pulse-glow-dark 2s ease-in-out infinite;
        }
        .glow-animated-subtle {
          animation: pulse-glow-subtle 2s ease-in-out infinite;
        }
        .dark .glow-animated-subtle {
          animation: pulse-glow-subtle-dark 2s ease-in-out infinite;
        }
      `}</style>
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors">
        <PublicHeader />
      
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-12 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            {t('pages.pricing.title')}
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-3xl mx-auto">
            {t('pages.pricing.description')}
          </p>
        </div>

        <div className="mx-auto max-w-6xl space-y-10">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {t('pages.pricing.billing.label')}
            </span>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 text-sm font-semibold shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-4 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:focus-visible:outline-slate-200 ${
                  billingCycle === 'monthly'
                    ? 'bg-orange-500 text-white shadow-sm dark:bg-orange-400 dark:text-slate-950'
                    : 'text-slate-600 bg-transparent hover:text-slate-900 hover:bg-white/70 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-700/70'
                }`}
              >
                {t('pages.pricing.billing.monthly')}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-full px-4 py-1 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:focus-visible:outline-slate-200 ${
                  billingCycle === 'annual'
                    ? 'bg-orange-500 text-white dark:bg-orange-400 dark:text-slate-950 glow-animated'
                    : 'text-slate-600 bg-transparent hover:text-slate-900 hover:bg-white/70 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-700/70 glow-animated-subtle'
                }`}
              >
                {t('pages.pricing.billing.annual')}
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex h-full flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900 ${
                  plan.emphasis
                    ? 'ring-2 ring-slate-900/10 dark:ring-white/10'
                    : ''
                } ${plan.id === 'pro' && proAnimating ? 'pro-plan-fade' : ''}`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {plan.name}
                    </p>
                    {plan.id === 'pro' && billingCycle === 'annual' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                        Save 33%
                      </span>
                    )}
                  </div>
                  {plan.price && (
                    <div className="mt-4">
                      {plan.id === 'pro' && billingCycle === 'annual' && (
                        <div className="mb-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400 line-through mr-2">
                            $20/mo
                          </span>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            33% off
                          </span>
                        </div>
                      )}
                      <p className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                        {plan.id === 'pro' && billingCycle === 'annual' ? '$14' : plan.price}
                        <span className="text-base font-medium text-slate-500 dark:text-slate-400">
                          {plan.id === 'pro' && billingCycle === 'annual' ? '/mo' : plan.suffix}
                        </span>
                      </p>
                    </div>
                  )}
                  {plan.note && (
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {plan.note}
                    </p>
                  )}
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300">{plan.blurb}</p>

                {plan.credits.length > 0 && (
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {plan.credits.map((credit) => (
                      <div
                        key={credit.label}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
                      >
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          {credit.label}
                          <CreditTooltip text={creditTooltipText} />
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {credit.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {plan.highlights.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      {t('pages.pricing.includedFeatures')}
                    </h3>
                    <ul className="space-y-2 text-sm list-disc pl-4 marker:text-slate-500 dark:marker:text-slate-500">
                      {plan.highlights.map((feature) => (
                        <li
                          key={feature}
                          className="text-slate-900 dark:text-slate-200 !opacity-100"
                        >
                          <span className="font-medium leading-relaxed text-slate-900 dark:text-slate-100">
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
                          : 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-100 hover:border-slate-400 dark:bg-gray-900 dark:text-slate-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:border-gray-600'
                      }`}
                    >
                      {plan.ctaLabel}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="relative flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {customPlan.name}
              </p>
              <p className="text-base text-slate-600 dark:text-slate-300">{customPlan.blurb}</p>
              <div className="mt-auto">
                <Link href={customPlan.href}>
                  <Button
                    size="lg"
                    variant="default"
                    className="w-full bg-white text-slate-900 border border-slate-300 hover:bg-slate-100 hover:border-slate-400 dark:bg-gray-900 dark:text-slate-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:border-gray-600 transition-colors duration-200"
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





