import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Accept: 'application/json' }, // ✅ fixes 406 (Not Acceptable)
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // ignored during SSR
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch {
            // ignored during SSR
          }
        },
      },
    }
  )
}

/**
 * Validate session and return user if valid, null if invalid
 * Automatically cleans up invalid sessions
 */
export async function validateSession() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('[supabase/server] Invalid session detected:', error.message)
      // Try to clear invalid session
      try {
        await supabase.auth.signOut()
      } catch (signOutError) {
        console.error('[supabase/server] Error clearing invalid session:', signOutError)
      }
      return null
    }
    
    return user
  } catch (error) {
    console.error('[supabase/server] Error validating session:', error)
    return null
  }
}

