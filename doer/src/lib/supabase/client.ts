import { createBrowserClient } from '@supabase/ssr'

// Ensure environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables')
}

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    global: {
      headers: { 
        Accept: 'application/json',
      },
    },
  }
)

/**
 * Validate and clean up invalid sessions
 * This should be called periodically to ensure session integrity
 */
export async function validateAndCleanSession() {
  if (typeof window === 'undefined') return { valid: false, user: null }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      // Session is invalid - clear it
      console.error('[supabase/client] Invalid session detected, clearing:', error.message)
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (signOutError) {
        console.error('[supabase/client] Error clearing invalid session:', signOutError)
      }
      return { valid: false, user: null }
    }
    
    return { valid: true, user }
  } catch (error) {
    console.error('[supabase/client] Error validating session:', error)
    return { valid: false, user: null }
  }
}

