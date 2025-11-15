'use client'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { Mail, Loader2, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { motion } from 'framer-motion'

export default function ConfirmEmailPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()
  const { addToast } = useToast()

  useEffect(() => {
    // Get email from localStorage
    const storedEmail = localStorage.getItem('pendingEmailConfirmation')
    if (storedEmail) {
      setEmail(storedEmail)
    } else {
      // If no email found, redirect to signup
      router.push('/auth/signup')
    }

    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [router])

  useEffect(() => {
    // Resend cooldown timer
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5) {
      const fullOtp = newOtp.join('')
      if (fullOtp.length === 6) {
        handleVerify(fullOtp)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('')
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i + index < 6) {
            newOtp[i + index] = digit
          }
        })
        setOtp(newOtp)
        const nextIndex = Math.min(index + digits.length, 5)
        inputRefs.current[nextIndex]?.focus()
      })
    }
  }

  const handleVerify = async (otpValue?: string) => {
    const code = otpValue || otp.join('')
    
    if (code.length !== 6) {
      addToast({
        type: 'error',
        title: 'Invalid Code',
        description: 'Please enter the complete 6-digit code.',
        duration: 5000
      })
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup'
      })

      if (error) {
        addToast({
          type: 'error',
          title: 'Verification Failed',
          description: error.message || 'Invalid or expired code. Please try again.',
          duration: 5000
        })
        // Clear OTP on error
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        // Clear stored email
        localStorage.removeItem('pendingEmailConfirmation')
        addToast({
          type: 'success',
          title: 'Email Confirmed!',
          description: 'Your email has been verified. Please complete your profile setup.',
          duration: 3000
        })

        try {
          await fetch('/api/stripe/assign-basic', {
            method: 'POST',
            credentials: 'include'
          })
        } catch (assignError) {
          console.error('[ConfirmEmail] Failed to auto-assign plan:', assignError)
        }

        // Redirect to profile setup
        router.push('/auth/profile-setup')
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Verification Error',
        description: 'An unexpected error occurred. Please try again.',
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return

    setIsResending(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email
      })

      if (error) {
        // Check for SMTP/email sending errors
        const isEmailError = error.message.toLowerCase().includes('email') || 
                            error.message.toLowerCase().includes('smtp') ||
                            error.message.toLowerCase().includes('mail')
        
        addToast({
          type: 'error',
          title: 'Resend Failed',
          description: isEmailError 
            ? 'Unable to send email. Please contact support or try again later.'
            : error.message || 'Unable to resend code. Please try again.',
          duration: 7000
        })
      } else {
        addToast({
          type: 'success',
          title: 'Code Resent',
          description: 'A new confirmation code has been sent to your email.',
          duration: 5000
        })
        setResendCooldown(60) // 60 second cooldown
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Resend Error',
        description: 'An unexpected error occurred. Please try again.',
        duration: 5000
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-[#ff7f00]/20 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-[#ff7f00]" />
            </div>
            <h2 className="text-3xl font-extrabold text-[#d7d2cb]">
              Confirm Your Email
            </h2>
            <p className="mt-2 text-sm text-[#d7d2cb]/70">
              We've sent a 6-digit confirmation code to
            </p>
            <p className="mt-1 text-sm font-medium text-[#ff7f00]">
              {email}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 space-y-6"
        >
          {/* OTP Input */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-[#d7d2cb] text-center">
              Enter Confirmation Code
            </label>
            <div className="flex justify-center gap-3">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-semibold rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-[#ff7f00]/50 focus:bg-white/10 transition-all duration-300"
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>

          {/* Verify Button */}
          <button
            onClick={() => handleVerify()}
            disabled={isLoading || otp.join('').length !== 6}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-[#ff7f00] hover:bg-[#e67300] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff7f00] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[#ff7f00]/25"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Email'
            )}
          </button>

          {/* Resend Code */}
          <div className="text-center">
            <p className="text-sm text-[#d7d2cb]/70 mb-2">
              Didn't receive the code?
            </p>
            <button
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="text-sm text-[#ff7f00] hover:text-[#ff9500] transition-colors duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 inline mr-1 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                'Resend Code'
              )}
            </button>
          </div>

          {/* Back to Signup */}
          <div className="text-center">
            <button
              onClick={() => router.push('/auth/signup')}
              className="inline-flex items-center text-sm text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Sign Up
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

