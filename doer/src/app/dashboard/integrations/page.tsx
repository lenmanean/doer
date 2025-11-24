'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect old /dashboard/integrations route to new /integrations route
 */
export default function DashboardIntegrationsRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new integrations hub
    router.replace('/integrations')
  }, [router])

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="text-[var(--foreground)]">Redirecting...</div>
    </div>
  )
}
