'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export default function CoachesPage() {
  const t = useTranslations()
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    businessName: '',
    numberOfClients: '',
    coachingType: '',
    specialization: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          solutionType: 'coaches',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit form')
      }

      addToast({
        type: 'success',
        title: 'Form Submitted',
        description: 'Thank you for your interest! Our sales team will contact you soon.',
        duration: 5000,
      })

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        businessName: '',
        numberOfClients: '',
        coachingType: '',
        specialization: '',
        message: '',
      })
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Please try again later.',
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors overflow-x-hidden">
      <PublicHeader />
      
      <main className="flex-1 py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 transition-colors">
              {t('pages.solutionsCoaches.title')}
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-slate-300 transition-colors">
              {t('pages.solutionsCoaches.description')}
            </p>
          </div>

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl sm:text-3xl">Contact Sales</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Fill out the form below and our team will get back to you to discuss how DOER.AI can help your coaching business.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 min-h-[44px] bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 min-h-[44px] bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base resize-y"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base resize-y"
                    placeholder="Your coaching business or personal brand name"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Number of Clients *
                    </label>
                    <select
                      value={formData.numberOfClients}
                      onChange={(e) => setFormData({ ...formData, numberOfClients: e.target.value })}
                      className="w-full px-4 py-3 min-h-[44px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                      required
                    >
                      <option value="">Select number of clients</option>
                      <option value="1-10">1-10 clients</option>
                      <option value="11-25">11-25 clients</option>
                      <option value="26-50">26-50 clients</option>
                      <option value="51-100">51-100 clients</option>
                      <option value="100+">100+ clients</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type of Coaching *
                    </label>
                      <select
                        value={formData.coachingType}
                        onChange={(e) => setFormData({ ...formData, coachingType: e.target.value })}
                        className="w-full px-4 py-3 min-h-[44px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                        required
                      >
                        <option value="">Select coaching type</option>
                        <option value="Personal Training">Personal Training</option>
                        <option value="Life Coaching">Life Coaching</option>
                        <option value="Business Coaching">Business Coaching</option>
                        <option value="Career Coaching">Career Coaching</option>
                        <option value="Health & Wellness">Health & Wellness</option>
                        <option value="Nutrition">Nutrition</option>
                        <option value="Other">Other</option>
                      </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Specialization *
                  </label>
                  <input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base resize-y"
                    placeholder="e.g., Strength Training, Weight Loss, Executive Coaching, etc."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Additional Message
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base resize-y"
                    placeholder="Any additional information you'd like to share..."
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}






