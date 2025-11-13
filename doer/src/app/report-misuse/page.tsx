'use client'

import { useState } from 'react'
import { FadeInWrapper } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export default function ReportMisusePage() {
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    email: '',
    description: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    addToast({
      type: 'info',
      title: 'Report Submitted',
      description: 'Thank you for your report. We will investigate this matter.',
      duration: 5000,
    })
    // TODO: Implement actual misuse reporting
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <FadeInWrapper>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Report Misuse</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
                    Your Email
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
                    Description of Misuse
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb]"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Submit Report
                </Button>
              </form>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
    </div>
  )
}

