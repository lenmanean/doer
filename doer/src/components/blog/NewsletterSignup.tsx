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
          placeholder={(() => {
            try {
              const translated = t('blog.newsletter.emailPlaceholder')
              return translated === 'blog.newsletter.emailPlaceholder' ? 'Enter your email' : translated
            } catch {
              return 'Enter your email'
            }
          })()}
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
              {(() => {
                try {
                  const translated = t('blog.newsletter.subscribed')
                  return translated === 'blog.newsletter.subscribed' ? 'Subscribed!' : translated
                } catch {
                  return 'Subscribed!'
                }
              })()}
            </>
          ) : (
            {(() => {
              try {
                const translated = t('blog.newsletter.subscribe')
                return translated === 'blog.newsletter.subscribe' ? 'Subscribe' : translated
              } catch {
                return 'Subscribe'
              }
            })()}
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
          {(() => {
            try {
              const translated = t('blog.newsletter.title')
              return translated === 'blog.newsletter.title' ? 'Stay Updated' : translated
            } catch {
              return 'Stay Updated'
            }
          })()}
        </h3>
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {(() => {
          try {
            const translated = t('blog.newsletter.description')
            return translated === 'blog.newsletter.description' ? 'Get the latest articles, tips, and updates delivered to your inbox.' : translated
          } catch {
            return 'Get the latest articles, tips, and updates delivered to your inbox.'
          }
        })()}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={(() => {
            try {
              const translated = t('blog.newsletter.emailPlaceholder')
              return translated === 'blog.newsletter.emailPlaceholder' ? 'Enter your email' : translated
            } catch {
              return 'Enter your email'
            }
          })()}
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
              {(() => {
                try {
                  const translated = t('blog.newsletter.subscribed')
                  return translated === 'blog.newsletter.subscribed' ? 'Subscribed!' : translated
                } catch {
                  return 'Subscribed!'
                }
              })()}
            </>
          ) : (
            {(() => {
              try {
                const translated = t('blog.newsletter.subscribe')
                return translated === 'blog.newsletter.subscribe' ? 'Subscribe' : translated
              } catch {
                return 'Subscribe'
              }
            })()}
          )}
        </Button>
      </form>
    </div>
  )
}

