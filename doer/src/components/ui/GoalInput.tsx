'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowRight, ArrowLeft, Mail, Check, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { useToast } from './Toast'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'
import { trackWaitlistSignup } from '@/lib/analytics/unified-tracking-service'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { VoiceInputButton } from './VoiceInputButton'

interface GoalInputProps {
  className?: string
  placeholder?: string
  buttonText?: string
  source?: string
  onGoalSubmit?: (goal: string) => void // Callback when goal is submitted (pre-launch mode)
  showSuggestions?: boolean // Whether to show suggestion chips (default: true)
}

/**
 * GoalInput component for both pre-launch and post-launch modes
 * Pre-launch: Goal input → Email form → Saved for launch
 * Post-launch: Goal input → Sign-up form → Plan generation
 */
export function GoalInput({
  className = '',
  placeholder = "e.g., Learn to play guitar, Start a blog, Get in shape...",
  buttonText = "Get Started",
  source = "landing_page_hero",
  onGoalSubmit,
  showSuggestions = true, // Default to showing suggestions for backward compatibility
}: GoalInputProps) {
  const [goal, setGoal] = useState('')
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'goal' | 'email'>('goal')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0)
  const [isPlaceholderAnimating, setIsPlaceholderAnimating] = useState(true)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const placeholderIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const placeholderTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const { addToast } = useToast()

  // Voice input integration
  const {
    isListening,
    transcript,
    error: speechError,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    reset: resetSpeech,
  } = useSpeechRecognition({
    onResult: (finalTranscript) => {
      // Append to existing goal text or replace
      setGoal((prev) => {
        const newGoal = prev.trim() ? `${prev} ${finalTranscript}` : finalTranscript
        return newGoal
      })
      setError('')
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Voice Input Error',
        description: error,
        duration: 5000,
      })
    },
    continuous: false, // Stop after each phrase
    interimResults: true, // Show real-time transcription
  })

  // Handle microphone button click
  const handleMicClick = () => {
    if (isListening) {
      stopListening()
    } else {
      resetSpeech()
      startListening()
    }
  }

  // Goal suggestions for animated placeholder (expanded list)
  const goalSuggestions = [
    'Learn to play guitar',
    'Start a blog',
    'Get in shape',
    'Learn a new skill',
    'Start a business',
    'Save money',
    'Find a new job',
    'Launch a blog',
  ]

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  const handleSuggestionClick = (suggestion: string) => {
    setGoal(suggestion)
    setError('')
    setIsPlaceholderAnimating(false) // Stop animation when user clicks a suggestion
  }

  // Animated placeholder cycling effect with proper timing
  useEffect(() => {
    // Clear any existing timeouts/intervals
    if (placeholderIntervalRef.current) {
      clearInterval(placeholderIntervalRef.current)
      placeholderIntervalRef.current = null
    }
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current)
      placeholderTimeoutRef.current = null
    }

    // Only animate if input is empty, not focused, and user hasn't started typing
    if (step === 'goal' && goal === '' && !isInputFocused && isPlaceholderAnimating) {
      // Start the cycle - change index after animation completes
      const cyclePlaceholder = () => {
        // Set transitioning state to trigger fade out
        setIsTransitioning(true)
        
        // After fade out completes (1s), change to next suggestion and fade in
        placeholderTimeoutRef.current = setTimeout(() => {
          setCurrentPlaceholderIndex((prevIndex) => {
            const nextIndex = (prevIndex + 1) % goalSuggestions.length
            return nextIndex
          })
          // Immediately start fade in after changing text
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setIsTransitioning(false)
            })
          })
        }, 1000) // Wait for fade out to complete (1s)
      }

      // Initial delay before first cycle - show first suggestion for 1.5s
      placeholderTimeoutRef.current = setTimeout(() => {
        cyclePlaceholder()
        
        // Then set up interval for subsequent cycles
        placeholderIntervalRef.current = setInterval(() => {
          cyclePlaceholder()
        }, 2500) // Total cycle: 1s fade out + 0.1s transition + 1s fade in + 0.4s visible = 2.5s
      }, 1500) // Initial display time before first transition
    }

    return () => {
      if (placeholderIntervalRef.current) {
        clearInterval(placeholderIntervalRef.current)
        placeholderIntervalRef.current = null
      }
      if (placeholderTimeoutRef.current) {
        clearTimeout(placeholderTimeoutRef.current)
        placeholderTimeoutRef.current = null
      }
    }
  }, [step, goal, isInputFocused, isPlaceholderAnimating, goalSuggestions.length])

  const handleInputFocus = () => {
    setIsInputFocused(true)
    setIsPlaceholderAnimating(false)
    setIsTransitioning(false)
    // Clear any pending animations
    if (placeholderIntervalRef.current) {
      clearInterval(placeholderIntervalRef.current)
      placeholderIntervalRef.current = null
    }
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current)
      placeholderTimeoutRef.current = null
    }
  }

  const handleInputBlur = () => {
    setIsInputFocused(false)
    setIsTransitioning(false)
    // Resume animation if input is empty
    if (goal === '') {
      setIsPlaceholderAnimating(true)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGoal(e.target.value)
    setError('')
    // Stop animation when user starts typing
    if (e.target.value.length > 0) {
      setIsPlaceholderAnimating(false)
    } else {
      // Resume animation if input becomes empty
      setIsPlaceholderAnimating(true)
    }
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

  const handleEmailBack = () => {
    setError('')
    setStep('goal')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // If in goal step, move to email step (for pre-launch) or redirect to signup (for post-launch)
    if (step === 'goal') {
      if (IS_PRE_LAUNCH) {
        // Pre-launch: Trigger callback to open waitlist modal
        if (onGoalSubmit) {
          onGoalSubmit(goal.trim())
          return
        }
        // Fallback: Move to email step if no callback provided
        handleGoalNext()
        return
      } else {
        // Post-launch: Validate goal and redirect to signup
        if (!goal.trim()) {
          setError('Please tell us about your goal')
          return
        }
        if (goal.trim().length < 10) {
          setError('Please provide a bit more detail about your goal (at least 10 characters)')
          return
        }

        setIsLoading(true)
        try {
          // Save goal to localStorage for retrieval in onboarding
          localStorage.setItem('pendingGoal', goal.trim())
          sessionStorage.setItem('pendingGoal', goal.trim())

          // Redirect to signup page with goal in URL parameter
          const encodedGoal = encodeURIComponent(goal.trim())
          router.push(`/auth/signup?goal=${encodedGoal}`)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
          setError(errorMessage)
          addToast({
            type: 'error',
            title: 'Error',
            description: errorMessage,
            duration: 5000,
          })
          setIsLoading(false)
        }
        return
      }
    }

    // Email step (pre-launch only)
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
          goal: goal.trim(),
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
      setStep('goal')

      addToast({
        type: 'success',
        title: 'You\'re on the list!',
        description: 'We\'ll notify you when DOER is ready.',
        duration: 5000,
      })

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

  // Email step (pre-launch only)
  if (step === 'email' && IS_PRE_LAUNCH) {
    return (
      <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
        <div className="space-y-4">
          {/* Back button */}
          <button
            type="button"
            onClick={handleEmailBack}
            className="flex items-center text-sm text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to goal
          </button>

          {/* Email input field */}
          <div className="relative">
            <input
              id="goal-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
                setIsSuccess(false)
              }}
              placeholder="Enter your email"
              disabled={isLoading || isSuccess}
              className={`w-full px-6 py-6 pr-16 text-xl bg-white/5 border ${
                error ? 'border-red-500/50' : isSuccess ? 'border-green-500/50' : 'border-white/10'
              } rounded-xl text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
              {isSuccess ? (
                <Check className="w-6 h-6 text-green-500" />
              ) : (
                <button
                  type="submit"
                  disabled={isLoading || isSuccess || !email.trim()}
                  className="p-3 bg-[#ff7f00] hover:bg-[#ff7f00]/90 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {isSuccess && (
            <p className="text-sm text-green-400">Successfully joined the waitlist!</p>
          )}
        </div>
      </form>
    )
  }

  // Goal step (both pre-launch and post-launch)
  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div className="space-y-4">
        {/* Input field with arrow button */}
        <div className="relative">
          <input
            id="goal-input"
            type="text"
            value={goal}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="" // Empty placeholder - we'll use animated overlay instead
            disabled={isLoading}
            className={`w-full px-6 py-6 ${isSpeechSupported ? 'pr-28' : 'pr-16'} text-xl bg-white/5 border ${
              error ? 'border-red-500/50' : 'border-white/10'
            } rounded-xl text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          {/* Animated placeholder overlay */}
          {goal === '' && !isInputFocused && (
            <div className="absolute inset-0 pointer-events-none flex items-center px-6 py-6 z-10">
              <div
                className={`w-full text-xl text-[#d7d2cb]/40 transition-opacity duration-[1000ms] ease-in-out ${
                  isTransitioning ? 'opacity-0' : 'opacity-100'
                }`}
                style={{
                  willChange: 'opacity',
                }}
              >
                {goalSuggestions[currentPlaceholderIndex]}
              </div>
            </div>
          )}
          
          {/* Voice input button */}
          {isSpeechSupported && (
            <div className="absolute right-20 top-1/2 -translate-y-1/2 z-20">
              <VoiceInputButton
                isListening={isListening}
                isSupported={isSpeechSupported}
                onClick={handleMicClick}
                disabled={isLoading}
                size="md"
                error={speechError}
              />
            </div>
          )}

          {/* Real-time listening indicator */}
          {isListening && (
            <div className="absolute top-2 left-2 flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-lg text-xs text-red-400 z-30">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Listening...</span>
            </div>
          )}

          {/* Arrow button at right-center */}
          <button
            type="submit"
            disabled={isLoading || !goal.trim() || goal.trim().length < 10}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-[#ff7f00] hover:bg-[#ff7f00]/90 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors z-20"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
        </div>
        
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Show speech errors */}
        {speechError && !error && (
          <p className="text-sm text-yellow-400">{speechError}</p>
        )}

        {/* Clickable Suggestion Chips - Below input (only if showSuggestions is true) */}
        {showSuggestions && (
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            {goalSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#ff7f00]/50 rounded-lg text-base font-medium text-[#d7d2cb] hover:text-white transition-all duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  )
}


