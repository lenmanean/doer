'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { motion } from 'framer-motion'

function ForgotPasswordForm() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
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
            // Username not found - still show success (security best practice)
            // Don't reveal whether username exists
            setEmailSent(true)
            setIsLoading(false)
            addToast({
              type: 'success',
              title: 'Check Your Email',
              description: 'If an account exists with that username, you will receive password reset instructions.',
              duration: 5000,
            })
            return
          }
        } catch (err) {
          // On error, still show success (security best practice)
          setEmailSent(true)
          setIsLoading(false)
          addToast({
            type: 'success',
            title: 'Check Your Email',
            description: 'If an account exists, you will receive password reset instructions.',
            duration: 5000,
          })
          return
        }
      }

      // Validate email format if it's an email
      if (isEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(emailToUse)) {
          addToast({
            type: 'error',
            title: 'Invalid Email',
            description: 'Please enter a valid email address.',
            duration: 5000,
          })
          setIsLoading(false)
          return
        }
      }

      // Use Supabase's built-in password reset
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      // Always show success message (security: don't reveal if email exists)
      setEmailSent(true)
      addToast({
        type: 'success',
        title: 'Check Your Email',
        description: 'If an account exists with that email, you will receive password reset instructions.',
        duration: 5000,
      })
    } catch (err) {
      console.error('Unexpected error:', err)
      // Even on unexpected errors, show success for security
      setEmailSent(true)
      addToast({
        type: 'success',
        title: 'Check Your Email',
        description: 'If an account exists, you will receive password reset instructions.',
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Check Your Email
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            If an account exists with {usernameOrEmail.includes('@') ? usernameOrEmail : 'that username'}, you will receive password reset instructions.
          </p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            Didn't receive the email? Check your spam folder or{' '}
            <button
              onClick={() => {
                setEmailSent(false)
                setUsernameOrEmail('')
              }}
              className="text-orange-500 hover:text-orange-600 dark:text-orange-400 font-medium"
            >
              try again
            </button>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <button
            onClick={() => router.push('/login')}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-orange-500/25 min-h-[44px]"
          >
            Back to Login
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
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
              disabled={isLoading}
              className="appearance-none rounded-xl relative block w-full px-3 py-3 pl-10 min-h-[44px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 sm:text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your username or email"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-orange-500/25 min-h-[44px]"
          >
            {isLoading ? 'Sending...' : 'Send Reset Instructions'}
          </button>
        </div>
      </motion.form>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="text-center"
      >
        <button
          onClick={() => router.push('/login')}
          className="text-sm text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors duration-300 font-medium"
        >
          Back to Login
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-md w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your username or email address and we'll send you instructions to reset your password.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="mt-8 space-y-6"
        >
          <ForgotPasswordForm />
        </motion.div>
      </div>
    </div>
  )
}

