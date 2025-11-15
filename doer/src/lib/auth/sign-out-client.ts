import type { SupabaseClient } from '@supabase/supabase-js'

interface SignOutOptions {
  /**
   * Whether to refresh the router after signing out.
   */
  onAfterSignOut?: () => Promise<void> | void
}

/**
 * Clear all browser storage related to Supabase authentication
 */
function clearBrowserStorage() {
  if (typeof window === 'undefined') return
  
  try {
    console.error('[signOutClient] Clearing browser storage...')
    
    // Get Supabase project ref to identify storage keys
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
      if (key) {
        // Clear Supabase-related keys
        if (key.startsWith('sb-') || 
            key.includes('supabase') || 
            key.includes('auth') ||
            (projectRef && key.includes(projectRef))) {
          localStorageKeys.push(key)
        }
      }
    }
    
    for (const key of localStorageKeys) {
      try {
        localStorage.removeItem(key)
        console.error('[signOutClient] Removed localStorage key:', key)
      } catch (e) {
        console.error('[signOutClient] Error removing localStorage key:', key, e)
      }
    }
    
    // Clear sessionStorage
    const sessionStorageKeys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key) {
        // Clear Supabase-related keys
        if (key.startsWith('sb-') || 
            key.includes('supabase') || 
            key.includes('auth') ||
            (projectRef && key.includes(projectRef))) {
          sessionStorageKeys.push(key)
        }
      }
    }
    
    for (const key of sessionStorageKeys) {
      try {
        sessionStorage.removeItem(key)
        console.error('[signOutClient] Removed sessionStorage key:', key)
      } catch (e) {
        console.error('[signOutClient] Error removing sessionStorage key:', key, e)
      }
    }
    
    console.error('[signOutClient] Browser storage cleared:', {
      localStorage: localStorageKeys.length,
      sessionStorage: sessionStorageKeys.length,
    })
  } catch (error) {
    console.error('[signOutClient] Error clearing browser storage:', error)
    // Continue even if storage clearing fails
  }
}

export async function signOutClient(
  supabase: SupabaseClient,
  options?: SignOutOptions
) {
  console.error('[signOutClient] Starting sign out process...')
  
  try {
    // Step 1: Clear browser storage first (before sign out to prevent race conditions)
    clearBrowserStorage()
    
    // Step 2: Sign out from Supabase client-side
    console.error('[signOutClient] Calling supabase.auth.signOut()...')
    
    // Add timeout to prevent hanging
    const signOutPromise = supabase.auth.signOut()
    const timeoutPromise = new Promise<{ error: any }>((resolve) => 
      setTimeout(() => resolve({ error: { message: 'Sign out timeout after 5 seconds' } }), 5000)
    )
    
    const { error: signOutError } = await Promise.race([signOutPromise, timeoutPromise])

    if (signOutError) {
      console.error('[signOutClient] Supabase sign out error:', signOutError)
      // Don't throw immediately - try server-side sign out anyway
      // Some errors might be recoverable (e.g., network issues)
    } else {
      console.error('[signOutClient] Client-side sign out successful')
    }
    
    // Step 3: Clear browser storage again after sign out (in case new items were created)
    clearBrowserStorage()

    // Step 4: Sign out from server-side (clears cookies)
    console.error('[signOutClient] Calling server-side sign out endpoint...')
    try {
      const response = await fetch('/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error'
        console.error('[signOutClient] Server-side sign out failed:', {
          status: response.status,
          statusText,
        })
        
        let message = 'Failed to sign out from server.'
        try {
          const data = await response.json()
          if (data?.error) {
            message = data.error
          }
        } catch {
          // ignore JSON parse errors and fall back to default message
        }
        
        // If client-side sign out succeeded, we can still proceed
        if (!signOutError) {
          console.warn('[signOutClient] Client-side sign out succeeded, but server-side failed. Continuing...')
          // Don't throw - client-side sign out was successful
        } else {
          // Both failed
          throw new Error(message)
        }
      } else {
        console.error('[signOutClient] Server-side sign out successful')
      }
    } catch (fetchError) {
      console.error('[signOutClient] Error calling server-side sign out:', fetchError)
      // If client-side sign out succeeded, we can still proceed
      if (!signOutError) {
        console.warn('[signOutClient] Client-side sign out succeeded, but server-side call failed. Continuing...')
        // Don't throw - client-side sign out was successful
      } else {
        // Both failed
        throw fetchError instanceof Error ? fetchError : new Error('Failed to sign out from server')
      }
    }
    
    // Step 5: Force server session sync to remove any lingering cookies
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
        body: JSON.stringify({ event: 'SIGNED_OUT', session: null }),
      })
    } catch (syncError) {
      console.warn('[signOutClient] Failed to sync server session during sign out:', syncError)
    }
    
    // Step 6: Final storage cleanup (ensure everything is cleared)
    clearBrowserStorage()

    // Step 7: Call optional callback
    if (options?.onAfterSignOut) {
      console.error('[signOutClient] Calling onAfterSignOut callback...')
      await options.onAfterSignOut()
    }

    console.error('[signOutClient] Sign out process completed successfully')
  } catch (error) {
    console.error('[signOutClient] Unexpected error during sign out:', error)
    throw error
  }
}





