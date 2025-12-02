'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Target, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  ArrowRight, 
  Star,
  Users,
  Zap,
  BarChart3,
  Clock,
  Brain,
  Rocket,
  Menu,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { WaitlistForm } from '@/components/ui/WaitlistForm'
import { IS_PRE_LAUNCH } from '@/lib/feature-flags'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Planning",
      description: "Transform any goal into a structured, actionable roadmap with intelligent milestone generation and task breakdown."
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Get personalized timelines and deadlines that adapt to your pace and priorities."
    },
    {
      icon: TrendingUp,
      title: "Progress Tracking",
      description: "Monitor your advancement with real-time health scores and visual progress indicators."
    },
    {
      icon: BarChart3,
      title: "Analytics & Insights",
      description: "Understand your patterns and optimize your approach with detailed performance analytics."
    },
    {
      icon: Zap,
      title: "Instant Setup",
      description: "Go from idea to execution in minutes with our streamlined onboarding process."
    },
    {
      icon: Users,
      title: "Achievement Focused",
      description: "Built for people who want to turn their goals into reality, not just plan them."
    }
  ]

  const testimonials = [
    {
      name: "Early User",
      role: "Beta Tester",
      content: "The time-block scheduling system makes it so easy to see exactly when I need to work on each task. No more guessing about how long things take.",
      rating: 5
    },
    {
      name: "Productivity Enthusiast",
      role: "Beta Tester",
      content: "Finally, a planning tool that actually understands task duration and complexity. The AI estimates are surprisingly accurate.",
      rating: 5
    },
    {
      name: "Goal Achiever",
      role: "Beta Tester",
      content: "The hour-level precision scheduling helps me stay focused and realistic about what I can accomplish each day.",
      rating: 5
    }
  ]

  const stats = [
    { number: "Beta", label: "Launch Phase" },
    { number: "AI-Powered", label: "Duration Estimation" },
    { number: "Hour-Level", label: "Precision Scheduling" },
    { number: "Smart", label: "Rescheduling" }
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#d7d2cb]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-[#ff7f00] to-orange-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-[#d7d2cb]">DOER.AI</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors">Features</a>
              <a href="#testimonials" className="text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors">Testimonials</a>
              {/* Pricing link hidden until launch */}
              {!IS_PRE_LAUNCH && (
                <a href="#pricing" className="text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors">Pricing</a>
              )}
              <Link href="/login">
                <Button variant="outline" size="sm">Sign In</Button>
              </Link>
              {IS_PRE_LAUNCH ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    const waitlistSection = document.getElementById('waitlist')
                    if (waitlistSection) {
                      waitlistSection.scrollIntoView({ behavior: 'smooth' })
                    } else {
                      window.location.href = '/#waitlist'
                    }
                  }}
                >
                  Join Waitlist
                </Button>
              ) : (
                <Link href="/auth/signup">
                  <Button variant="primary" size="sm">Get Started</Button>
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-[#d7d2cb]/70 hover:text-[#d7d2cb] hover:bg-white/5"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10"
          >
            <div className="px-4 py-4 space-y-4">
              <a href="#features" className="block text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors">Features</a>
              <a href="#testimonials" className="block text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors">Testimonials</a>
              {/* Pricing link hidden until launch */}
              {!IS_PRE_LAUNCH && (
                <a href="#pricing" className="block text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors">Pricing</a>
              )}
              <div className="flex flex-col space-y-2 pt-4 border-t border-white/10">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                </Link>
                {IS_PRE_LAUNCH ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.preventDefault()
                      setMobileMenuOpen(false)
                      const waitlistSection = document.getElementById('waitlist')
                      if (waitlistSection) {
                        waitlistSection.scrollIntoView({ behavior: 'smooth' })
                      } else {
                        window.location.href = '/#waitlist'
                      }
                    }}
                  >
                    Join Waitlist
                  </Button>
                ) : (
                  <Link href="/auth/signup">
                    <Button variant="primary" size="sm" className="w-full">Get Started</Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-orange-500/10 opacity-50 blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeInWrapper direction="up" delay={0.1}>
            <div className="text-center max-w-5xl mx-auto">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold mb-8 leading-tight">
                Turn Your{' '}
                <span className="bg-gradient-to-r from-[#ff7f00] via-orange-500 to-[#ff7f00] bg-clip-text text-transparent">
                  Goals
                </span>
                {' '}Into Reality
              </h1>
              <p className="text-2xl md:text-3xl text-[#d7d2cb]/80 mb-10 leading-relaxed max-w-3xl mx-auto">
                AI-powered roadmap generation that transforms your written goals into structured, 
                actionable plans you can actually follow.
              </p>
              <div className="max-w-xl mx-auto mb-12">
                {IS_PRE_LAUNCH ? (
                  <WaitlistForm
                    source="landing_page_hero"
                    variant="compact"
                    placeholder="Enter your email"
                    buttonText="Join Waitlist"
                  />
                ) : (
                  <Link href="/auth/signup">
                    <Button
                      variant="primary"
                      size="lg"
                      className="text-xl px-8 py-6"
                    >
                      Get Started
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                )}
              </div>
              
              {/* Template Suggestions */}
              <div className="mt-12 mb-8">
                <p className="text-[#d7d2cb]/60 text-sm mb-4">Not sure where to start? Try one of these:</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {['Fitness Plan', 'Learning Roadmap', 'Career Goals', 'Project Timeline', 'Habit Tracker'].map((template, idx) => (
                    <button
                      key={idx}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-all"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trust Badge */}
              <div className="mt-8">
                <p className="text-[#d7d2cb]/50 text-sm">Trusted by achievers worldwide</p>
              </div>
            </div>
          </FadeInWrapper>
        </div>
      </section>

      {/* Waitlist Section */}
      <section id="waitlist" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-white/5 to-transparent">
        <div className="max-w-2xl mx-auto text-center">
          <FadeInWrapper direction="up">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-[#d7d2cb]">
              Join the Waitlist
            </h2>
            <p className="text-xl text-[#d7d2cb]/70 mb-8">
              Be the first to know when DOER launches. Get early access and exclusive updates.
            </p>
            <WaitlistForm
              source="landing_page_waitlist_section"
              variant="default"
              placeholder="Enter your email"
              buttonText="Join Waitlist"
            />
          </FadeInWrapper>
        </div>
      </section>

      {/* Features Section - Base44 Style */}
      <section id="features" className="py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <FadeInWrapper direction="up">
            <div className="text-center mb-24">
              <h2 className="text-5xl md:text-6xl font-bold mb-8">
                Consider yourself{' '}
                <span className="bg-gradient-to-r from-[#ff7f00] via-orange-500 to-[#ff7f00] bg-clip-text text-transparent">
                  limitless.
                </span>
              </h2>
              <p className="text-2xl text-[#d7d2cb]/70 max-w-3xl mx-auto">
                If you can describe it, you can build it.
              </p>
            </div>
          </FadeInWrapper>

          {/* Large Feature Cards - Alternating Layout */}
          <div className="space-y-32">
            {features.slice(0, 3).map((feature, index) => (
              <FadeInWrapper key={index} direction={index % 2 === 0 ? "left" : "right"} delay={index * 0.2}>
                <div className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12`}>
                  {/* Icon/Visual */}
                  <div className="flex-1 flex justify-center">
                    <div className="w-64 h-64 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                      <div className="w-32 h-32 bg-gradient-to-br from-[#ff7f00] to-orange-600 rounded-xl flex items-center justify-center shadow-2xl shadow-[#ff7f00]/30">
                        <feature.icon className="w-16 h-16 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-4xl font-bold mb-6 text-[#d7d2cb]">
                      {feature.title}
                    </h3>
                    <p className="text-xl text-[#d7d2cb]/70 leading-relaxed mb-6">
                      {feature.description}
                    </p>
                    {IS_PRE_LAUNCH ? (
                      <Button
                        variant="outline"
                        size="lg"
                        className="group"
                        onClick={(e) => {
                          e.preventDefault()
                          const waitlistSection = document.getElementById('waitlist')
                          if (waitlistSection) {
                            waitlistSection.scrollIntoView({ behavior: 'smooth' })
                          } else {
                            window.location.href = '/#waitlist'
                          }
                        }}
                      >
                        Join Waitlist
                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    ) : (
                      <Link href="/auth/signup">
                        <Button
                          variant="outline"
                          size="lg"
                          className="group"
                        >
                          Get Started
                          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </FadeInWrapper>
            ))}
          </div>

          {/* Grid of remaining features */}
          <div className="grid md:grid-cols-3 gap-8 mt-24">
            {features.slice(3).map((feature, index) => (
              <FadeInWrapper key={index + 3} direction="up" delay={(index + 3) * 0.1}>
                <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#ff7f00] to-orange-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-4 text-[#d7d2cb]">
                    {feature.title}
                  </h3>
                  <p className="text-[#d7d2cb]/70 leading-relaxed text-lg">
                    {feature.description}
                  </p>
                </div>
              </FadeInWrapper>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <FadeInWrapper direction="up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                From Idea to{' '}
                <span className="bg-gradient-to-r from-[#ff7f00] to-orange-600 bg-clip-text text-transparent">
                  Achievement
                </span>
              </h2>
              <p className="text-xl text-[#d7d2cb]/70 max-w-3xl mx-auto">
                Three simple steps to transform any goal into a structured, actionable plan.
              </p>
            </div>
          </FadeInWrapper>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Describe Your Goal",
                description: "Tell us what you want to achieve. Be as specific as you can about your vision and desired outcome.",
                icon: Target
              },
              {
                step: "02", 
                title: "AI Generates Your Roadmap",
                description: "Our AI analyzes your goal and creates a structured plan with milestones, tasks, and realistic timelines.",
                icon: Brain
              },
              {
                step: "03",
                title: "Execute & Track Progress",
                description: "Follow your personalized roadmap with visual progress tracking and intelligent insights along the way.",
                icon: Rocket
              }
            ].map((step, index) => (
              <FadeInWrapper key={index} direction="up" delay={index * 0.2}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#ff7f00] to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white font-bold text-xl">{step.step}</span>
                  </div>
                  <h3 className="text-2xl font-semibold mb-4 text-[#d7d2cb]">
                    {step.title}
                  </h3>
                  <p className="text-[#d7d2cb]/70 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </FadeInWrapper>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials - Base44 Style */}
      <section id="testimonials" className="py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-white/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <FadeInWrapper direction="up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                "Okay, DOER.AI has blown my mind."
              </h2>
              <p className="text-xl text-[#d7d2cb]/70 max-w-3xl mx-auto">
                And other great things our users say about us.
              </p>
            </div>
          </FadeInWrapper>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <FadeInWrapper key={index} direction="up" delay={index * 0.1}>
                <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-[#ff7f00] fill-current" />
                    ))}
                  </div>
                  <p className="text-[#d7d2cb]/80 mb-6 leading-relaxed text-sm">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#ff7f00] to-orange-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-[#d7d2cb] text-sm">
                        {testimonial.name}
                      </div>
                      <div className="text-[#d7d2cb]/60 text-xs">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInWrapper>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Base44 Style */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-orange-500/10 opacity-50 blur-3xl"></div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <FadeInWrapper direction="up">
            <h2 className="text-5xl md:text-6xl font-bold mb-8">
              So, what are we{' '}
              <span className="bg-gradient-to-r from-[#ff7f00] via-orange-500 to-[#ff7f00] bg-clip-text text-transparent">
                building?
              </span>
            </h2>
            <p className="text-2xl text-[#d7d2cb]/80 mb-12 leading-relaxed max-w-3xl mx-auto">
              DOER.AI is the AI-powered platform that lets users build fully functioning goal plans in minutes. 
              Using nothing but natural language, DOER.AI enables anyone to turn their words into structured roadmaps, 
              actionable plans, or complete achievement strategies that are ready to use.
            </p>
            <div className="flex justify-center">
              <div className="max-w-xl w-full">
                {IS_PRE_LAUNCH ? (
                  <WaitlistForm
                    source="landing_page_cta"
                    variant="compact"
                    placeholder="Enter your email"
                    buttonText="Join Waitlist"
                  />
                ) : (
                  <Link href="/auth/signup">
                    <Button
                      variant="primary"
                      size="lg"
                      className="text-xl px-8 py-6"
                    >
                      Get Started
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </FadeInWrapper>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-[#ff7f00] to-orange-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-[#d7d2cb]">DOER.AI</span>
            </div>
            <div className="flex items-center space-x-6 text-[#d7d2cb]/60">
              <a href="#" className="hover:text-[#d7d2cb] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#d7d2cb] transition-colors">Terms</a>
              <a href="#" className="hover:text-[#d7d2cb] transition-colors">Support</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 text-center text-[#d7d2cb]/60">
            <p>&copy; 2024 DOER.AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
