'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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

  // Don't render signup form during pre-launch
  if (IS_PRE_LAUNCH) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#d7d2cb] text-lg">Redirecting to waitlist...</p>
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
          <label htmlFor="username" className="block text-sm font-medium text-[#d7d2cb]">
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
              className={`appearance-none rounded-xl relative block w-full px-3 py-2 pl-10 border ${usernameError ? 'border-red-500' : 'border-white/20'} bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[#ff7f00]/50 focus:bg-white/10 sm:text-sm transition-all duration-300`}
              placeholder="Choose a username (3-20 characters)"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-[#d7d2cb]/60" />
            </div>
          </div>
          {usernameError && (
            <p className="mt-1 text-sm text-red-500">{usernameError}</p>
          )}
          <p className="mt-1 text-xs text-[#d7d2cb]/50">Letters, numbers, underscores, and hyphens only</p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#d7d2cb]">
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
              className="appearance-none rounded-xl relative block w-full px-3 py-2 pl-10 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[#ff7f00]/50 focus:bg-white/10 sm:text-sm transition-all duration-300"
              placeholder="Enter your email"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-[#d7d2cb]/60" />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[#d7d2cb]">
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
              className="appearance-none rounded-xl relative block w-full px-3 py-2 pl-10 pr-10 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[#ff7f00]/50 focus:bg-white/10 sm:text-sm transition-all duration-300"
              placeholder="Create a password"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-[#d7d2cb]/60" />
            </div>
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-[#d7d2cb]/60" />
              ) : (
                <Eye className="h-5 w-5 text-[#d7d2cb]/60" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#d7d2cb]">
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
              className="appearance-none rounded-xl relative block w-full px-3 py-2 pl-10 pr-10 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[#ff7f00]/50 focus:bg-white/10 sm:text-sm transition-all duration-300"
              placeholder="Confirm your password"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-[#d7d2cb]/60" />
            </div>
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-[#d7d2cb]/60" />
              ) : (
                <Eye className="h-5 w-5 text-[#d7d2cb]/60" />
              )}
            </button>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-[var(--primary)] hover:bg-[#e67300] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[#ff7f00]/25"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </form>

      {/* Sign In Link */}
      <div className="text-center">
        <div className="text-sm text-[#d7d2cb]/70">
          Already have an account?{' '}
          <a
            href="/login"
            className="text-[#ff7f00] hover:text-[#ff9500] transition-colors duration-300 font-medium"
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
          <span className="px-2 bg-[#0a0a0a] text-[#d7d2cb]/60">Or continue with</span>
        </div>
      </div>

      {/* Google Sign Up */}
      <div>
        <button
          onClick={handleGoogleSignUp}
          className="w-full inline-flex justify-center py-3 px-4 border border-white/20 rounded-xl shadow-sm bg-white/5 backdrop-blur-sm text-sm font-medium text-[#d7d2cb] hover:bg-white/10 transition-all duration-300"
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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[#d7d2cb]">
            Create Your Account
          </h2>
          <p className="mt-2 text-center text-sm text-[#d7d2cb]/70">
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

