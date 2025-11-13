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

// Clean up corrupted session data on module load (client-side only)
if (typeof window !== 'undefined') {
  // Run cleanup after a short delay to ensure localStorage is accessible
  setTimeout(() => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) return
      
      let projectRef: string | null = null
      try {
        const url = new URL(supabaseUrl)
        const hostname = url.hostname
        const match = hostname.match(/^([^.]+)\.supabase\.co$/)
        projectRef = match ? match[1] : null
      } catch {}
      
      // Check for and remove any localStorage items that are JSON strings but shouldn't be
      const keysToCheck: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (
          key.startsWith('sb-') || 
          (projectRef && key.includes(projectRef))
        )) {
          keysToCheck.push(key)
        }
      }
      
      for (const key of keysToCheck) {
        try {
          const value = localStorage.getItem(key)
          if (value && value.length > 500 && value.startsWith('{') && value.includes('"access_token"')) {
            // This looks like a session object stored as a string
            // Supabase should handle this, but if it's causing issues, we'll try to fix it
            try {
              const parsed = JSON.parse(value)
              // If it's a valid session object, Supabase should be able to use it
              // But if there are nested issues, we might need to clear it
              if (parsed && typeof parsed === 'object' && parsed.access_token) {
                // Valid session - leave it alone
                continue
              }
            } catch {
              // Invalid JSON - clear it
              console.error('[supabase/client] Removing invalid JSON session data:', key)
              localStorage.removeItem(key)
            }
          }
        } catch {
          // Ignore errors
        }
      }
    } catch {
      // Ignore errors during initialization cleanup
    }
  }, 100)
}

/**
 * Clean up corrupted session data from localStorage
 * This fixes issues where session data is stored as a string instead of an object
 */
function cleanupCorruptedSessionData() {
  if (typeof window === 'undefined') return
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return
    
    // Extract project ref
    let projectRef: string | null = null
    try {
      const url = new URL(supabaseUrl)
      const hostname = url.hostname
      const match = hostname.match(/^([^.]+)\.supabase\.co$/)
      projectRef = match ? match[1] : null
    } catch {
      // Ignore URL parsing errors
    }
    
    // Check all localStorage keys for Supabase session data
    const keysToCheck: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (
        key.startsWith('sb-') || 
        key.includes('supabase') || 
        key.includes('auth') ||
        (projectRef && key.includes(projectRef))
      )) {
        keysToCheck.push(key)
      }
    }
    
    // Check each key for corrupted data (string that looks like JSON but isn't parsed)
    for (const key of keysToCheck) {
      try {
        const value = localStorage.getItem(key)
        if (!value) continue
        
        // If the value is a very long string that looks like JSON (starts with { and contains access_token),
        // it might be corrupted session data that Supabase can't parse
        if (value.length > 100 && value.startsWith('{') && value.includes('access_token') && value.includes('"user":')) {
          // Try to parse it - if it's valid JSON, Supabase should handle it
          // But if it's causing issues, we'll clear it
          try {
            const parsed = JSON.parse(value)
            // If it parses but doesn't have the expected structure, clear it
            if (typeof parsed === 'string' || (typeof parsed === 'object' && !parsed.access_token)) {
              console.error('[supabase/client] Found corrupted session data, clearing:', key)
              localStorage.removeItem(key)
            }
          } catch {
            // If it doesn't parse as JSON, it's definitely corrupted
            console.error('[supabase/client] Found unparseable session data, clearing:', key)
            localStorage.removeItem(key)
          }
        }
      } catch {
        // Ignore errors when checking individual keys
      }
    }
  } catch (error) {
    console.error('[supabase/client] Error cleaning up corrupted session data:', error)
  }
}

/**
 * Validate and clean up invalid sessions
 * This should be called periodically to ensure session integrity
 */
export async function validateAndCleanSession() {
  if (typeof window === 'undefined') return { valid: false, user: null }
  
  // Clean up corrupted session data first
  cleanupCorruptedSessionData()
  
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
  } catch (error: any) {
    // Handle the specific error where Supabase tries to create property on string
    if (error?.message?.includes('Cannot create property') || error?.message?.includes('on string')) {
      console.error('[supabase/client] Corrupted session data detected, clearing all Supabase storage')
      cleanupCorruptedSessionData()
      // Clear all Supabase-related storage
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        let projectRef: string | null = null
        if (supabaseUrl) {
          try {
            const url = new URL(supabaseUrl)
            const hostname = url.hostname
            const match = hostname.match(/^([^.]+)\.supabase\.co$/)
            projectRef = match ? match[1] : null
          } catch {}
        }
        
        // Clear all Supabase keys
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (
            key.startsWith('sb-') || 
            key.includes('supabase') || 
            key.includes('auth') ||
            (projectRef && key.includes(projectRef))
          )) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key)
          } catch {}
        })
        
        // Also clear sessionStorage
        const sessionKeysToRemove: string[] = []
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key && (
            key.startsWith('sb-') || 
            key.includes('supabase') || 
            key.includes('auth') ||
            (projectRef && key.includes(projectRef))
          )) {
            sessionKeysToRemove.push(key)
          }
        }
        sessionKeysToRemove.forEach(key => {
          try {
            sessionStorage.removeItem(key)
          } catch {}
        })
      } catch {}
    }
    
    console.error('[supabase/client] Error validating session:', error)
    return { valid: false, user: null }
  }
}

