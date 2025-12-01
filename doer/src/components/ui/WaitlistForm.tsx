'use client'

import { useState } from 'react'
import { Mail, Check } from 'lucide-react'
import { Button } from './Button'
import { useToast } from './Toast'
import { trackWaitlistSignup } from '@/lib/analytics/marketing-service'

interface WaitlistFormProps {
  source: string
  variant?: 'default' | 'compact'
  placeholder?: string
  buttonText?: string
  className?: string
}

/**
 * WaitlistForm component for email signup with Meta Pixel tracking
 * 
 * Fires WaitlistSignup event after successful signup
 * Event name: WaitlistSignup
 * Payload: { source: string }
 */
export function WaitlistForm({
  source,
  variant = 'default',
  placeholder = 'Enter your email',
  buttonText = 'Join Waitlist',
  className = '',
}: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const { addToast } = useToast()

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist')
      }

      // Success - fire Meta Pixel event
      if (typeof window !== 'undefined' && window.fbq) {
        trackWaitlistSignup(source)
      }

      setIsSuccess(true)
      setEmail('')

      addToast({
        type: 'success',
        title: 'You\'re on the list!',
        description: 'We\'ll notify you when DOER is ready.',
        duration: 5000,
      })

      // Reset success state after a delay
      setTimeout(() => {
        setIsSuccess(false)
      }, 3000)
    } catch (err: any) {
      const errorMessage = err.message || 'Something went wrong. Please try again.'
      setError(errorMessage)
      
      addToast({
        type: 'error',
        title: 'Failed to join waitlist',
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (variant === 'compact') {
    return (
      <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
        <div className="flex-1 relative">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
              setIsSuccess(false)
            }}
            placeholder={placeholder}
            disabled={isLoading || isSuccess}
            className={`w-full px-4 py-2 pr-10 bg-white dark:bg-gray-800 border-2 ${
              error ? 'border-red-500' : isSuccess ? 'border-green-500' : 'border-gray-300 dark:border-gray-700'
            } rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {isSuccess ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            )}
          </div>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isLoading || isSuccess || !email.trim()}
          className="px-6"
        >
          {isLoading ? 'Joining...' : isSuccess ? 'Joined!' : buttonText}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor="waitlist-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Email Address
        </label>
        <div className="relative">
          <input
            id="waitlist-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
              setIsSuccess(false)
            }}
            placeholder={placeholder}
            disabled={isLoading || isSuccess}
            className={`w-full px-4 py-3 pr-10 bg-white dark:bg-gray-800 border-2 ${
              error ? 'border-red-500' : isSuccess ? 'border-green-500' : 'border-gray-300 dark:border-gray-700'
            } rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {isSuccess ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            )}
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
        {isSuccess && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            Thank you! We'll notify you when DOER is ready.
          </p>
        )}
      </div>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isLoading || isSuccess || !email.trim()}
        className="w-full"
      >
        {isLoading ? 'Joining...' : isSuccess ? 'Joined!' : buttonText}
      </Button>
    </form>
  )
}

