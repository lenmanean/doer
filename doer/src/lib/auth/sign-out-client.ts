import type { SupabaseClient } from '@supabase/supabase-js'

interface SignOutOptions {
  /**
   * Whether to refresh the router after signing out.
   */
  onAfterSignOut?: () => Promise<void> | void
}

export async function signOutClient(
  supabase: SupabaseClient,
  options?: SignOutOptions
) {
  console.log('[signOutClient] Starting sign out process...')
  
  try {
    // Step 1: Sign out from Supabase client-side
    console.log('[signOutClient] Calling supabase.auth.signOut()...')
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      console.error('[signOutClient] Supabase sign out error:', signOutError)
      // Don't throw immediately - try server-side sign out anyway
      // Some errors might be recoverable (e.g., network issues)
    } else {
      console.log('[signOutClient] Client-side sign out successful')
    }

    // Step 2: Sign out from server-side (clears cookies)
    console.log('[signOutClient] Calling server-side sign out endpoint...')
    try {
      const response = await fetch('/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
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
        console.log('[signOutClient] Server-side sign out successful')
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

    // Step 3: Call optional callback
    if (options?.onAfterSignOut) {
      console.log('[signOutClient] Calling onAfterSignOut callback...')
      await options.onAfterSignOut()
    }

    console.log('[signOutClient] Sign out process completed successfully')
  } catch (error) {
    console.error('[signOutClient] Unexpected error during sign out:', error)
    throw error
  }
}





