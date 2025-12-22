'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { validatePassword } from '@/lib/password-security'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'

function CustomSignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const router = useRouter()

  const { addToast } = useToast()

  // Redirect to waitlist during pre-launch
  useEffect(() => {
    if (IS_PRE_LAUNCH) {
      router.push('/#waitlist')
    }
  }, [router])

  // Check for goal from homepage (URL parameter or localStorage)
  useEffect(() => {
    if (IS_PRE_LAUNCH) return

    // Check URL parameter first
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const goalFromUrl = urlParams.get('goal')
      if (goalFromUrl) {
        // Save to localStorage for onboarding
        localStorage.setItem('pendingGoal', decodeURIComponent(goalFromUrl))
        sessionStorage.setItem('pendingGoal', decodeURIComponent(goalFromUrl))
        return
      }

      // Check localStorage (from GoalInput component)
      const pendingGoal = localStorage.getItem('pendingGoal')
      if (pendingGoal) {
        // Already saved, ensure sessionStorage also has it
        sessionStorage.setItem('pendingGoal', pendingGoal)
      }
    }
  }, [])

  // Don't render signup form during pre-launch
  if (IS_PRE_LAUNCH) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 dark:text-gray-100 text-lg">Redirecting to waitlist...</p>
        </div>
      </div>
    )
  }

  const validateUsername = (username: string): boolean => {
    // Reset error
    setUsernameError('')
    
    // Check length
    if (username.length < 3 || username.length > 20) {
      setUsernameError('Username must be 3-20 characters')
      return false
    }
    
    // Check format (alphanumeric, underscore, hyphen only)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setUsernameError('Username can only contain letters, numbers, underscores, and hyphens')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Validate username
    if (!validateUsername(username)) {
      setIsLoading(false)
      return
    }

    // Check if username is available
    try {
      const checkResponse = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
      
      const checkData = await checkResponse.json()
      
      if (!checkData.available) {
        setUsernameError('Username is already taken')
        setIsLoading(false)
        return
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to check username availability',
        duration: 5000
      })
      setIsLoading(false)
      return
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      addToast({
        type: 'error',
        title: 'Password Mismatch',
        description: 'Passwords do not match. Please try again.',
        duration: 5000
      })
      setIsLoading(false)
      return
    }

    // Validate password strength
    const passwordValidation = await validatePassword(password)
    if (!passwordValidation.isValid) {
      addToast({
        type: 'error',
        title: 'Invalid Password',
        description: passwordValidation.error || 'Password does not meet requirements.',
        duration: 5000
      })
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        // Check for rate limiting (429) or email sending errors
        const isRateLimitError = error.status === 429 || 
                                 error.message.toLowerCase().includes('rate limit') ||
                                 error.message.toLowerCase().includes('too many requests')
        const isEmailError = error.message.toLowerCase().includes('email') || 
                            error.message.toLowerCase().includes('smtp') ||
                            error.message.toLowerCase().includes('mail') ||
                            isRateLimitError
        
        let errorDescription = error.message
        if (isRateLimitError) {
          // Extract retry-after if available, otherwise suggest 5-10 minutes
          const retryAfter = (error as any).retryAfter || 300 // Default to 5 minutes
          const waitMinutes = Math.ceil(retryAfter / 60)
          errorDescription = `Too many signup attempts. Please wait ${waitMinutes} minute${waitMinutes !== 1 ? 's' : ''} and try again. If this persists, the rate limit may need to be increased in the Supabase dashboard.`
        } else if (isEmailError) {
          errorDescription = 'Unable to send confirmation email. This may be due to rate limiting. Please wait a few minutes and try again, or contact support.'
        }
        
        addToast({
          type: 'error',
          title: 'Signup Failed',
          description: errorDescription,
          duration: 10000 // Longer duration for rate limit errors
        })
      } else {
        // Account created - user may or may not have received email
        // Store email for confirmation page
        localStorage.setItem('pendingEmailConfirmation', email)
        
        // Check if user was created but email might not have been sent
        if (data?.user && !data.session) {
          // User created but not confirmed (email confirmation required)
          addToast({
            type: 'success',
            title: 'Account Created!',
            description: 'Please check your email for the confirmation code. If you don\'t receive it, use the resend option.',
            duration: 7000
          })
        } else {
          addToast({
            type: 'success',
            title: 'Account Created!',
            description: 'Please check your email for the confirmation code.',
            duration: 5000
          })
        }
        
        // Redirect to email confirmation page
        router.push('/auth/confirm-email')
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Signup Error',
        description: 'An unexpected error occurred. Please try again.',
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) {
      addToast({
        type: 'error',
        title: 'Google Sign-Up Failed',
        description: error.message,
        duration: 5000
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Username
          </label>
          <div className="mt-1 relative">
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setUsernameError('')
              }}
              className={`appearance-none rounded-xl relative block w-full px-3 py-3 pl-10 min-h-[44px] border ${usernameError ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 sm:text-base transition-all duration-300`}
              placeholder="Choose a username (3-20 characters)"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
          {usernameError && (
            <p className="mt-1 text-sm text-red-500">{usernameError}</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Letters, numbers, underscores, and hyphens only</p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email Address
          </label>
          <div className="mt-1 relative">
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded-xl relative block w-full px-3 py-3 pl-10 min-h-[44px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 sm:text-base transition-all duration-300"
              placeholder="Enter your email"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
          </label>
          <div className="mt-1 relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none rounded-xl relative block w-full px-3 py-3 pl-10 pr-10 min-h-[44px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 sm:text-base transition-all duration-300"
              placeholder="Create a password"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px]"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Confirm Password
          </label>
          <div className="mt-1 relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="appearance-none rounded-xl relative block w-full px-3 py-3 pl-10 pr-10 min-h-[44px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 sm:text-base transition-all duration-300"
              placeholder="Confirm your password"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px]"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              )}
            </button>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-orange-500/25 min-h-[44px]"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </form>

      {/* Sign In Link */}
      <div className="text-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <a
            href="/login"
            className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors duration-300 font-medium min-h-[44px] inline-flex items-center"
          >
            Sign in here
          </a>
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400">Or continue with</span>
        </div>
      </div>

      {/* Google Sign Up */}
      <div>
        <button
          onClick={handleGoogleSignUp}
          className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 min-h-[44px]"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Create Your Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Join DOER and start your journey
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <CustomSignupForm />
        </div>
      </div>
    </div>
  )
}

