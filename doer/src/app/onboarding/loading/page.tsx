'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Loader2, Brain, Target, Calendar, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase/client'

interface ProcessStep {
  id: string
  label: string
  icon: any
  status: 'pending' | 'processing' | 'complete' | 'error'
  message?: string
}

export default function OnboardingLoadingPage() {
  const router = useRouter()
  const hasStartedRef = useRef(false)
  const [user, setUser] = useState<any>(null)
  const [steps, setSteps] = useState<ProcessStep[]>([
    { id: 'auth', label: 'Authenticating', icon: Zap, status: 'pending' },
    { id: 'load', label: 'Loading your preferences', icon: Target, status: 'pending' },
    { id: 'analyze', label: 'Analyzing your goal', icon: Brain, status: 'pending' },
    { id: 'generate', label: 'Generating personalized roadmap', icon: Target, status: 'pending' },
    { id: 'milestones', label: 'Creating key milestones', icon: CheckCircle, status: 'pending' },
    { id: 'schedule', label: 'Scheduling daily tasks', icon: Calendar, status: 'pending' },
    { id: 'finalize', label: 'Finalizing your plan', icon: Zap, status: 'pending' },
  ])
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const updateStepStatus = (stepId: string, status: ProcessStep['status'], message?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, message } 
        : step
    ))
  }

  const moveToNextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
  }

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasStartedRef.current) {
      return
    }
    hasStartedRef.current = true

    const authenticateAndGenerate = async () => {
      try {
        // Step 1: Authenticate
        updateStepStatus('auth', 'processing')
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }
        
        setUser(user)
        await new Promise(resolve => setTimeout(resolve, 500))
        updateStepStatus('auth', 'complete')
        moveToNextStep()

        // Step 2: Load preferences
        updateStepStatus('load', 'processing')
        
        // Fetch the most recent onboarding response that hasn't been linked to a plan yet
        // This supports multiple plans - we get the latest unlinked response
        const { data: onboardingData, error: onboardingError } = await supabase
          .from('onboarding_responses')
          .select('*')
          .eq('user_id', user.id)
          .is('plan_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (onboardingError) {
          console.error('Error loading onboarding preferences:', onboardingError)
          throw new Error('Failed to load your preferences. Please try starting onboarding again.')
        }

        await new Promise(resolve => setTimeout(resolve, 800))
        updateStepStatus('load', 'complete', 'Preferences loaded successfully')
        moveToNextStep()

        // Step 3: Analyze goal
        updateStepStatus('analyze', 'processing', 'Our AI is analyzing your goal...')
        await new Promise(resolve => setTimeout(resolve, 1500))
        updateStepStatus('analyze', 'complete', 'Goal analysis complete')
        moveToNextStep()

        // Step 4: Generate roadmap
        updateStepStatus('generate', 'processing', 'Creating your personalized roadmap...')
        
        const response = await fetch('/api/plans/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Plan generation API error:', errorData)
          throw new Error(errorData.message || errorData.error || 'Failed to generate plan')
        }

        const planData = await response.json()
        updateStepStatus('generate', 'complete', 'Roadmap generated successfully')
        moveToNextStep()

        // Step 5: Creating milestones
        updateStepStatus('milestones', 'processing', `Creating ${planData.milestones} key milestones...`)
        await new Promise(resolve => setTimeout(resolve, 1200))
        updateStepStatus('milestones', 'complete', `${planData.milestones} milestones created`)
        moveToNextStep()

        // Step 6: Scheduling tasks
        updateStepStatus('schedule', 'processing', `Scheduling ${planData.tasks.total} tasks across ${planData.timeline.days} days...`)
        await new Promise(resolve => setTimeout(resolve, 1500))
        updateStepStatus('schedule', 'complete', `All tasks scheduled`)
        moveToNextStep()

        // Step 7: Finalize
        updateStepStatus('finalize', 'processing', 'Finalizing your personalized plan...')
        await new Promise(resolve => setTimeout(resolve, 800))
        updateStepStatus('finalize', 'complete', 'Your plan is ready!')
        
        // Wait a moment to show completion, then redirect
        await new Promise(resolve => setTimeout(resolve, 1000))
        router.push('/onboarding/review')

      } catch (err: any) {
        console.error('Error during plan generation:', err)
        setError(err.message || 'Something went wrong')
        
        // Mark current step as error
        const currentStepData = steps[currentStep]
        if (currentStepData) {
          updateStepStatus(currentStepData.id, 'error', err.message)
        }
      }
    }

    authenticateAndGenerate()
  }, [])

  const getStepIcon = (step: ProcessStep) => {
    const IconComponent = step.icon
    
    if (step.status === 'complete') {
      return <CheckCircle className="w-6 h-6 text-green-500" />
    } else if (step.status === 'processing') {
      return <Loader2 className="w-6 h-6 text-[#ff7f00] animate-spin" />
    } else if (step.status === 'error') {
      return <div className="w-6 h-6 text-red-500">✕</div>
    } else {
      return <IconComponent className="w-6 h-6 text-[#d7d2cb]/40" />
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold text-[#d7d2cb]">
            {error ? 'Oops! Something went wrong' : 'Creating Your Roadmap'}
          </h1>
          <p className="text-lg text-[#d7d2cb]/70">
            {error 
              ? 'We encountered an error while generating your plan'
              : 'Our AI is crafting a personalized roadmap just for you'
            }
          </p>
        </motion.div>

        {/* Progress Steps */}
        <Card className="bg-white/5 backdrop-blur-md border border-white/10">
          <CardContent className="p-8">
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`flex items-start gap-4 p-4 rounded-lg transition-all duration-300 ${
                      step.status === 'processing' 
                        ? 'bg-[#ff7f00]/10 border border-[#ff7f00]/30' 
                        : step.status === 'complete'
                        ? 'bg-green-500/5 border border-green-500/20'
                        : step.status === 'error'
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'bg-transparent border border-transparent'
                    }`}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getStepIcon(step)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-base font-semibold ${
                          step.status === 'processing' 
                            ? 'text-[#ff7f00]' 
                            : step.status === 'complete'
                            ? 'text-green-400'
                            : step.status === 'error'
                            ? 'text-red-400'
                            : 'text-[#d7d2cb]/60'
                        }`}>
                          {step.label}
                        </h3>
                        
                        {step.status === 'processing' && (
                          <div className="flex flex-col items-end gap-1">
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="text-xs text-[#ff7f00] font-medium"
                            >
                              Processing...
                            </motion.div>
                            {step.id === 'generate' && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 3, duration: 1 }}
                                className="text-xs text-[#d7d2cb]/50 italic"
                              >
                                This may take a while...
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Step message */}
                      {step.message && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="text-sm text-[#d7d2cb]/70 mt-1"
                        >
                          {step.message}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Progress Bar */}
            <div className="mt-8">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#ff7f00] to-[#ff9f40]"
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: `${(steps.filter(s => s.status === 'complete').length / steps.length) * 100}%` 
                  }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
              <div className="mt-2 text-center text-sm text-[#d7d2cb]/60">
                {steps.filter(s => s.status === 'complete').length} of {steps.length} steps complete
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => router.push('/onboarding')}
              className="px-6 py-3 bg-[#ff7f00] hover:bg-[#ff7f00]/90 text-white rounded-lg font-medium transition-colors duration-200"
            >
              Return to Onboarding
            </button>
          </motion.div>
        )}

        {/* Fun fact or tip while loading */}
        {!error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="text-center text-sm text-[#d7d2cb]/50 italic"
          >
            💡 Tip: You can regenerate your roadmap anytime from your dashboard
          </motion.div>
        )}
      </div>
    </div>
  )
}

