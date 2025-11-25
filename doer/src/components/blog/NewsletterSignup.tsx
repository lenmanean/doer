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

    // TODO: Integrate with your newsletter service (e.g., Mailchimp, ConvertKit)
    // For now, just simulate success
    setTimeout(() => {
      setSubmitted(true)
      setIsSubmitting(false)
      setEmail('')
    }, 1000)
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('blog.newsletter.emailPlaceholder')}
          required
          disabled={submitted || isSubmitting}
          className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
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
              {t('blog.newsletter.subscribed')}
            </>
          ) : (
            t('blog.newsletter.subscribe')
          )}
        </Button>
      </form>
    )
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-orange-500 rounded-lg">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('blog.newsletter.title')}
        </h3>
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {t('blog.newsletter.description')}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('blog.newsletter.emailPlaceholder')}
          required
          disabled={submitted || isSubmitting}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
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
              {t('blog.newsletter.subscribed')}
            </>
          ) : (
            t('blog.newsletter.subscribe')
          )}
        </Button>
      </form>
    </div>
  )
}

