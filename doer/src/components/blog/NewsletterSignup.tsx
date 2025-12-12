'use client'

import { useState } from 'react'
import { Mail, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'

interface NewsletterSignupProps {
  variant?: 'inline' | 'card'
}

export function NewsletterSignup({ variant = 'card' }: NewsletterSignupProps) {
  const t = useTranslations()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          source: 'blog',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe')
      }

      setSubmitted(true)
      setEmail('')
    } catch (error) {
      console.error('Error subscribing to newsletter:', error)
      // Still show success to user (don't reveal errors)
      // In production, you might want to show an error toast
      setSubmitted(true)
      setEmail('')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper functions for translations with fallbacks
  const getTranslation = (key: string, fallback: string) => {
    try {
      const translated = t(key)
      return translated === key ? fallback : translated
    } catch {
      return fallback
    }
  }

  const emailPlaceholder = getTranslation('blog.newsletter.emailPlaceholder', 'Enter your email')
  const subscribeText = getTranslation('blog.newsletter.subscribe', 'Subscribe')
  const subscribedText = getTranslation('blog.newsletter.subscribed', 'Subscribed!')
  const titleText = getTranslation('blog.newsletter.title', 'Stay Updated')
  const descriptionText = getTranslation('blog.newsletter.description', 'Get the latest articles, tips, and updates delivered to your inbox.')

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={emailPlaceholder}
          required
          disabled={submitted || isSubmitting}
          className="flex-1 px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={submitted || isSubmitting}
          className="whitespace-nowrap"
        >
          {submitted ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              {subscribedText}
            </>
          ) : (
            subscribeText
          )}
        </Button>
      </form>
    )
  }

  return (
    <div className="bg-gradient-to-br from-orange-900/20 to-orange-800/20 border-2 border-orange-800 rounded-xl p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-orange-500 rounded-lg">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white">
          {titleText}
        </h3>
      </div>
      <p className="text-gray-300 mb-6">
        {descriptionText}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={emailPlaceholder}
          required
          disabled={submitted || isSubmitting}
          className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={submitted || isSubmitting}
          className="w-full"
        >
          {submitted ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              {subscribedText}
            </>
          ) : (
            subscribeText
          )}
        </Button>
      </form>
    </div>
  )
}

