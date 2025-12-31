'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { 
  ChevronDown, 
  ChevronUp, 
  Bug,
  Send,
  BookOpen,
  MessageSquare
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
}

const faqs: FAQ[] = [
  {
    id: '1',
    category: 'Getting Started',
    question: 'How do I create my first goal?',
    answer: 'To create your first goal, complete the onboarding process where you\'ll be guided through setting up your goal, timeframe, and initial planning. You can also create additional goals from the dashboard using the "Switch Plan" modal.'
  },
  {
    id: '2',
    category: 'Getting Started',
    question: 'What is a plan?',
    answer: 'A plan is your personalized strategy that breaks down your goal into achievable checkpoints and daily tasks. It\'s automatically generated based on your goal and timeframe, helping you stay on track every step of the way.'
  },
  {
    id: '3',
    category: 'Tasks & Checkpoints',
    question: 'How do I complete a task?',
    answer: 'Simply click on any task in your dashboard or plan to mark it as complete. Completed tasks will show a green checkmark and contribute to your overall progress and health score.'
  },
  {
    id: '4',
    category: 'Tasks & Checkpoints',
    question: 'What happens when I complete a checkpoint?',
    answer: 'Completing a checkpoint is a significant achievement! Your progress bar will update, your health score may improve, and you\'ll see visual feedback celebrating your accomplishment. Checkpoints help structure your journey toward your final goal.'
  },
  {
    id: '5',
    category: 'Health System',
    question: 'How does the health system work?',
    answer: 'Your plan health is a dynamic score (0-100) that reflects how well you\'re maintaining your commitments. It starts at 100 and decreases when you miss scheduled tasks. Completing tasks on time keeps your health high. Think of it as your accountability score.'
  },
  {
    id: '6',
    category: 'Health System',
    question: 'Why is my health score decreasing?',
    answer: 'Your health score decreases when you miss scheduled tasks or don\'t complete them on time. To improve it, focus on completing your daily tasks consistently. The health system encourages regular engagement with your goals.'
  },
  {
    id: '7',
    category: 'Profile & Settings',
    question: 'How do I change my profile picture?',
    answer: 'Go to the Community page and click the profile button in the top right. Click "Upload Photo" to select an image, then use the cropping tool to adjust it. Your new profile picture will appear throughout the app.'
  },
  {
    id: '8',
    category: 'Profile & Settings',
    question: 'Can I change my goal after starting?',
    answer: 'Yes! You can switch to a different goal or create a new one from the dashboard. Click the switch icon in the "Current Goal" panel. Note that switching goals will start a fresh roadmap.'
  },
  {
    id: '9',
    category: 'Community',
    question: 'What is the Community page for?',
    answer: 'The Community page connects you with other users pursuing their goals. Join our Discord server for real-time discussions, share achievements (opt-in), and find accountability partners to stay motivated.'
  },
  {
    id: '10',
    category: 'Community',
    question: 'How do I control my privacy settings?',
    answer: 'Go to Settings > Privacy & Security to control what information is shared. You can toggle achievement sharing, profile visibility, and progress visibility to match your comfort level.'
  },
  {
    id: '11',
    category: 'Technical',
    question: 'Is my data secure?',
    answer: 'Yes! We use industry-standard encryption and Supabase for secure data storage. Your information is protected with Row Level Security (RLS) policies, ensuring only you can access your personal data.'
  },
  {
    id: '12',
    category: 'Technical',
    question: 'Can I export my data?',
    answer: 'Yes, you can download all your data from Settings > Privacy & Security > Download My Data. This includes your goals, tasks, milestones, and progress history in a portable format.'
  }
]

export default function HelpPage() {
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)
  const [showBugModal, setShowBugModal] = useState(false)
  const [bugReport, setBugReport] = useState({
    title: '',
    description: '',
    category: 'bug',
    severity: 'medium'
  })
  const [submittingBug, setSubmittingBug] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)


  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingBug(true)

    try {
      // Submit bug report via email or support system
      const response = await fetch('/api/support/bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...bugReport,
          userId: user?.id,
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit bug report')
      }

      setSubmitSuccess(true)
      setBugReport({ title: '', description: '', category: 'bug', severity: 'medium' })
      setTimeout(() => setSubmitSuccess(false), 3000)
    } catch (error) {
      console.error('Error submitting bug report:', error)
      alert('Failed to submit bug report. Please try again or contact support directly.')
    } finally {
      setSubmittingBug(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--foreground)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar 
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/help"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaggeredFadeIn>
          {/* Header */}
          <FadeInWrapper delay={0.1} direction="up">
            <div className="mb-8">
              <h1 className="text-5xl font-bold tracking-tight text-[var(--foreground)] mb-4">
                Help Center
              </h1>
              <p className="text-base leading-relaxed text-[var(--muted-foreground)]">
                Find answers to common questions and get support
              </p>
            </div>
          </FadeInWrapper>

          {/* Quick Links */}
          <FadeInWrapper delay={0.15} direction="up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <BookOpen className="w-8 h-8 text-blue-400 mb-3" />
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Documentation</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">Comprehensive guides and tutorials</p>
                </CardContent>
              </Card>

              {/* Community card temporarily disabled until multi-user functionality is implemented */}
              {/* <Card 
                className="border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-colors cursor-pointer"
                onClick={() => window.location.href = '/community'}
              >
                <CardContent className="p-6">
                  <MessageSquare className="w-8 h-8 text-purple-400 mb-3" />
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Community</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">Join discussions on Discord</p>
                </CardContent>
              </Card> */}

              <Card 
                className="border-green-500/20 bg-green-500/5 hover:bg-green-500/10 transition-colors cursor-pointer"
                onClick={() => setShowBugModal(true)}
              >
                <CardContent className="p-6">
                  <Bug className="w-8 h-8 text-green-400 mb-3" />
                  <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Report Bug</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">Help us improve the app</p>
                </CardContent>
              </Card>
            </div>
          </FadeInWrapper>

          <div className="space-y-6">
              <FadeInWrapper delay={0.2} direction="up">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Frequently Asked Questions
                    </CardTitle>
                    <CardDescription>Find answers to common questions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* FAQ List */}
                    <div className="space-y-3">
                      {faqs.map((faq) => (
                          <div
                            key={faq.id}
                            className="border border-white/10 rounded-lg overflow-hidden"
                          >
                            <button
                              onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                              className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors text-left"
                            >
                              <span className="text-sm font-medium text-[var(--foreground)] pr-4">
                                {faq.question}
                              </span>
                              {expandedFAQ === faq.id ? (
                                <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
                              )}
                            </button>
                            <AnimatePresence>
                              {expandedFAQ === faq.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 bg-[var(--input)] border-t border-[var(--border)]">
                                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                                      {faq.answer}
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </FadeInWrapper>
          </div>

          {/* Bug Report Modal */}
          <AnimatePresence>
            {showBugModal && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                  onClick={() => setShowBugModal(false)}
                />

                {/* Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Card className="w-full max-w-md bg-[var(--background)]/95 backdrop-blur-xl border-[var(--border)]">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Bug className="w-5 h-5" />
                          Report a Bug
                        </CardTitle>
                        <button
                          onClick={() => setShowBugModal(false)}
                          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <CardDescription>Help us improve the app</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {submitSuccess ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center py-8"
                        >
                          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bug className="w-6 h-6 text-green-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                            Thank you!
                          </h3>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            Your bug report has been submitted successfully.
                          </p>
                        </motion.div>
                      ) : (
                        <form onSubmit={handleBugSubmit} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Title
                            </label>
                            <input
                              type="text"
                              value={bugReport.title}
                              onChange={(e) => setBugReport({ ...bugReport, title: e.target.value })}
                              placeholder="Brief description of the issue"
                              required
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Category
                            </label>
                            <select
                              value={bugReport.category}
                              onChange={(e) => setBugReport({ ...bugReport, category: e.target.value })}
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            >
                              <option value="bug">Bug</option>
                              <option value="feature">Feature Request</option>
                              <option value="improvement">Improvement</option>
                              <option value="other">Other</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Severity
                            </label>
                            <select
                              value={bugReport.severity}
                              onChange={(e) => setBugReport({ ...bugReport, severity: e.target.value })}
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                              Description
                            </label>
                            <textarea
                              value={bugReport.description}
                              onChange={(e) => setBugReport({ ...bugReport, description: e.target.value })}
                              placeholder="Describe the issue in detail..."
                              required
                              rows={6}
                              className="w-full px-4 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] resize-none"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={submittingBug}
                            className="w-full px-4 py-2 bg-[var(--primary)] backdrop-blur-md border border-[var(--primary)] rounded-lg text-[var(--primary-foreground)] hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {submittingBug ? (
                              <>
                                <div className="w-4 h-4 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                Submit Report
                              </>
                            )}
                          </button>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </StaggeredFadeIn>
      </main>
    </div>
  )
}

