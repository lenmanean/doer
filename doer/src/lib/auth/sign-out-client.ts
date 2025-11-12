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
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }

  const response = await fetch('/auth/signout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = 'Failed to sign out.'

    try {
      const data = await response.json()
      if (data?.error) {
        message = data.error
      }
    } catch {
      // ignore JSON parse errors and fall back to default message
    }

    throw new Error(message)
  }

  if (options?.onAfterSignOut) {
    await options.onAfterSignOut()
  }
}





