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
      name: "Sarah Chen",
      role: "Entrepreneur",
      content: "DOER.AI transformed my vague business idea into a concrete 90-day action plan. I actually achieved my goal for the first time.",
      rating: 5
    },
    {
      name: "Marcus Johnson",
      role: "Student",
      content: "Finally, a tool that doesn't just track tasks but helps me understand why I'm succeeding or struggling.",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      role: "Professional",
      content: "The AI-generated milestones were spot-on. It's like having a personal productivity coach available 24/7.",
      rating: 5
    }
  ]

  const stats = [
    { number: "10,000+", label: "Goals Achieved" },
    { number: "95%", label: "Success Rate" },
    { number: "3.2x", label: "Faster Achievement" },
    { number: "24/7", label: "AI Support" }
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
              <a href="#pricing" className="text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors">Pricing</a>
              <Link href="/login">
                <Button variant="outline" size="sm">Sign In</Button>
              </Link>
              <Link href="/login">
                <Button variant="primary" size="sm">Get Started</Button>
              </Link>
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
              <a href="#pricing" className="block text-[#d7d2cb]/70 hover:text-[#d7d2cb] transition-colors">Pricing</a>
              <div className="flex flex-col space-y-2 pt-4 border-t border-white/10">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                </Link>
                <Link href="/login">
                  <Button variant="primary" size="sm" className="w-full">Get Started</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <FadeInWrapper direction="up" delay={0.1}>
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
                Turn Your{' '}
                <span className="bg-gradient-to-r from-[#ff7f00] to-orange-600 bg-clip-text text-transparent">
                  Goals
                </span>
                {' '}Into Reality
              </h1>
              <p className="text-xl md:text-2xl text-[#d7d2cb]/70 mb-8 leading-relaxed">
                AI-powered roadmap generation that transforms your written goals into structured, 
                actionable plans you can actually follow.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login">
                  <Button variant="primary" size="lg" className="group">
                    Start Achieving Today
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg">
                  Watch Demo
                </Button>
              </div>
            </div>
          </FadeInWrapper>

          {/* Stats */}
          <FadeInWrapper direction="up" delay={0.3}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-[#ff7f00] mb-2">
                    {stat.number}
                  </div>
                  <div className="text-[#d7d2cb]/60 text-sm">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </FadeInWrapper>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeInWrapper direction="up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Everything You Need to{' '}
                <span className="bg-gradient-to-r from-[#ff7f00] to-orange-600 bg-clip-text text-transparent">
                  Succeed
                </span>
              </h2>
              <p className="text-xl text-[#d7d2cb]/70 max-w-3xl mx-auto">
                Our AI doesn't just create plans—it creates plans that work. 
                Built for achievers who want results, not complexity.
              </p>
            </div>
          </FadeInWrapper>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FadeInWrapper key={index} direction="up" delay={index * 0.1}>
                <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 group">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#ff7f00] to-orange-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-[#d7d2cb]">
                    {feature.title}
                  </h3>
                  <p className="text-[#d7d2cb]/70 leading-relaxed">
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

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <FadeInWrapper direction="up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Trusted by{' '}
                <span className="bg-gradient-to-r from-[#ff7f00] to-orange-600 bg-clip-text text-transparent">
                  Achievers
                </span>
              </h2>
              <p className="text-xl text-[#d7d2cb]/70 max-w-3xl mx-auto">
                Join thousands of users who have transformed their goals into reality.
              </p>
            </div>
          </FadeInWrapper>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <FadeInWrapper key={index} direction="up" delay={index * 0.1}>
                <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-[#ff7f00] fill-current" />
                    ))}
                  </div>
                  <p className="text-[#d7d2cb]/80 mb-4 leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  <div>
                    <div className="font-semibold text-[#d7d2cb]">
                      {testimonial.name}
                    </div>
                    <div className="text-[#d7d2cb]/60 text-sm">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </FadeInWrapper>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <FadeInWrapper direction="up">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to{' '}
              <span className="bg-gradient-to-r from-[#ff7f00] to-orange-600 bg-clip-text text-transparent">
                Achieve Your Goals?
              </span>
            </h2>
            <p className="text-xl text-[#d7d2cb]/70 mb-8 leading-relaxed">
              Join thousands of achievers who have transformed their ideas into reality. 
              Start your journey today—it's free to begin.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button variant="primary" size="lg" className="group">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="outline" size="lg">
                Learn More
              </Button>
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
