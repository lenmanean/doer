'use client'

import { useState } from 'react'
import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

export default function ContactPage() {
  const searchParams = useSearchParams()
  const topic = searchParams.get('topic') || 'general'
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: topic === 'sales' ? 'Sales Inquiry' : 'General Inquiry',
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    addToast({
      type: 'info',
      title: 'Contact Form',
      description: 'Thank you for your message. We will get back to you soon.',
      duration: 5000,
    })
    // TODO: Implement actual contact form submission
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <FadeInWrapper>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Contact Us</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                    Message
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
    </div>
  )
}

