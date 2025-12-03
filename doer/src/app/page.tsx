'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSupabase } from '@/components/providers/supabase-provider'
import { Button } from '@/components/ui/Button'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { WaitlistModal } from '@/components/ui/WaitlistModal'
import { LaunchCountdownBanner } from '@/components/ui/LaunchCountdownBanner'
import { GoalInput } from '@/components/ui/GoalInput'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { 
  SiGooglecalendar, 
  SiApple, 
  SiTodoist, 
  SiAsana, 
  SiTrello, 
  SiNotion, 
  SiEvernote, 
  SiSlack, 
  SiStrava,
  SiCoursera,
  SiUdemy
} from 'react-icons/si'
import { FaHeartbeat, FaMicrosoft } from 'react-icons/fa'
import { MdEmail } from 'react-icons/md'

export default function Home() {
  const router = useRouter()
  const { user, loading, sessionReady } = useSupabase()
  const t = useTranslations()
  const [expandedStep, setExpandedStep] = useState<string | null>('step1')
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistInitialGoal, setWaitlistInitialGoal] = useState<string>('')

  // Listen for custom event from PublicHeader to open waitlist modal
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

  // Debug: Log feature flag values
  useEffect(() => {
    console.log('[DEBUG] Feature Flag Values:', {
      'NEXT_PUBLIC_APP_LAUNCH_STATUS': process.env.NEXT_PUBLIC_APP_LAUNCH_STATUS,
      'IS_LAUNCHED': !IS_PRE_LAUNCH,
      'IS_PRE_LAUNCH': IS_PRE_LAUNCH,
      'Will show GoalInput': !IS_PRE_LAUNCH,
      'Will show WaitlistForm': IS_PRE_LAUNCH,
    })
  }, [])

  // Handle authentication code parameter - redirect to callback handler
  // The callback route will handle redirecting to the production domain
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      
      if (code) {
        // Always redirect to callback route - it will handle domain switching server-side
        // This ensures the code is processed and the user is redirected correctly
        const callbackUrl = new URL(window.location.href)
        callbackUrl.pathname = '/auth/callback'
        // Preserve code and next parameters
        callbackUrl.search = window.location.search
        // Use replace to avoid adding to history
        window.location.replace(callbackUrl.toString())
        return
      }
    }
  }, [])

  const isAuthenticated = Boolean(user && sessionReady && !loading)

  const suggestions = [
    t('hero.suggestion1'),
    t('hero.suggestion2'),
    t('hero.suggestion3'),
    t('hero.suggestion4'),
  ]

  // Scroll animation hooks - defined once at component level
  const heroHeadlineAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const heroSubheadlineAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const featureTitleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const featureDescAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const integrationsTitleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const integrationsDescAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const integrationsCarouselAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const testimonialsTitleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const testimonialsDescAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const testimonialsCarouselAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const faqTitleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const faqDescAnim = useScrollAnimation({ delay: 150, triggerOnce: true })
  const faqItemsAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const pricingTitleAnim = useScrollAnimation({ delay: 0, triggerOnce: true })
  const pricingDescAnim = useScrollAnimation({ delay: 150, triggerOnce: true })

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Launch Countdown Banner - Pre-launch only */}
      {IS_PRE_LAUNCH && <LaunchCountdownBanner />}
      <PublicHeader />

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1
              ref={heroHeadlineAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-6xl md:text-7xl font-bold text-gray-900 dark:text-white mb-8 leading-tight scroll-animate-fade-up ${heroHeadlineAnim.isVisible ? 'visible' : ''}`}
            >
              {t('hero.headline')}
            </h1>
            <p
              ref={heroSubheadlineAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-2xl text-gray-600 dark:text-gray-300 mb-10 leading-relaxed scroll-animate-fade-up ${heroSubheadlineAnim.isVisible ? 'visible' : ''}`}
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
              onGoalSubmit={(goal) => {
                setWaitlistInitialGoal(goal)
                setWaitlistModalOpen(true)
              }}
            />
            {!IS_PRE_LAUNCH && !isAuthenticated && (
              <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <Link href="/login" className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300">
                  Log in
                </Link>
              </p>
            )}
          </div>
                        </div>
      </section>

      {/* Feature Showcase with Expandable Steps */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2
              ref={featureTitleAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 scroll-animate-fade-up ${featureTitleAnim.isVisible ? 'visible' : ''}`}
            >
              {t('features.title')}
            </h2>
            <p
              ref={featureDescAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto scroll-animate-fade-up ${featureDescAnim.isVisible ? 'visible' : ''}`}
            >
              {t('features.description')}
            </p>
          </div>

          {/* Vertical Expandable Steps */}
          <div className="space-y-4">
            {[
              { id: 'step1', stepNum: 1, label: t('tabs.step1'), title: t('tabs.step1Title'), description: t('tabs.step1Description') },
              { id: 'step2', stepNum: 2, label: t('tabs.step2'), title: t('tabs.step2Title'), description: t('tabs.step2Description') },
              { id: 'step3', stepNum: 3, label: t('tabs.step3'), title: t('tabs.step3Title'), description: t('tabs.step3Description') },
            ].map((step, index) => {
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

      {/* Integrations Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center mb-16">
            <h2
              ref={integrationsTitleAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 scroll-animate-fade-up ${integrationsTitleAnim.isVisible ? 'visible' : ''}`}
            >
              {t('integrations.title')}
            </h2>
            <p
              ref={integrationsDescAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-2xl text-gray-600 dark:text-gray-300 scroll-animate-fade-up ${integrationsDescAnim.isVisible ? 'visible' : ''}`}
            >
              {t('integrations.description')}
            </p>
          </div>
        </div>

        {/* Animated Carousel */}
        <div 
          ref={integrationsCarouselAnim.ref as React.RefObject<HTMLDivElement>}
          className={`mt-12 overflow-hidden scroll-animate-fade-up ${integrationsCarouselAnim.isVisible ? 'visible' : ''}`}
        >
          {/* Scrolling container */}
          <div className="flex animate-scroll gap-8 px-4 sm:px-6 lg:px-8">
            {[
              { name: 'Google Calendar', Icon: SiGooglecalendar },
              { name: 'Outlook', Icon: MdEmail },
              { name: 'Apple Calendar', Icon: SiApple },
              { name: 'Todoist', Icon: SiTodoist },
              { name: 'Asana', Icon: SiAsana },
              { name: 'Trello', Icon: SiTrello },
              { name: 'Notion', Icon: SiNotion },
              { name: 'Evernote', Icon: SiEvernote },
              { name: 'Slack', Icon: SiSlack },
              { name: 'Microsoft Teams', Icon: FaMicrosoft },
              { name: 'Strava', Icon: SiStrava },
              { name: 'Apple Health', Icon: FaHeartbeat },
              { name: 'Coursera', Icon: SiCoursera },
              { name: 'Udemy', Icon: SiUdemy },
            ].map((integration, index) => (
              <div
                key={`${integration.name}-${index}`}
                className="flex-shrink-0 w-32 h-32 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-900 dark:border-gray-700 p-4 flex flex-col items-center justify-center hover:border-orange-500 dark:hover:border-gray-500 transition-colors"
              >
                <div className="w-12 h-12 mb-2 flex items-center justify-center text-gray-700 dark:text-white">
                  <integration.Icon className="w-full h-full" />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white text-center">
                  {integration.name}
                </p>
              </div>
            ))}
            {/* Duplicate 1 for seamless loop */}
            {[
              { name: 'Google Calendar', Icon: SiGooglecalendar },
              { name: 'Outlook', Icon: MdEmail },
              { name: 'Apple Calendar', Icon: SiApple },
              { name: 'Todoist', Icon: SiTodoist },
              { name: 'Asana', Icon: SiAsana },
              { name: 'Trello', Icon: SiTrello },
              { name: 'Notion', Icon: SiNotion },
              { name: 'Evernote', Icon: SiEvernote },
              { name: 'Slack', Icon: SiSlack },
              { name: 'Microsoft Teams', Icon: FaMicrosoft },
              { name: 'Strava', Icon: SiStrava },
              { name: 'Apple Health', Icon: FaHeartbeat },
              { name: 'Coursera', Icon: SiCoursera },
              { name: 'Udemy', Icon: SiUdemy },
            ].map((integration, index) => (
              <div
                key={`duplicate-1-${integration.name}-${index}`}
                className="flex-shrink-0 w-32 h-32 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-900 dark:border-gray-700 p-4 flex flex-col items-center justify-center hover:border-orange-500 dark:hover:border-gray-500 transition-colors"
              >
                <div className="w-12 h-12 mb-2 flex items-center justify-center text-gray-700 dark:text-white">
                  <integration.Icon className="w-full h-full" />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white text-center">
                  {integration.name}
                </p>
              </div>
            ))}
            {/* Duplicate 2 for seamless loop */}
            {[
              { name: 'Google Calendar', Icon: SiGooglecalendar },
              { name: 'Outlook', Icon: MdEmail },
              { name: 'Apple Calendar', Icon: SiApple },
              { name: 'Todoist', Icon: SiTodoist },
              { name: 'Asana', Icon: SiAsana },
              { name: 'Trello', Icon: SiTrello },
              { name: 'Notion', Icon: SiNotion },
              { name: 'Evernote', Icon: SiEvernote },
              { name: 'Slack', Icon: SiSlack },
              { name: 'Microsoft Teams', Icon: FaMicrosoft },
              { name: 'Strava', Icon: SiStrava },
              { name: 'Apple Health', Icon: FaHeartbeat },
              { name: 'Coursera', Icon: SiCoursera },
              { name: 'Udemy', Icon: SiUdemy },
            ].map((integration, index) => (
              <div
                key={`duplicate-2-${integration.name}-${index}`}
                className="flex-shrink-0 w-32 h-32 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-900 dark:border-gray-700 p-4 flex flex-col items-center justify-center hover:border-orange-500 dark:hover:border-gray-500 transition-colors"
              >
                <div className="w-12 h-12 mb-2 flex items-center justify-center text-gray-700 dark:text-white">
                  <integration.Icon className="w-full h-full" />
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white text-center">
                  {integration.name}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12 px-4 sm:px-6 lg:px-8">
          <Link href="/integrations">
            <Button variant="outline" size="sm">
              View all integrations
            </Button>
          </Link>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center mb-16">
            <h2 
              ref={testimonialsTitleAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 scroll-animate-fade-up ${testimonialsTitleAnim.isVisible ? 'visible' : ''}`}
            >
              {t('testimonials.title')}
            </h2>
            <p 
              ref={testimonialsDescAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-2xl text-gray-600 dark:text-gray-300 scroll-animate-fade-up ${testimonialsDescAnim.isVisible ? 'visible' : ''}`}
            >
              {t('testimonials.description')}
            </p>
          </div>
        </div>

        {/* Testimonials Carousel */}
        <div 
          ref={testimonialsCarouselAnim.ref as React.RefObject<HTMLDivElement>}
          className={`mt-12 overflow-hidden scroll-animate-fade-up ${testimonialsCarouselAnim.isVisible ? 'visible' : ''}`}
        >
          <div className="flex animate-scroll-reverse gap-8 px-4 sm:px-6 lg:px-8">
              {[
                {
                  name: 'Sarah Chen',
                  handle: '@sarahchen',
                  platform: 'Twitter',
                  avatar: '👩‍💼',
                  text: 'DOER completely changed how I approach my goals. The AI-generated plans are incredibly detailed and actually achievable!',
                  date: '2 days ago'
                },
                {
                  name: 'Marcus Johnson',
                  handle: '@marcus_j',
                  platform: 'ProductHunt',
                  avatar: '👨‍💻',
                  text: 'Finally, a productivity tool that understands context. The smart scheduling alone is worth it. Highly recommend!',
                  date: '1 week ago'
                },
                {
                  name: 'Elena Rodriguez',
                  handle: '@elenarod',
                  platform: 'Twitter',
                  avatar: '👩‍🎨',
                  text: 'I went from feeling overwhelmed to actually completing my certification course. The progress tracking kept me motivated throughout.',
                  date: '3 days ago'
                },
                {
                  name: 'David Kim',
                  handle: '@davidkim',
                  platform: 'LinkedIn',
                  avatar: '👨‍🔬',
                  text: 'The integrations with my existing tools made the transition seamless. DOER fits perfectly into my workflow.',
                  date: '5 days ago'
                },
                {
                  name: 'Priya Patel',
                  handle: '@priyap',
                  platform: 'Twitter',
                  avatar: '👩‍🏫',
                  text: 'As an educator, I use DOER to help students break down complex projects. The clarity it provides is invaluable.',
                  date: '1 week ago'
                },
                {
                  name: 'Alex Turner',
                  handle: '@alexturner',
                  platform: 'ProductHunt',
                  avatar: '👨‍🎤',
                  text: 'Best goal-tracking app I\'ve used. The AI suggestions are spot-on and the interface is clean and intuitive.',
                  date: '4 days ago'
                },
              ].map((testimonial, index) => (
                <div
                  key={`${testimonial.handle}-${index}`}
                  className="flex-shrink-0 w-80 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-900 dark:border-gray-700 p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-4xl">{testimonial.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {testimonial.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {testimonial.handle} • {testimonial.platform}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {testimonial.date}
                  </div>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {[
                {
                  name: 'Sarah Chen',
                  handle: '@sarahchen',
                  platform: 'Twitter',
                  avatar: '👩‍💼',
                  text: 'DOER completely changed how I approach my goals. The AI-generated plans are incredibly detailed and actually achievable!',
                  date: '2 days ago'
                },
                {
                  name: 'Marcus Johnson',
                  handle: '@marcus_j',
                  platform: 'ProductHunt',
                  avatar: '👨‍💻',
                  text: 'Finally, a productivity tool that understands context. The smart scheduling alone is worth it. Highly recommend!',
                  date: '1 week ago'
                },
                {
                  name: 'Elena Rodriguez',
                  handle: '@elenarod',
                  platform: 'Twitter',
                  avatar: '👩‍🎨',
                  text: 'I went from feeling overwhelmed to actually completing my certification course. The progress tracking kept me motivated throughout.',
                  date: '3 days ago'
                },
                {
                  name: 'David Kim',
                  handle: '@davidkim',
                  platform: 'LinkedIn',
                  avatar: '👨‍🔬',
                  text: 'The integrations with my existing tools made the transition seamless. DOER fits perfectly into my workflow.',
                  date: '5 days ago'
                },
                {
                  name: 'Priya Patel',
                  handle: '@priyap',
                  platform: 'Twitter',
                  avatar: '👩‍🏫',
                  text: 'As an educator, I use DOER to help students break down complex projects. The clarity it provides is invaluable.',
                  date: '1 week ago'
                },
                {
                  name: 'Alex Turner',
                  handle: '@alexturner',
                  platform: 'ProductHunt',
                  avatar: '👨‍🎤',
                  text: 'Best goal-tracking app I\'ve used. The AI suggestions are spot-on and the interface is clean and intuitive.',
                  date: '4 days ago'
                },
              ].map((testimonial, index) => (
                <div
                  key={`duplicate-${testimonial.handle}-${index}`}
                  className="flex-shrink-0 w-80 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-900 dark:border-gray-700 p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-4xl">{testimonial.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {testimonial.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {testimonial.handle} • {testimonial.platform}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {testimonial.date}
                  </div>
                </div>
              ))}
              {/* Duplicate 2 for seamless loop */}
              {[
                {
                  name: 'Sarah Chen',
                  handle: '@sarahchen',
                  platform: 'Twitter',
                  avatar: '👩‍💼',
                  text: 'DOER completely changed how I approach my goals. The AI-generated plans are incredibly detailed and actually achievable!',
                  date: '2 days ago'
                },
                {
                  name: 'Marcus Johnson',
                  handle: '@marcus_j',
                  platform: 'ProductHunt',
                  avatar: '👨‍💻',
                  text: 'Finally, a productivity tool that understands context. The smart scheduling alone is worth it. Highly recommend!',
                  date: '1 week ago'
                },
                {
                  name: 'Elena Rodriguez',
                  handle: '@elenarod',
                  platform: 'Twitter',
                  avatar: '👩‍🎨',
                  text: 'I went from feeling overwhelmed to actually completing my certification course. The progress tracking kept me motivated throughout.',
                  date: '3 days ago'
                },
                {
                  name: 'David Kim',
                  handle: '@davidkim',
                  platform: 'LinkedIn',
                  avatar: '👨‍🔬',
                  text: 'The integrations with my existing tools made the transition seamless. DOER fits perfectly into my workflow.',
                  date: '5 days ago'
                },
                {
                  name: 'Priya Patel',
                  handle: '@priyap',
                  platform: 'Twitter',
                  avatar: '👩‍🏫',
                  text: 'As an educator, I use DOER to help students break down complex projects. The clarity it provides is invaluable.',
                  date: '1 week ago'
                },
                {
                  name: 'Alex Turner',
                  handle: '@alexturner',
                  platform: 'ProductHunt',
                  avatar: '👨‍🎤',
                  text: 'Best goal-tracking app I\'ve used. The AI suggestions are spot-on and the interface is clean and intuitive.',
                  date: '4 days ago'
                },
              ].map((testimonial, index) => (
                <div
                  key={`duplicate-2-${testimonial.handle}-${index}`}
                  className="flex-shrink-0 w-80 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-900 dark:border-gray-700 p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-4xl">{testimonial.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {testimonial.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {testimonial.handle} • {testimonial.platform}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    "{testimonial.text}"
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {testimonial.date}
                  </div>
                </div>
              ))}
            </div>
          </div>
      </section>

      {/* Pricing Preview Section - Hidden until launch */}
      {!IS_PRE_LAUNCH && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2
                ref={pricingTitleAnim.ref as React.RefObject<HTMLHeadingElement>}
                className={`text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 scroll-animate-fade-up ${pricingTitleAnim.isVisible ? 'visible' : ''}`}
              >
                {t('pricing.title')}
              </h2>
              <p
                ref={pricingDescAnim.ref as React.RefObject<HTMLParagraphElement>}
                className={`text-2xl text-gray-600 dark:text-gray-300 scroll-animate-fade-up ${pricingDescAnim.isVisible ? 'visible' : ''}`}
              >
                {t('pricing.subtitle')}
              </p>
            </div>

            {/* Pricing Cards - Centered */}
            <div className="flex justify-center">
              <div className="max-w-5xl w-full grid sm:grid-cols-2 gap-8">
              {/* Free Plan Card */}
              <PricingCard
                title={t('pricing.startFree')}
                description={t('pricing.getAccessTo')}
                features={[
                  t('pricing.allCoreFeatures'),
                  t('pricing.builtInIntegrations'),
                  t('pricing.authenticationSystem'),
                  t('pricing.databaseFunctionality'),
                ]}
                buttonText="Join Waitlist"
                buttonHref="#waitlist"
                delay={0}
                onWaitlistClick={() => {
                  setWaitlistInitialGoal('')
                  setWaitlistModalOpen(true)
                }}
              />
              {/* Paid Plans Card */}
              <PricingCard
                title={t('pricing.paidPlansFrom')}
                price="$16"
                priceUnit="/mo"
                description={t('pricing.upgradeDescription')}
                buttonText={t('pricing.seeAllPlans')}
                buttonHref="/pricing"
                delay={150}
              />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 
              ref={faqTitleAnim.ref as React.RefObject<HTMLHeadingElement>}
              className={`text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 scroll-animate-fade-up ${faqTitleAnim.isVisible ? 'visible' : ''}`}
            >
              {t('faq.title')}
            </h2>
            <p 
              ref={faqDescAnim.ref as React.RefObject<HTMLParagraphElement>}
              className={`text-2xl text-gray-600 dark:text-gray-300 scroll-animate-fade-up ${faqDescAnim.isVisible ? 'visible' : ''}`}
            >
              {t('faq.description')}
            </p>
          </div>

          <div 
            ref={faqItemsAnim.ref as React.RefObject<HTMLDivElement>}
            className={`space-y-6 scroll-animate-fade-up ${faqItemsAnim.isVisible ? 'visible' : ''}`}
          >
            {[
              {
                question: t('faq.q1'),
                answer: t('faq.a1')
              },
              {
                question: t('faq.q2'),
                answer: t('faq.a2')
              },
              {
                question: t('faq.q3'),
                answer: t('faq.a3')
              },
              {
                question: t('faq.q4'),
                answer: t('faq.a4')
              },
              {
                question: t('faq.q5'),
                answer: t('faq.a5')
              },
              {
                question: t('faq.q6'),
                answer: t('faq.a6')
              }
            ].map((faq, index) => (
              <details
                key={index}
                className="group bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden transition-all"
              >
                <summary 
                  className="flex items-center justify-between cursor-pointer px-12 py-10 text-2xl font-semibold text-gray-900 dark:text-white dark:hover:bg-gray-700/50 transition-colors list-none"
                  onMouseEnter={(e) => {
                    const isDark = document.documentElement.classList.contains('dark')
                    if (!isDark) {
                      e.currentTarget.style.setProperty('background-color', '#4b5563', 'important')
                      const span = e.currentTarget.querySelector('span')
                      if (span) (span as HTMLElement).style.setProperty('color', '#ffffff', 'important')
                      const svg = e.currentTarget.querySelector('svg')
                      if (svg) (svg as SVGElement).style.setProperty('color', '#ffffff', 'important')
                    }
                  }}
                  onMouseLeave={(e) => {
                    const isDark = document.documentElement.classList.contains('dark')
                    if (!isDark) {
                      e.currentTarget.style.removeProperty('background-color')
                      const span = e.currentTarget.querySelector('span')
                      if (span) (span as HTMLElement).style.removeProperty('color')
                      const svg = e.currentTarget.querySelector('svg')
                      if (svg) (svg as SVGElement).style.removeProperty('color')
                    }
                  }}
                >
                  <span>{faq.question}</span>
                  <ChevronDown className="w-10 h-10 text-gray-600 dark:text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0 ml-6" />
                </summary>
                <div className="px-12 pb-10 pt-4 bg-gray-50 dark:bg-gray-900/50 text-xl text-gray-700 dark:text-gray-300 leading-relaxed border-t border-gray-200 dark:border-gray-700">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('faq.stillHaveQuestions')}
            </p>
            <Link href="/documentation">
              <Button variant="outline" size="sm">
                {t('faq.visitDocs')}
              </Button>
            </Link>
          </div>
        </div>
      </section>


      {/* Final CTA with Lift Effect */}
      <div className="relative min-h-screen">
        {/* CTA Background - Revealed as page lifts */}
        <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden animate-gradient">
          <div className="text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-6xl md:text-8xl font-bold !text-white mb-6">
              {t('cta.headline')}
            </h2>
            <p className="text-2xl md:text-3xl !text-white mb-12">
              {t('cta.subheadline')} <span 
                className="font-bold text-4xl md:text-5xl inline-block !text-white" 
                style={{ 
                  textShadow: '0 0 20px rgba(255, 127, 0, 0.6), 0 0 40px rgba(255, 127, 0, 0.4), 0 0 60px rgba(255, 127, 0, 0.3)',
                  animation: 'doer-glow 3s ease-in-out infinite'
                }}
              >{t('cta.doer')}</span>{t('cta.question')}
            </p>
            <div className="max-w-xl mx-auto">
              <div className="text-center">
                {IS_PRE_LAUNCH ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="text-lg py-4 px-8"
                    onClick={(e) => {
                      e.preventDefault()
                      setWaitlistInitialGoal('')
                      setWaitlistModalOpen(true)
                    }}
                  >
                    Join Waitlist
                  </Button>
                ) : (
                  <Link href="/auth/signup">
                    <Button variant="primary" size="lg" className="text-lg py-4 px-8">
                      Get Started
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page Content Overlay - Lifts up on scroll */}
        <div className="relative z-10 bg-white dark:bg-gray-900 shadow-2xl">
          <PublicFooter />
        </div>
      </div>

      {/* Waitlist Modal - Pre-launch only */}
      {IS_PRE_LAUNCH && (
        <WaitlistModal
          isOpen={waitlistModalOpen}
          onClose={() => setWaitlistModalOpen(false)}
          initialGoal={waitlistInitialGoal}
        />
      )}
    </div>
  )
}

// Step card with animation
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
      className={`bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300 scroll-animate-fade-up ${isVisible ? 'visible' : ''}`}
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
    if ((step.id === 'step1' || step.id === 'step2') && videoRef.current) {
      if (isExpanded) {
        // Small delay to ensure the element is visible
        const timer = setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.load()
            // On mobile, try to play but don't fail silently - user may need to interact
            const playPromise = videoRef.current.play()
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                console.log('Video autoplay prevented (may need user interaction on mobile):', error)
                // On mobile, if autoplay fails, ensure video is at least loaded and visible
                if (isMobile && videoRef.current) {
                  videoRef.current.currentTime = 0
                }
              })
            }
          }
        }, 300)
        return () => clearTimeout(timer)
      } else {
        // Pause video when collapsed
        if (videoRef.current) {
          videoRef.current.pause()
        }
      }
    }
  }, [isExpanded, step.id, isMobile])

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
                    className="w-full px-6 py-5 flex items-center justify-between dark:hover:bg-gray-700/50 transition-colors text-left"
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
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {step.label}
                        </h3>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-300 flex-shrink-0 ${
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
                    <div className="px-6 pb-6 pt-2 bg-gray-50 dark:bg-gray-900/50">
                      <div className="mb-6">
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                          {step.title}
                        </h4>
                        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                      
                      {/* Plan Preview - Video embedded for step 1 and step 2 */}
                      {step.id === 'step1' ? (
                        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-orange-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-orange-900/20 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden w-full mx-auto flex items-center justify-center" style={{ minHeight: '200px' }}>
                          <video
                            ref={videoRef}
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="auto"
                            className="w-full h-auto rounded-lg block mx-auto"
                            style={{ 
                              display: 'block',
                              maxWidth: '100%',
                              height: 'auto'
                            }}
                            onError={(e) => {
                              console.error('Video loading error:', e)
                            }}
                            onLoadedData={() => {
                              console.log('Video loaded successfully')
                              // Force play on mobile after load
                              if (isMobile && videoRef.current) {
                                videoRef.current.play().catch(() => {
                                  // Silently fail - user may need to interact
                                })
                              }
                            }}
                            onLoadedMetadata={() => {
                              // Ensure video is visible and ready on mobile
                              if (videoRef.current) {
                                videoRef.current.style.display = 'block'
                                // Set webkit-playsinline for iOS Safari
                                videoRef.current.setAttribute('webkit-playsinline', 'true')
                                videoRef.current.setAttribute('playsinline', 'true')
                                // Set x5-playsinline for Android/WeChat browsers
                                videoRef.current.setAttribute('x5-playsinline', 'true')
                              }
                            }}
                          >
                            <source src="/doer_tut1.mp4" type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      ) : step.id === 'step2' ? (
                        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-orange-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-orange-900/20 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden w-full mx-auto flex items-center justify-center" style={{ minHeight: '200px' }}>
                          <video
                            ref={videoRef}
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="auto"
                            className="w-full h-auto rounded-lg block mx-auto"
                            style={{ 
                              display: 'block',
                              maxWidth: '100%',
                              height: 'auto'
                            }}
                            onError={(e) => {
                              console.error('Video loading error:', e)
                            }}
                            onLoadedData={() => {
                              console.log('Video loaded successfully')
                              // Force play on mobile after load
                              if (isMobile && videoRef.current) {
                                videoRef.current.play().catch(() => {
                                  // Silently fail - user may need to interact
                                })
                              }
                            }}
                            onLoadedMetadata={() => {
                              // Ensure video is visible and ready on mobile
                              if (videoRef.current) {
                                videoRef.current.style.display = 'block'
                                // Set webkit-playsinline for iOS Safari
                                videoRef.current.setAttribute('webkit-playsinline', 'true')
                                videoRef.current.setAttribute('playsinline', 'true')
                                // Set x5-playsinline for Android/WeChat browsers
                                videoRef.current.setAttribute('x5-playsinline', 'true')
                              }
                            }}
                          >
                            <source src="/doer_tut2.mp4" type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-orange-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-orange-900/20 rounded-lg p-8 flex items-center justify-center min-h-[400px] border-2 border-gray-200 dark:border-gray-700">
                          <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-lg mx-auto"></div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Plan Preview</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
    </>
  )
}

// Pricing Card Component
function PricingCard({
  title,
  price,
  priceUnit,
  description,
  features,
  buttonText,
  buttonHref,
  delay = 0,
  onWaitlistClick
}: {
  title: string
  price?: string
  priceUnit?: string
  description?: string
  features?: string[]
  buttonText: string
  buttonHref: string
  delay?: number
  onWaitlistClick?: () => void
}) {
  const { ref, isVisible } = useScrollAnimation({ delay, triggerOnce: true })
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-10 flex flex-col hover:border-orange-500 dark:hover:border-orange-500 transition-all duration-300 scroll-animate-fade-up ${isVisible ? 'visible' : ''}`}
    >
      <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
        {title}
      </h3>
      {price && (
        <div className="mb-6">
          <span className="text-6xl font-bold text-gray-900 dark:text-white">{price}</span>
          {priceUnit && <span className="text-2xl text-gray-600 dark:text-gray-400">{priceUnit}</span>}
        </div>
      )}
      {description && (
        <p className="text-lg text-gray-900 dark:text-gray-400 mb-6">
          {description}
        </p>
      )}
      {features && (
        <ul className="space-y-4 mb-8 flex-grow">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center text-base font-medium text-gray-900 dark:text-gray-300">
              <svg className="w-6 h-6 mr-3 flex-shrink-0 checkmark-icon" fill="none" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="3"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-gray-900 dark:text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>
      )}
      {!features && description && <div className="mb-8 flex-grow"></div>}
      {buttonHref === '#waitlist' ? (
        <Button
          variant="primary"
          size="lg"
          className="w-full text-lg py-4"
          onClick={(e) => {
            e.preventDefault()
            onWaitlistClick?.()
          }}
        >
          {buttonText}
        </Button>
      ) : (
        <Link href={buttonHref}>
          <Button variant="primary" size="lg" className="w-full text-lg py-4">
            {buttonText}
          </Button>
        </Link>
      )}
    </div>
  )
}
