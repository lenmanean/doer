'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function AuthCodeErrorPage() {
  const router = useRouter()
  const { addToast } = useToast()

  useEffect(() => {
    // Show error toast when page loads
    addToast({
      type: 'error',
      title: 'Authentication Error',
      description: 'There was an error processing your authentication code. Please try signing in again.',
      duration: 7000,
    })
  }, [addToast])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <CardTitle>Authentication Error</CardTitle>
          </div>
          <CardDescription>
            There was an error processing your authentication code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-400">
            This usually happens when:
          </p>
          <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
            <li>The authentication code has expired</li>
            <li>The code has already been used</li>
            <li>There was a network error</li>
          </ul>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.location.href = '/login'
              }}
              className="flex-1"
            >
              Go to Login
            </Button>
            <Button
              variant="outline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.location.href = '/'
              }}
            >
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

