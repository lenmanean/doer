'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Target, HelpCircle, MessageCircle, ArrowRight, Check, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
// OnboardingData type removed - using direct API calls instead
import { useOnboardingCompletionProtection } from '@/lib/useOnboardingCompletionProtection'

export default function OnboardingPage() {
  const [goal, setGoal] = useState('')
  const [clarification1, setClarification1] = useState('')
  const [clarification2, setClarification2] = useState('')
  const [startDate, setStartDate] = useState(() => {
    // Default to today's date to allow testing with past dates
    const today = new Date()
    // Use local date formatting to avoid timezone issues
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [aiQuestions, setAiQuestions] = useState<{question1: string, question2: string} | null>(null)
  const [firstQuestionGenerated, setFirstQuestionGenerated] = useState(false)
  const [secondQuestionGenerated, setSecondQuestionGenerated] = useState(false)
  const router = useRouter()
  const { addToast } = useToast()

  // Use the completion protection hook
  const { user, profile, loading } = useOnboardingCompletionProtection()

  const steps = [
    {
      title: "Describe your goal",
      subtext: "Tell us what you want to achieve. Be as specific as you can about your goal.",
      placeholder: "What do you want to achieve? Be as specific as you can about your goal...",
      value: goal,
      setValue: setGoal,
      required: true
    },
    {
      title: aiQuestions?.question1 || "Clarification Question 1",
      subtext: "",
      placeholder: "Your answer here...",
      value: clarification1,
      setValue: setClarification1,
      required: false
    },
    {
      title: aiQuestions?.question2 || "Clarification Question 2",
      subtext: "",
      placeholder: "Your answer here...",
      value: clarification2,
      setValue: setClarification2,
      required: false
    }
  ]

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      // Step 0: Goal → Validate goal feasibility first
      if (currentStep === 0 && !firstQuestionGenerated) {
        setIsLoading(true)
        try {
          console.log('Validating goal feasibility...')
          
          // First validate goal feasibility
          const validationResponse = await fetch('/api/plans/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal: goal.trim() }),
          })

          if (!validationResponse.ok) {
            const errorData = await validationResponse.json()
            throw new Error(errorData.error || 'Failed to validate goal')
          }

          const validationData = await validationResponse.json()
          
          // Log validation results for debugging
          console.log('Goal validation result:', {
            goal: goal.trim(),
            isFeasible: validationData.isFeasible,
            reasoning: validationData.reasoning
          })
          
          if (!validationData.isFeasible) {
            addToast({
              type: 'error',
              title: 'Goal Not Feasible',
              description: validationData.reasoning || 'This goal may be too ambitious or unrealistic. Please try a more achievable goal.',
              duration: 8000
            })
            setIsLoading(false)
            return
          }

          console.log('Goal is feasible, generating first clarification question...')
          
          const response = await fetch('/api/plans/clarify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal_text: goal.trim() }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to generate clarification question')
          }

          const data = await response.json()
          setAiQuestions({
            question1: data.question || "Clarification Question 1",
            question2: "Loading second question..." // Placeholder
          })
          setFirstQuestionGenerated(true)
          
          addToast({
            type: 'success',
            title: 'First Question Generated!',
            description: 'Please answer this question to help us understand your goal better.',
            duration: 3000
          })
        } catch (error: any) {
          addToast({
            type: 'error',
            title: 'Failed to Generate Question',
            description: error.message || 'Please try again.',
            duration: 5000
          })
          setIsLoading(false)
          return
        } finally {
          setIsLoading(false)
        }
      }
      
      // Step 1: First clarification → Generate second clarification question
      if (currentStep === 1 && firstQuestionGenerated && !secondQuestionGenerated) {
        setIsLoading(true)
        try {
          console.log('Generating second clarification question based on first answer...')
          
          const response = await fetch('/api/plans/clarify-second', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              goal_text: goal.trim(),
              first_question: aiQuestions?.question1,
              first_answer: clarification1.trim(),
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to generate second clarification question')
          }

          const data = await response.json()
          setAiQuestions(prev => ({
            question1: prev?.question1 || "",
            question2: data.question || "Clarification Question 2"
          }))
          setSecondQuestionGenerated(true)
          
          addToast({
            type: 'success',
            title: 'Second Question Generated!',
            description: 'Please answer this follow-up question to help us create your personalized plan.',
            duration: 3000
          })
        } catch (error: any) {
          addToast({
            type: 'error',
            title: 'Failed to Generate Second Question',
            description: error.message || 'Please try again.',
            duration: 5000
          })
          setIsLoading(false)
          return
        } finally {
          setIsLoading(false)
        }
      }
      
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1
      setCurrentStep(newStep)
      
      // Clear clarification responses when going back
      if (newStep === 0) {
        // Going back to goal step - clear all clarifications and reset AI questions
        setClarification1('')
        setClarification2('')
        setAiQuestions(null)
        setFirstQuestionGenerated(false)
        setSecondQuestionGenerated(false)
      } else if (newStep === 1) {
        // Going back to first clarification step - clear second clarification
        setClarification2('')
        setSecondQuestionGenerated(false)
        if (aiQuestions) {
          setAiQuestions({
            question1: aiQuestions.question1,
            question2: "Loading second question..."
          })
        }
      }
    }
  }

  const canProceed = () => {
    const currentStepData = steps[currentStep]
    if (currentStepData.required) {
      return currentStepData.value.trim().length > 0
    }
    return true
  }

  const canComplete = () => {
    if (!goal.trim() || !startDate.trim()) return false
    
    // Allow any valid date for testing purposes
    const selectedDate = new Date(startDate)
    return !isNaN(selectedDate.getTime())
  }

  const handleSubmit = async () => {
    if (!user) {
      addToast({
        type: 'error',
        title: 'Authentication Required',
        description: 'Please sign in to continue.',
        duration: 5000
      })
      return
    }
    
    // Basic validation
    if (!goal.trim()) {
      addToast({
        type: 'error',
        title: 'Goal Required',
        description: 'Please describe your goal to continue.',
        duration: 5000
      })
      return
    }

    if (!startDate.trim()) {
      addToast({
        type: 'error',
        title: 'Start Date Required',
        description: 'Please select your preferred start date to continue.',
        duration: 5000
      })
      return
    }

    // Validate that start date is valid
    const selectedDate = new Date(startDate)
    
    if (isNaN(selectedDate.getTime())) {
      addToast({
        type: 'error',
        title: 'Invalid Start Date',
        description: 'Please select a valid start date.',
        duration: 5000
      })
      return
    }

    setIsLoading(true)
    
    try {
      // Save user responses to onboarding_responses table
      const { error: insertError } = await supabase
        .from('onboarding_responses')
        .insert({
          user_id: user.id,
          goal_text: goal.trim(),
          clarification_1: clarification1.trim() || null,
          clarification_2: clarification2.trim() || null,
          clarification_questions: aiQuestions ? [
            aiQuestions.question1,
            aiQuestions.question2
          ] : null,
          start_date: startDate.trim(),
        })

      if (insertError) {
        throw new Error(insertError.message || 'Failed to save onboarding responses')
      }

      addToast({
        type: 'success',
        title: 'Onboarding Complete!',
        description: 'Your information has been saved. Please select your plan to continue.',
        duration: 3000
      })

      // Redirect to plan selection page
      router.push('/onboarding/complete')
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: error.message || 'Failed to save your information. Please try again.',
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <StaggeredFadeIn className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <FadeInWrapper delay={0.1} direction="up">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-extrabold text-[#d7d2cb]">
              Let's Get Started
            </h1>
            <p className="text-lg text-[#d7d2cb]/70 max-w-xl mx-auto">
              Tell us about your goal so we can create a personalized roadmap just for you
            </p>
          </div>
        </FadeInWrapper>

        {/* Progress Indicator - Moved to top */}
        <FadeInWrapper delay={0.2} direction="up">
          <div className="flex justify-center space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index <= currentStep 
                    ? 'bg-[#ff7f00]' 
                    : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </FadeInWrapper>

        {/* Sequential Panels */}
        <div className="relative">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`transition-all duration-500 ${
                index === currentStep
                  ? 'opacity-100 translate-x-0'
                  : index < currentStep
                  ? 'opacity-0 -translate-x-full absolute inset-0'
                  : 'opacity-0 translate-x-full absolute inset-0'
              }`}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl text-[#d7d2cb] flex items-center gap-3">
                    {index === 0 && <Target className="h-6 w-6 text-[#ff7f00]" />}
                    {index === 1 && <HelpCircle className="h-6 w-6 text-[#ff7f00]" />}
                    {index === 2 && <MessageCircle className="h-6 w-6 text-[#ff7f00]" />}
                    {step.title}
                  </CardTitle>
                  <CardDescription className="text-[#d7d2cb]/70">
                    {step.subtext}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="relative">
                        <textarea
                          value={step.value}
                          onChange={(e) => step.setValue(e.target.value)}
                          rows={4}
                          className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-[#ff7f00]/50 focus:bg-white/10 text-sm transition-all duration-300 resize-none"
                          placeholder={step.placeholder}
                          required={step.required}
                        />
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePrevious}
                        disabled={currentStep === 0}
                        className="group"
                      >
                        Previous
                      </Button>
                      
                      {currentStep === steps.length - 1 ? (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleSubmit}
                          disabled={!canComplete() || isLoading}
                          className="group"
                        >
                          {isLoading ? (
                            'Creating Your Roadmap...'
                          ) : (
                            <>
                              Complete Onboarding
                              <Check className="ml-2 h-4 w-4 group-hover:scale-110 transition-transform duration-300" />
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={handleNext}
                          disabled={!canProceed() || isLoading}
                          className="group"
                        >
                          {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              Next
                              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Start Date Panel - Always Visible */}
        <FadeInWrapper delay={0.3} direction="up">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-xl text-[#d7d2cb] flex items-center gap-3">
                <Calendar className="h-5 w-5 text-[#ff7f00]" />
                When would you like to start?
              </CardTitle>
              <CardDescription className="text-[#d7d2cb]/70">
                Choose your preferred start date for your roadmap
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                <div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min="2020-01-01"
                    className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-white/20 bg-white/5 backdrop-blur-sm placeholder-[#d7d2cb]/50 text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-[#ff7f00]/50 focus:bg-white/10 text-sm transition-all duration-300"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </StaggeredFadeIn>
    </div>
  )
}