'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { motion } from 'framer-motion'

function CustomLoginForm() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Determine if input is email or username
      const isEmail = usernameOrEmail.includes('@')
      let emailToUse = usernameOrEmail

      // If it's not an email, look up the email from username
      if (!isEmail) {
        try {
          const response = await fetch('/api/auth/get-email-from-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameOrEmail })
          })
          
          if (response.ok) {
            const data = await response.json()
            emailToUse = data.email
          } else {
            // Username not found, show generic error
            addToast({
              type: 'error',
              title: 'Login Failed',
              description: 'Invalid login credentials. Please check your username/email and password.',
              duration: 5000
            })
            setIsLoading(false)
            return
          }
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Login Error',
            description: 'Failed to authenticate. Please try again.',
            duration: 5000
          })
          setIsLoading(false)
          return
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      })

      if (error) {
        // Check if it's an email not confirmed error
        if (error.message.includes('email not confirmed') || error.message.includes('Email not confirmed')) {
          addToast({
            type: 'error',
            title: 'Email Not Confirmed',
            description: 'Please check your email and enter the confirmation code before signing in.',
            duration: 7000
          })
        } else {
          addToast({
            type: 'error',
            title: 'Login Failed',
            description: 'Invalid login credentials. Please check your username/email and password.',
            duration: 5000
          })
        }
      } else {
        addToast({
          type: 'success',
          title: 'Welcome Back!',
          description: 'Successfully signed in to your account.',
          duration: 3000
        })
        
        // Check if account is scheduled for deletion
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('scheduled_deletion_at')
              .eq('user_id', user.id)
              .maybeSingle()

            if (userSettings?.scheduled_deletion_at) {
              const deletionDate = new Date(userSettings.scheduled_deletion_at)
              const now = new Date()
              
              // If deletion date is in the future, redirect to restore page
              if (deletionDate > now) {
                router.push('/account/restore')
                return
              }
              // If deletion date has passed, allow normal flow (cron should have deleted)
            }
          }
        } catch (checkError) {
          // If error checking scheduled deletion, continue with normal flow
          console.error('Error checking scheduled deletion:', checkError)
        }
        
        // Check if there's a pending goal from homepage
        const pendingGoal = localStorage.getItem('pendingGoal')
        if (pendingGoal) {
          localStorage.removeItem('pendingGoal')
          // Redirect to onboarding with the goal
          router.push(`/onboarding?goal=${encodeURIComponent(pendingGoal)}`)
        } else {
          // Always redirect to dashboard after successful login
          router.push('/dashboard')
        }
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Login Error',
        description: 'An unexpected error occurred. Please try again.',
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) {
      addToast({
        type: 'error',
        title: 'Google Sign-In Failed',
        description: error.message,
        duration: 5000
      })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Email/Password Form */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label htmlFor="usernameOrEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Username or Email
          </label>
          <div className="mt-1 relative">
            <input
              id="usernameOrEmail"
              name="usernameOrEmail"
              type="text"
              required
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              className="appearance-none rounded-xl relative block w-full px-3 py-3 pl-10 min-h-[44px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 sm:text-base transition-all duration-300"
              placeholder="Enter your username or email"
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
              placeholder="Enter your password"
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
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-orange-500/25 min-h-[44px]"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </motion.form>

      {/* Sign Up Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="text-center"
      >
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <a
            href="/auth/signup"
            className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors duration-300 font-medium min-h-[44px] inline-flex items-center"
          >
            Create one here
          </a>
        </div>
      </motion.div>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="relative"
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400">Or continue with</span>
        </div>
      </motion.div>

      {/* Google Sign In */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <button
          onClick={handleGoogleSignIn}
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
      </motion.div>
    </motion.div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  // SupabaseProvider + middleware handle post-login redirects; no extra auth listener needed here

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-md w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Welcome to DOER
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account to continue your journey
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="mt-8 space-y-6"
        >
          <CustomLoginForm />
        </motion.div>
      </div>
    </div>
  )
}

