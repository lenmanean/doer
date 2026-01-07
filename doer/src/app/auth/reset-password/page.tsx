'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { motion } from 'framer-motion'
import { validatePassword } from '@/lib/password-security'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const router = useRouter()
  const { addToast } = useToast()

  useEffect(() => {
    // Check if we have a valid session (Supabase should have handled the token from URL hash)
    const checkSession = async () => {
      try {
        // Wait a bit for Supabase to process the hash token
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          addToast({
            type: 'error',
            title: 'Invalid Reset Link',
            description: 'This password reset link is invalid or has expired. Please request a new one.',
            duration: 7000,
          })
          setTimeout(() => {
            router.push('/auth/forgot-password')
          }, 2000)
          return
        }
        
        setIsValidating(false)
      } catch (error) {
        console.error('Error checking session:', error)
        addToast({
          type: 'error',
          title: 'Error',
          description: 'An error occurred while validating your reset link. Please try again.',
          duration: 5000,
        })
        setTimeout(() => {
          router.push('/auth/forgot-password')
        }, 2000)
      }
    }

    checkSession()
  }, [router, addToast])

  // Real-time password validation
  useEffect(() => {
    if (password && confirmPassword) {
      if (password !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match')
      } else {
        setConfirmPasswordError('')
      }
    } else {
      setConfirmPasswordError('')
    }
  }, [password, confirmPassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setPasswordError('')
    setConfirmPasswordError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match')
      addToast({
        type: 'error',
        title: 'Passwords Do Not Match',
        description: 'Please make sure both passwords are the same.',
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    // Validate password strength
    const passwordValidation = await validatePassword(password)
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error || 'Password does not meet requirements')
      addToast({
        type: 'error',
        title: 'Password Too Weak',
        description: passwordValidation.error || 'Password does not meet requirements.',
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    try {
      // Update password using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        console.error('Error updating password:', error)
        addToast({
          type: 'error',
          title: 'Reset Failed',
          description: error.message || 'Failed to reset password. The link may have expired.',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      addToast({
        type: 'success',
        title: 'Password Reset Successful',
        description: 'Your password has been updated. You can now sign in with your new password.',
        duration: 5000,
      })

      // Sign out to clear the temporary reset session
      await supabase.auth.signOut()

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err) {
      console.error('Unexpected error:', err)
      addToast({
        type: 'error',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      })
      setIsLoading(false)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Validating reset link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-md w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Set New Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your new password below.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <div className="mt-1 relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError('')
                }}
                disabled={isLoading}
                className={`appearance-none rounded-xl relative block w-full px-3 py-3 pl-10 pr-10 min-h-[44px] border ${
                  passwordError
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-gray-300 dark:border-gray-700'
                } bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 sm:text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                placeholder="Enter your new password"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px]"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm New Password
            </label>
            <div className="mt-1 relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setConfirmPasswordError('')
                }}
                disabled={isLoading}
                className={`appearance-none rounded-xl relative block w-full px-3 py-3 pl-10 pr-10 min-h-[44px] border ${
                  confirmPasswordError
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-gray-300 dark:border-gray-700'
                } bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500/50 sm:text-base transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                placeholder="Confirm your new password"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px]"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                )}
              </button>
            </div>
            {confirmPasswordError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{confirmPasswordError}</p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-orange-500/25 min-h-[44px]"
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  )
}

