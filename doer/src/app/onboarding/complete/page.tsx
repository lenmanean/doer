'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, ArrowRight, Star, Zap, Shield, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { supabase } from '@/lib/supabase/client'

export default function OnboardingCompletePage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [showPlanSelection, setShowPlanSelection] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }
      
      setLoading(false)
    }
    
    checkUser()
  }, [router])
  
  useEffect(() => {
    // Show plan selection after a brief delay
    const timer = setTimeout(() => {
      setShowPlanSelection(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const handlePlanSelect = async (plan: string) => {
    setSelectedPlan(plan)
    
    // Navigate to loading page which will generate the plan
    router.push('/onboarding/loading')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <StaggeredFadeIn className="max-w-2xl mx-auto space-y-8">
        {/* Success Icon */}
        <FadeInWrapper delay={0.1} direction="up">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </div>
        </FadeInWrapper>

        {/* Success Message */}
        <FadeInWrapper delay={0.2} direction="up">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-[#d7d2cb]">
                Onboarding Complete!
              </CardTitle>
              <CardDescription className="text-lg text-[#d7d2cb]/70">
                Your information has been saved successfully
              </CardDescription>
            </CardHeader>
            
            <CardContent className="text-center space-y-6">
              <div className="space-y-4">
                <p className="text-[#d7d2cb] text-lg">
                  Thank you for providing your goal information. We're working hard to create your personalized roadmap.
                </p>
                
                <div className="bg-[#ff7f00]/10 border border-[#ff7f00]/20 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-[#d7d2cb] mb-2">
                    What's Next?
                  </h3>
                  <p className="text-[#d7d2cb]/70">
                    Our AI has analyzed your goals and generated a comprehensive roadmap tailored specifically for you. 
                    Review your personalized roadmap and then choose your plan to complete onboarding.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={() => setShowPlanSelection(true)}
                    className="flex items-center gap-2 group"
                  >
                    Choose Your Plan
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeInWrapper>

        {/* Progress Indicator */}
        <FadeInWrapper delay={0.3} direction="up">
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div className="w-3 h-3 rounded-full bg-[#ff7f00]"></div>
          </div>
        </FadeInWrapper>
      </StaggeredFadeIn>

      {/* Plan Selection Popup */}
      <AnimatePresence>
        {showPlanSelection && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={() => setShowPlanSelection(false)}
            />

            {/* Popup Content */}
            <motion.div
              className="relative w-full max-w-6xl bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-[#d7d2cb] mb-2">Choose Your Plan</h2>
                  <p className="text-[#d7d2cb]/70">Select the plan that best fits your needs</p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Pro Plan */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative"
                  >
                    <Card className="h-full bg-white/10 backdrop-blur-md border border-[#ff7f00]/30 hover:border-[#ff7f00]/50 hover:bg-white/15 transition-all duration-300 flex flex-col">
                      <CardHeader className="text-center pb-4">
                        <div className="flex justify-center mb-4">
                          <div className="w-12 h-12 bg-[#ff7f00]/20 rounded-xl flex items-center justify-center">
                            <Star className="w-6 h-6 text-[#ff7f00]" />
                          </div>
                        </div>
                        <div className="relative flex items-center justify-center mb-2">
                          <CardTitle className="text-2xl text-[#d7d2cb]">Pro</CardTitle>
                          <Badge className="absolute left-[calc(50%+1.5rem)] bg-green-500/20 text-green-400 border-green-500/30 pointer-events-none whitespace-nowrap">
                            14-day trial
                          </Badge>
                        </div>
                        <div className="flex flex-col items-center gap-1 mb-4">
                          <span className="text-4xl font-bold text-[#d7d2cb]">FREE</span>
                          <span className="text-[#d7d2cb]/60 line-through">$20/month</span>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col flex-1 space-y-4">
                        <ul className="space-y-3 text-sm text-[#d7d2cb]/80 flex-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>Interactive timeline & calendar</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>15 AI regens per month</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>100GB cloud storage</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>Basic automations</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>Advanced vitality tracking and reporting</span>
                          </li>
                        </ul>
                        <Button
                          onClick={() => handlePlanSelect('pro')}
                          className="w-full bg-[#ff7f00] hover:bg-[#ff7f00]/90 text-white shadow-none mt-auto"
                        >
                          Start Free Trial
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Pro+ Plan */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative"
                  >
                    <Card className="h-full bg-white/10 backdrop-blur-md border border-blue-500/30 hover:border-blue-500/50 hover:bg-white/15 transition-all duration-300 flex flex-col">
                      <CardHeader className="text-center pb-4">
                        <div className="flex justify-center mb-4">
                          <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <Zap className="w-6 h-6 text-blue-400" />
                          </div>
                        </div>
                        <CardTitle className="text-2xl text-[#d7d2cb] mb-2">Pro+</CardTitle>
                        <div className="flex items-center justify-center gap-2 mb-4">
                          <span className="text-4xl font-bold text-[#d7d2cb]">$49.99</span>
                          <span className="text-[#d7d2cb]/60">/month</span>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col flex-1 space-y-4">
                        <ul className="space-y-3 text-sm text-[#d7d2cb]/80 flex-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>Everything in Pro</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>Unlimited AI regens</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>1TB cloud storage</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>Advanced automations</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>Priority support</span>
                          </li>
                        </ul>
                        <Button
                          onClick={() => handlePlanSelect('pro-plus')}
                          className="w-full bg-blue-500 hover:bg-blue-500/90 text-white shadow-none mt-auto"
                        >
                          Choose Pro+
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Enterprise Section */}
                <div className="text-center border-t border-white/10 pt-6">
                  <p className="text-[#d7d2cb]/60">
                    <a
                      href="#"
                      className="text-[#ff7f00] hover:text-[#ff7f00]/80 underline decoration-[#ff7f00]/50 hover:decoration-[#ff7f00] transition-colors duration-200 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault()
                        // TODO: Add navigation to enterprise/contact page when created
                      }}
                    >
                      Contact us
                    </a> for an Enterprise solution
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}