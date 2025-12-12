'use client'

import { useState, useEffect } from 'react'
import { Mail, Check, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from './Button'
import { useToast } from './Toast'
import { trackWaitlistSignup } from '@/lib/analytics/unified-tracking-service'

interface WaitlistFormProps {
  source: string
  variant?: 'default' | 'compact'
  placeholder?: string
  buttonText?: string
  className?: string
  enableGoalCapture?: boolean // If true, shows two-step flow (Goal → Email)
  initialGoal?: string // Optional initial goal value
  onSuccess?: () => void // Callback when waitlist signup succeeds
}

/**
 * WaitlistForm component for email signup with analytics tracking
 * 
 * Two-step flow (if enableGoalCapture is true):
 * Step 1: User enters their goal/dream
 * Step 2: User enters email to join waitlist
 * 
 * Fires tracking events after successful signup:
 * - Facebook Pixel: WaitlistSignup custom event with source parameter
 * - GA4: sign_up event with method: 'waitlist' and source parameter
 * - Vercel Analytics: waitlist_signup event with source parameter
 */
export function WaitlistForm({
  source,
  variant = 'default',
  placeholder = 'Enter your email',
  buttonText = 'Join Waitlist',
  className = '',
  enableGoalCapture = false, // Default to false for backward compatibility
  initialGoal = '',
  onSuccess,
}: WaitlistFormProps) {
  const [step, setStep] = useState<'goal' | 'email'>(enableGoalCapture ? 'goal' : 'email')
  const [goal, setGoal] = useState(initialGoal)
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const { addToast } = useToast()

  // Track if user has manually changed step to prevent useEffect from overriding
  const [userHasChangedStep, setUserHasChangedStep] = useState(false)

  // Update goal when initialGoal prop changes (only on mount or when initialGoal changes)
  useEffect(() => {
    if (initialGoal && initialGoal.trim() && !userHasChangedStep) {
      setGoal(initialGoal)
      // If goal is provided and valid, move to email step
      if (enableGoalCapture && initialGoal.trim().length >= 10) {
        setStep('email')
      }
    }
  }, [initialGoal, enableGoalCapture, userHasChangedStep])

  // New Year/resolutions themed goal suggestions
  const goalSuggestions = [
    'Get in shape',
    'Learn a new skill',
    'Start a business',
    'Save money',
    'Find a new job',
  ]

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setGoal(suggestion)
    setError('')
    setUserHasChangedStep(true) // Mark that user has interacted with goal
  }

  const handleGoalNext = () => {
    if (!goal.trim()) {
      setError('Please tell us about your goal')
      return
    }
    if (goal.trim().length < 10) {
      setError('Please provide a bit more detail about your goal (at least 10 characters)')
      return
    }
    setError('')
    setStep('email')
  }

  const handleEmailBack = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setError('')
    setUserHasChangedStep(true)
    setStep('goal')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // If in goal step and goal capture is enabled, move to email step
    if (step === 'goal' && enableGoalCapture) {
      handleGoalNext()
      return
    }

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
          goal: enableGoalCapture ? goal.trim() : undefined,
          source,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist')
      }

      // Success - fire tracking events across all platforms (GA4, Pixel, Vercel Analytics)
      try {
        trackWaitlistSignup(source)
      } catch (error) {
        // Tracking failed, continue without it
        console.warn('Analytics tracking failed:', error)
      }

      setIsSuccess(true)
      setEmail('')
      setGoal('')
      if (enableGoalCapture) {
        setStep('goal')
      }

      addToast({
        type: 'success',
        title: 'You\'re on the list!',
        description: 'We\'ll notify you when DOER is ready.',
        duration: 5000,
      })

      // Call onSuccess callback if provided
      if (onSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }

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
              <Mail className="h-5 w-5 text-gray-500" />
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

  // Two-step flow: Goal → Email
  if (enableGoalCapture && step === 'goal') {
    return (
      <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
        <div className="space-y-4">
          {/* Input field with arrow button */}
          <div className="relative">
            <input
              id="waitlist-goal"
              type="text"
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value)
                setError('')
                setUserHasChangedStep(true) // Mark that user has interacted with goal
              }}
              placeholder="e.g., Learn to play guitar, Start a blog, Get in shape..."
              disabled={isLoading || isSuccess}
              className={`w-full px-4 py-4 pr-14 text-lg bg-white/5 border ${
                error ? 'border-red-500/50' : 'border-white/10'
              } rounded-xl text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            {/* Arrow button at right-end - vertically centered */}
            <button
              type="submit"
              disabled={isLoading || !goal.trim() || goal.trim().length < 10}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#ff7f00] hover:bg-[#ff7f00]/90 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Clickable Suggestion Chips - Below input */}
          <div className="flex flex-wrap gap-2 justify-center">
            {goalSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#ff7f00]/50 rounded-lg text-sm font-medium text-[#d7d2cb] hover:text-white transition-all duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </form>
    )
  }

  // Email step (step 2 in two-step flow, or single step if goal capture is disabled)
  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {enableGoalCapture && step === 'email' && (
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Goal</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{goal}</p>
            </div>
            <button
              type="button"
              onClick={(e) => handleEmailBack(e)}
              className="text-sm text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 flex items-center gap-1 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>
      )}
      <div>
        <label htmlFor="waitlist-email" className="block text-sm font-medium text-gray-300 mb-2">
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
            className={`w-full px-4 py-3 pr-10 bg-gray-800 border-2 ${
              error ? 'border-red-500' : isSuccess ? 'border-green-500' : 'border-gray-700'
            } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {isSuccess ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <Mail className="h-5 w-5 text-gray-500" />
            )}
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
        {isSuccess && (
          <p className="mt-2 text-sm text-green-400">
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
