'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function DataResetPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
    show: boolean
  }>({ type: 'success', message: '', show: false })
  const router = useRouter()

  const handleReset = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/datareset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (result.success) {
        setToast({
          type: 'success',
          message: 'All your data has been successfully reset. You will be redirected to the onboarding flow.',
          show: true
        })
        
        // Redirect to onboarding after a short delay
        setTimeout(() => {
          router.push('/onboarding')
        }, 2000)
      } else {
        setToast({
          type: 'error',
          message: result.error || 'Failed to reset your data. Please try again.',
          show: true
        })
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
        show: true
      })
    } finally {
      setIsLoading(false)
      setShowConfirm(false)
    }
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message, show: true })
  }

  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg 
                  className="w-8 h-8 text-red-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Reset All Data
              </h1>
              <p className="text-gray-600">
                This will permanently delete your onboarding responses, roadmap, goals, milestones, tasks, task schedules, completion tracking, and all progress data.
              </p>
            </div>

            {!showConfirm ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg 
                        className="h-5 w-5 text-yellow-400" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Warning
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>This action cannot be undone. All your roadmap data will be permanently deleted and you will need to complete the onboarding process again.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setShowConfirm(true)}
                  variant="destructive"
                  className="w-full"
                >
                  Reset My Data
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg 
                        className="h-5 w-5 text-red-400" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Are you absolutely sure?
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>This will permanently delete:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Your goal and roadmap</li>
                          <li>All milestones and tasks</li>
                          <li>All task schedules</li>
                          <li>All task completions</li>
                          <li>All progress tracking data</li>
                          <li>All clarification responses</li>
                          <li>Your onboarding completion status</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button
                    onClick={() => setShowConfirm(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="destructive"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Resetting...
                      </>
                    ) : (
                      'Yes, Reset Data'
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6">
              <Button
                onClick={() => router.back()}
                variant="ghost"
                className="text-gray-500 hover:text-gray-700"
              >
                ← Go Back
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {toast.show && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className={`rounded-lg border p-4 shadow-lg ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {toast.type === 'success' ? (
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{toast.message}</p>
              </div>
              <button
                onClick={hideToast}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
