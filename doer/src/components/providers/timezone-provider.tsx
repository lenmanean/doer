'use client'

import { useEffect } from 'react'
import { useSupabase } from '@/components/providers/supabase-provider'

/**
 * TimezoneProvider - Automatically detects and saves user timezone
 * 
 * This component runs on the client side to:
 * 1. Detect the user's browser timezone
 * 2. Save it to user_settings.preferences.timezone if not already set
 * 3. Update it if the timezone has changed (e.g., user traveled)
 */
export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase()

  useEffect(() => {
    // Only run if user is authenticated
    if (!user) {
      return
    }

    const detectAndSaveTimezone = async () => {
      try {
        // Detect timezone from browser
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        
        // Get current user settings
        const response = await fetch('/api/settings/timezone', {
          method: 'GET',
        })

        if (!response.ok) {
          // If endpoint doesn't exist or error, try to save anyway
          await saveTimezone(detectedTimezone)
          return
        }

        const data = await response.json()
        const currentTimezone = data.timezone

        // Only update if timezone is different or not set
        if (!currentTimezone || currentTimezone !== detectedTimezone) {
          await saveTimezone(detectedTimezone)
        }
      } catch (error) {
        // Silently fail - timezone detection is not critical
        console.debug('[TimezoneProvider] Timezone detection failed:', error)
      }
    }

    const saveTimezone = async (timezone: string) => {
      try {
        await fetch('/api/settings/timezone', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ timezone }),
        })
      } catch (error) {
        console.debug('[TimezoneProvider] Failed to save timezone:', error)
      }
    }

    // Run on mount and when user changes
    detectAndSaveTimezone()
  }, [user?.id])

  return <>{children}</>
}

