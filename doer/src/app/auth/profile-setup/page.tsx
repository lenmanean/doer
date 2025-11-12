'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { User, Phone, Calendar, Loader2, ArrowRight, ArrowLeft, Check, Megaphone } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const COUNTRY_CODES = [
  { value: '+1', label: 'US/CA (+1)' },
  { value: '+44', label: 'UK (+44)' },
  { value: '+91', label: 'India (+91)' },
  { value: '+86', label: 'China (+86)' },
  { value: '+33', label: 'France (+33)' },
  { value: '+49', label: 'Germany (+49)' },
  { value: '+61', label: 'Australia (+61)' },
  { value: '+81', label: 'Japan (+81)' },
  { value: '+82', label: 'South Korea (+82)' },
]

const REFERRAL_SOURCES = [
  { value: 'search', label: 'Search Engine (Google, Bing, etc.)' },
  { value: 'social', label: 'Social Media (Twitter, LinkedIn, etc.)' },
  { value: 'friend', label: 'Friend or Colleague' },
  { value: 'blog', label: 'Blog or Article' },
  { value: 'youtube', label: 'YouTube or Video' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'ad', label: 'Advertisement' },
  { value: 'other', label: 'Other' },
]

interface StepConfig {
  id: string
  title: string
  description: string
  icon: typeof User
  required?: boolean
}

const STEPS: StepConfig[] = [
  { id: 'name', title: 'Your Name', description: 'What is your name?', icon: User },
  { id: 'dateOfBirth', title: 'Date of Birth', description: 'When were you born?', icon: Calendar },
  { id: 'phoneNumber', title: 'Phone Number', description: 'For account recovery', icon: Phone },
  { id: 'referralSource', title: 'How did you hear about us?', description: 'Help us understand how you found us', icon: Megaphone },
]

export default function ProfileSetupPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)
  
  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [countryCode, setCountryCode] = useState('+1')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [timezone, setTimezone] = useState('UTC')

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        router.push('/login')
        return
      }
      
      setUser(currentUser)
      
      // Auto-detect browser timezone
      try {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (browserTimezone) setTimezone(browserTimezone)
      } catch (e) {
        // Use defaults
      }
      
      setLoading(false)
    }
    
    checkUser()
  }, [router])

  // Focus input when step changes
  useEffect(() => {
    if (inputRef.current && !loading) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
    }
  }, [currentStep, loading])

  const getCurrentValue = () => {
    const step = STEPS[currentStep]
    switch (step.id) {
      case 'name': return '' // Name step has two fields
      case 'dateOfBirth': return dateOfBirth
      case 'phoneNumber': return phoneNumber
      case 'referralSource': return referralSource
      default: return ''
    }
  }

  const setCurrentValue = (value: string) => {
    const step = STEPS[currentStep]
    switch (step.id) {
      case 'dateOfBirth': setDateOfBirth(value); break
      case 'phoneNumber': setPhoneNumber(value); break
      case 'referralSource': setReferralSource(value); break
    }
  }

  const canProceed = () => {
    const step = STEPS[currentStep]
    
    // Special validation for name step (only first name required, last name optional)
    if (step.id === 'name') {
      return firstName.trim().length > 0
    }
    
    if (step.required) {
      const value = getCurrentValue()
      return value.trim().length > 0
    }
    return true
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setSaving(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          date_of_birth: dateOfBirth || null,
          phone_number: phoneNumber.trim() ? `${countryCode}${phoneNumber.trim()}` : null,
          referral_source: referralSource || null,
          timezone: timezone || 'UTC'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save profile')
      }

      addToast({
        type: 'success',
        title: 'Profile Created!',
        description: 'Your profile has been set up successfully.',
        duration: 3000
      })

      // Redirect to onboarding or dashboard
      router.push('/onboarding')
    } catch (error: any) {
      console.error('Error saving profile:', error)
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: error.message || 'Failed to save profile. Please try again.',
        duration: 5000
      })
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canProceed()) {
      e.preventDefault()
      handleNext()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  const currentStepConfig = STEPS[currentStep]
  const Icon = currentStepConfig.icon
  const currentValue = getCurrentValue()
  const isLastStep = currentStep === STEPS.length - 1

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#d7d2cb]/70">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-sm text-[#d7d2cb]/70">
              {Math.round(((currentStep + 1) / STEPS.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#ff7f00] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <Card className="bg-white/5 border-white/10 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <CardHeader>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-full bg-[#ff7f00]/20 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#ff7f00]" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-[#d7d2cb]">
                      {currentStepConfig.title}
                      {currentStepConfig.required && <span className="text-orange-500 ml-1">*</span>}
                    </CardTitle>
                    <CardDescription className="text-[#d7d2cb]/70 mt-1">
                      {currentStepConfig.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Name Input (First and Last) */}
                  {currentStepConfig.id === 'name' && (
                    <div className="space-y-4">
                      <div className="relative">
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="First name"
                          className="w-full px-4 py-4 text-lg bg-white/5 border border-white/10 rounded-xl text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all"
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Last name (Optional)"
                          className="w-full px-4 py-4 text-lg bg-white/5 border border-white/10 rounded-xl text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Date of Birth Input */}
                  {currentStepConfig.id === 'dateOfBirth' && (
                    <div className="relative">
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="date"
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-4 text-lg bg-white/5 border border-white/10 rounded-xl text-[#d7d2cb] focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all"
                      />
                    </div>
                  )}

                  {/* Phone Number Input */}
                  {currentStepConfig.id === 'phoneNumber' && (
                    <div className="relative">
                      <div className="flex gap-3">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="px-4 py-4 text-lg bg-white/5 border border-white/10 rounded-xl text-[#d7d2cb] focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all"
                        >
                          {COUNTRY_CODES.map((cc) => (
                            <option key={cc.value} value={cc.value}>
                              {cc.label}
                            </option>
                          ))}
                        </select>
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          type="tel"
                          value={currentValue}
                          onChange={(e) => setCurrentValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="555-123-4567"
                          className="flex-1 px-4 py-4 text-lg bg-white/5 border border-white/10 rounded-xl text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Referral Source Select */}
                  {currentStepConfig.id === 'referralSource' && (
                    <div className="relative">
                      <select
                        ref={inputRef as React.RefObject<HTMLSelectElement>}
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        className="w-full px-4 py-4 text-lg bg-white/5 border border-white/10 rounded-xl text-[#d7d2cb] focus:outline-none focus:border-[#ff7f00] focus:ring-2 focus:ring-[#ff7f00]/20 transition-all"
                      >
                        <option value="">Select an option...</option>
                        {REFERRAL_SOURCES.map((source) => (
                          <option key={source.value} value={source.value}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      disabled={currentStep === 0}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleNext}
                      disabled={!canProceed() || saving}
                      className="flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : isLastStep ? (
                        <>
                          <Check className="w-4 h-4" />
                          Complete
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>
    </div>
  )
}
