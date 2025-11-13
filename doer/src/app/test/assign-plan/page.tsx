'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase/client'

export default function TestAssignPlanPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')

  const fetchUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      return user.id
    }
    return null
  }

  const assignPlan = async (planSlug: string, cycle: 'monthly' | 'annual') => {
    setLoading(true)
    setResult(null)

    try {
      const uid = userId || (await fetchUserId())
      if (!uid) {
        setResult('Error: Not logged in')
        return
      }

      const response = await fetch('/api/stripe/mock-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          planSlug,
          cycle,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult(`✅ Successfully assigned ${planSlug} (${cycle}) plan!`)
      } else {
        setResult(`❌ Error: ${data.error || data.message || 'Unknown error'}`)
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[#d7d2cb] mb-6">Test Plan Assignment</h1>
        <p className="text-[#d7d2cb]/60 mb-8">
          This page lets you test plan assignment without going through Stripe checkout.
          Make sure <code className="bg-white/10 px-2 py-1 rounded">PLAN_ASSIGNMENT_ENABLED=true</code> in your .env.local
        </p>

        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-[#d7d2cb] mb-4">Basic Plan</h2>
            <Button
              onClick={() => assignPlan('basic', 'monthly')}
              disabled={loading}
              className="w-full"
            >
              Assign Basic (Monthly)
            </Button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-[#d7d2cb] mb-4">Pro Plan</h2>
            <div className="space-y-2">
              <Button
                onClick={() => assignPlan('pro', 'monthly')}
                disabled={loading}
                className="w-full"
              >
                Assign Pro (Monthly)
              </Button>
              <Button
                onClick={() => assignPlan('pro', 'annual')}
                disabled={loading}
                className="w-full"
              >
                Assign Pro (Annual)
              </Button>
            </div>
          </div>
        </div>

        {result && (
          <div className={`mt-6 p-4 rounded-lg ${
            result.includes('✅') ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'
          }`}>
            <p className="text-[#d7d2cb]">{result}</p>
          </div>
        )}

        {userId && (
          <div className="mt-4 text-sm text-[#d7d2cb]/60">
            User ID: <code className="bg-white/10 px-2 py-1 rounded">{userId}</code>
          </div>
        )}
      </div>
    </div>
  )
}



