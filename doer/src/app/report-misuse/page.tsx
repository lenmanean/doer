'use client'

import { useState } from 'react'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { useToast } from '@/components/ui/Toast'

export default function ReportMisusePage() {
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    email: '',
    description: '',
    reportedUrl: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Animation hook
  const cardAnim = useScrollAnimation({ delay: 0, triggerOnce: true })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/report-misuse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          description: formData.description,
          reportedUrl: formData.reportedUrl || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit report')
      }

      setIsSubmitted(true)
      addToast({
        type: 'success',
        title: 'Report Submitted',
        description: 'Thank you for your report. We will investigate this matter promptly.',
        duration: 5000,
      })

      // Reset form
      setFormData({
        email: '',
        description: '',
        reportedUrl: '',
      })
    } catch (error) {
      console.error('Error submitting misuse report:', error)
      addToast({
        type: 'error',
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Failed to submit report. Please try again.',
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Card
          ref={cardAnim.ref as React.RefObject<HTMLDivElement>}
          className={`scroll-animate-fade-up ${cardAnim.isVisible ? 'visible' : ''}`}
        >
            <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl mb-2">Report Misuse</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                Help us maintain a safe and respectful community by reporting misuse of the DOER platform.
              </p>
            </CardHeader>
            <CardContent>
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="mb-4">
                    <svg
                      className="w-16 h-16 mx-auto text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Report Submitted Successfully
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Thank you for reporting this issue. We take all reports seriously and will investigate promptly.
                  </p>
                  <Button
                    onClick={() => {
                      setIsSubmitted(false)
                      setFormData({
                        email: '',
                        description: '',
                        reportedUrl: '',
                      })
                    }}
                    variant="primary"
                  >
                    Submit Another Report
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Your Email <span className="text-orange-500">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-4 py-3 min-h-[44px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                      placeholder="your.email@example.com"
                      required
                      disabled={isSubmitting}
                    />
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      We'll use this to contact you if we need more information.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="reportedUrl"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Reported URL (Optional)
                    </label>
                    <input
                      id="reportedUrl"
                      type="url"
                      value={formData.reportedUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, reportedUrl: e.target.value })
                      }
                      className="w-full px-4 py-3 min-h-[44px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                      placeholder="https://usedoer.com/..."
                      disabled={isSubmitting}
                    />
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      If this report is about specific content, please provide the URL.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Description of Misuse <span className="text-orange-500">*</span>
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={8}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y text-base"
                      placeholder="Please provide a detailed description of the misuse, including what happened, when it occurred, and any relevant details..."
                      required
                      minLength={10}
                      maxLength={5000}
                      disabled={isSubmitting}
                    />
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {formData.description.length}/5000 characters (minimum 10 characters)
                    </p>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      <strong>What to Report:</strong>
                    </p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                      <li>Violations of our Terms of Service or Responsible Use Policy</li>
                      <li>Harmful, illegal, or inappropriate content</li>
                      <li>Spam, abuse, or harassment</li>
                      <li>Security vulnerabilities or suspicious activity</li>
                      <li>Any other misuse of the platform</li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    disabled={isSubmitting || formData.description.length < 10}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
      </div>
      </main>
      <PublicFooter />
    </div>
  )
}
