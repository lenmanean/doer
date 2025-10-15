'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

function CustomSignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

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
    if (password.length < 6) {
      addToast({
        type: 'error',
        title: 'Weak Password',
        description: 'Password must be at least 6 characters long.',
        duration: 5000
      })
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      })

      if (error) {
        addToast({
          type: 'error',
          title: 'Signup Failed',
          description: error.message,
          duration: 5000
        })
      } else {
        addToast({
          type: 'success',
          title: 'Account Created!',
          description: 'Your account has been created successfully. You can now sign in.',
          duration: 5000
        })
        // Redirect to login page after successful signup
        router.push('/login')
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
          <label htmlFor="fullName" className="block text-sm font-medium text-[#d7d2cb]">
            Full Name
          </label>
          <div className="mt-1 relative">
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="appearance-none rounded-xl relative block w-full px-3 py-2 pl-10 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-[#ff7f00]/50 focus:bg-white/10 sm:text-sm transition-all duration-300"
              placeholder="Enter your full name"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-[#d7d2cb]/60" />
            </div>
          </div>
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
              className="appearance-none rounded-xl relative block w-full px-3 py-2 pl-10 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-[#ff7f00]/50 focus:bg-white/10 sm:text-sm transition-all duration-300"
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
              className="appearance-none rounded-xl relative block w-full px-3 py-2 pl-10 pr-10 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-[#ff7f00]/50 focus:bg-white/10 sm:text-sm transition-all duration-300"
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
              className="appearance-none rounded-xl relative block w-full px-3 py-2 pl-10 pr-10 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-[#ff7f00]/50 focus:bg-white/10 sm:text-sm transition-all duration-300"
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
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-[#ff7f00] hover:bg-[#e67300] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff7f00] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[#ff7f00]/25"
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
            Join DOER.AI and start your journey
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <CustomSignupForm />
        </div>
      </div>
    </div>
  )
}

