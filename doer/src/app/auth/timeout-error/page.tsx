'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Clock, RefreshCw, Home } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

/**
 * Clear all browser storage related to Supabase authentication
 */
function clearBrowserStorage() {
  if (typeof window === 'undefined') return
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    let projectRef: string | null = null
    
    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl)
        const hostname = url.hostname
        const match = hostname.match(/^([^.]+)\.supabase\.co$/)
        projectRef = match ? match[1] : null
      } catch {
        // Ignore URL parsing errors
      }
    }
    
    // Clear localStorage
    const localStorageKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (
        key.startsWith('sb-') || 
        key.includes('supabase') || 
        key.includes('auth') ||
        (projectRef && key.includes(projectRef))
      )) {
        localStorageKeys.push(key)
      }
    }
    
    localStorageKeys.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch {
        // Ignore storage errors
      }
    })
    
    // Clear sessionStorage
    const sessionStorageKeys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (
        key.startsWith('sb-') || 
        key.includes('supabase') || 
        key.includes('auth') ||
        (projectRef && key.includes(projectRef))
      )) {
        sessionStorageKeys.push(key)
      }
    }
    
    sessionStorageKeys.forEach(key => {
      try {
        sessionStorage.removeItem(key)
      } catch {
        // Ignore storage errors
      }
    })
  } catch {
    // Ignore storage errors
  }
}

export default function TimeoutErrorPage() {
  const router = useRouter()

  // Clear authentication state on mount
  useEffect(() => {
    // Clear browser storage
    clearBrowserStorage()
    
    // Sign out from Supabase (with timeout to prevent hanging)
    const signOutPromise = supabase.auth.signOut()
    const timeoutPromise = new Promise<{ error: any }>((resolve) => 
      setTimeout(() => resolve({ error: { message: 'Sign out timeout' } }), 3000)
    )
    
    Promise.race([signOutPromise, timeoutPromise]).catch(() => {
      // Ignore errors - we're cleaning up anyway
    })
    
    // Clear server-side session cookies
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'SIGNED_OUT', session: null }),
      credentials: 'same-origin',
    }).catch(() => {
      // Ignore errors - we're on an error page anyway
    })
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Clock className="h-12 w-12 text-orange-500" />
          </div>
          <CardTitle className="text-center text-2xl">Authentication Timeout</CardTitle>
          <CardDescription className="text-center mt-2">
            The authentication process took longer than expected. This may be due to network issues or server delays.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>Please try one of the following:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Refresh the page to try again</li>
              <li>Check your internet connection</li>
              <li>Clear your browser cache and cookies</li>
              <li>Try again in a few moments</li>
            </ul>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={() => window.location.reload()}
              className="flex-1"
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
            <Button
              onClick={() => router.push('/login')}
              className="flex-1"
              variant="outline"
            >
              Go to Login
            </Button>
            <Button
              onClick={() => router.push('/')}
              className="flex-1"
              variant="outline"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
