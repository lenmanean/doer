'use client'

import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, validateAndCleanSession } from '@/lib/supabase/client'
import { SIGN_OUT_EVENT } from '@/lib/auth/sign-out-client'

interface SupabaseContextType {
  supabase: typeof supabase
  user: User | null
  loading: boolean
  sessionReady: boolean
}

const SupabaseContext = createContext<SupabaseContextType | null>(null)

interface SupabaseProviderProps {
  children: React.ReactNode
  initialUser?: User | null
}

const isSessionMissingError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name?: string }).name === 'AuthSessionMissingError'

/**
 * Clear browser storage related to Supabase
 */
function clearStorageOnSignOut() {
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
        // Ignore
      }
    }
    
    // Clear localStorage
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth') || (projectRef && key.includes(projectRef)))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch {
        // Ignore
      }
    })
    
    // Clear sessionStorage
    const sessionKeysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth') || (projectRef && key.includes(projectRef)))) {
        sessionKeysToRemove.push(key)
      }
    }
    sessionKeysToRemove.forEach(key => {
      try {
        sessionStorage.removeItem(key)
      } catch {
        // Ignore
      }
    })
  } catch {
    // Ignore storage errors
  }
}

const pendingSync = new Map<string, AbortController>()

async function syncServerAuthSession(event: string, session: Session | null) {
  try {
    const key = 'session-sync'
    const previous = pendingSync.get(key)
    if (previous) {
      previous.abort()
    }
    const controller = new AbortController()
    pendingSync.set(key, controller)

    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, session }),
      signal: controller.signal,
      credentials: 'same-origin',
    })
    pendingSync.delete(key)
    return true
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      return false
    }
    console.error('[SupabaseProvider] Failed to sync auth session with server:', error)
    return false
  }
}

async function updateServerSession(event: string, session: Session | null, setSessionReady: (ready: boolean) => void) {
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !session) {
    setSessionReady(false)
  }
  const success = await syncServerAuthSession(event, session)
  if (success && session) {
    setSessionReady(true)
  }
}

export function SupabaseProvider({ children, initialUser }: SupabaseProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [loading, setLoading] = useState(initialUser === undefined || initialUser === null)
  const [sessionReady, setSessionReady] = useState(initialUser ? true : false)
  const isMountedRef = useRef(true)
  // loadingTimeoutRef removed - no longer using timeout bypass for security
  const sessionValidationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const extendedLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    let subscription: { unsubscribe: () => void } | null = null
    const handleImmediateSignOut = () => {
      setUser(null)
      setSessionReady(false)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(SIGN_OUT_EVENT, handleImmediateSignOut)
    }

    // Clean up corrupted session data on mount
    if (typeof window !== 'undefined') {
      try {
        // Call validateAndCleanSession which includes cleanup
        validateAndCleanSession().catch(() => {
          // Ignore errors during initial cleanup
        })
      } catch {
        // Ignore errors
      }
    }

    const resolveUser = async () => {
      // SECURITY FIX: Removed timeout bypass that forced loading=false after 10s
      // Authentication must resolve naturally to prevent pages rendering without auth
      
      try {
        const { data, error } = await supabase.auth.getUser()
        
        if (!isMountedRef.current) return

        if (error) {
          if (!isSessionMissingError(error)) {
            console.error('[SupabaseProvider] Error fetching user:', error)
          }
          setUser(null)
        } else {
          setUser(data.user ?? null)
        }
      } catch (error: any) {
        if (!isMountedRef.current) return
        
        // Handle corrupted session data error
        if (error?.message?.includes('Cannot create property') || error?.message?.includes('on string')) {
          console.error('[SupabaseProvider] Corrupted session data detected, clearing storage')
          clearStorageOnSignOut()
          setUser(null)
        } else if (!isSessionMissingError(error)) {
          console.error('[SupabaseProvider] Unexpected auth error:', error)
          setUser(null)
        } else {
          setUser(null)
        }
      } finally {
        // Only set loading=false when auth actually resolves
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }

    const init = async () => {
      if (initialUser === undefined || initialUser === null) {
        await resolveUser()
        if (!isMountedRef.current) return
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          await updateServerSession('SIGNED_IN', data.session, setSessionReady)
        } else {
          setSessionReady(false)
        }
      } else {
        try {
          const { valid, user: validatedUser } = await validateAndCleanSession()
          if (!isMountedRef.current) return
          if (!valid || !validatedUser) {
            setUser(null)
            await updateServerSession('SIGNED_OUT', null, setSessionReady)
          } else {
            if (validatedUser.id !== initialUser.id) {
              setUser(validatedUser)
            }
            const { data } = await supabase.auth.getSession()
            await updateServerSession('SIGNED_IN', data.session ?? null, setSessionReady)
          }
          setLoading(false)
        } catch {
          if (isMountedRef.current) {
            setLoading(false)
          }
        }
      }
    }

    init()

    // Set up auth state change listener
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMountedRef.current) return

      // Only log non-initial events to avoid console noise
      // INITIAL_SESSION is a normal event that occurs on app load
      if (event !== 'INITIAL_SESSION') {
        console.log('[SupabaseProvider] Auth state change:', event)
      }

      if (event === 'SIGNED_OUT' || (event as string) === 'USER_DELETED') {
        console.log('[SupabaseProvider] User signed out, clearing state and storage')
        setUser(null)
        setLoading(false)
        clearStorageOnSignOut()
        await updateServerSession(event, null, setSessionReady)
        return
      }

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        setUser(session.user)
        setLoading(false)
        await updateServerSession(event, session, setSessionReady)
        return
      }

      if (event === 'TOKEN_REFRESHED') {
        // Validate session after token refresh
        const { valid, user: validatedUser } = await validateAndCleanSession()
        if (!isMountedRef.current) return
        if (valid && validatedUser) {
          setUser(validatedUser)
          await updateServerSession(event, session ?? null, setSessionReady)
        } else {
          setUser(null)
          await updateServerSession('SIGNED_OUT', null, setSessionReady)
        }
        return
      }

      // For other events (SIGNED_IN, USER_UPDATED), verify user
      try {
        const { data, error } = await supabase.auth.getUser()
        if (!isMountedRef.current) return

        if (error) {
          if (!isSessionMissingError(error)) {
            console.error('[SupabaseProvider] Error verifying user after auth change:', error)
          }
          setUser(null)
        } else {
          setUser(data.user ?? null)
        }
      } catch (error: any) {
        if (!isMountedRef.current) return
        
        // Handle corrupted session data error
        if (error?.message?.includes('Cannot create property') || error?.message?.includes('on string')) {
          console.error('[SupabaseProvider] Corrupted session data detected during auth change, clearing storage')
          clearStorageOnSignOut()
          setUser(null)
        } else if (!isSessionMissingError(error)) {
          console.error('[SupabaseProvider] Unexpected auth change error:', error)
          setUser(null)
        } else {
          setUser(null)
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    })

    subscription = authSubscription

    // Periodic session validation (every 5 minutes)
    sessionValidationIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) return
      if (!user) return // Only validate if we have a user
      
      const { valid, user: validatedUser } = await validateAndCleanSession()
      if (!isMountedRef.current) return
      
      if (!valid) {
        // Periodic validation failed - clear user silently
        setUser(null)
        clearStorageOnSignOut()
      } else if (validatedUser && validatedUser.id !== user.id) {
        // User changed during validation - update silently
        setUser(validatedUser)
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => {
      isMountedRef.current = false
      if (typeof window !== 'undefined') {
        window.removeEventListener(SIGN_OUT_EVENT, handleImmediateSignOut)
      }
      // loadingTimeoutRef removed - no longer using timeout bypass
      if (sessionValidationIntervalRef.current) {
        clearInterval(sessionValidationIntervalRef.current)
      }
      if (extendedLoadingTimeoutRef.current) {
        clearTimeout(extendedLoadingTimeoutRef.current)
      }
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [initialUser]) // Only depend on initialUser to avoid infinite loops

  // Separate useEffect for extended timeout - monitors loading and user state
  // This prevents infinite loading but doesn't bypass authentication
  useEffect(() => {
    if (loading && !user) {
      // Clear any existing timeout
      if (extendedLoadingTimeoutRef.current) {
        clearTimeout(extendedLoadingTimeoutRef.current)
      }
      
      // Set up new timeout - check current state when timeout fires
      extendedLoadingTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          // Check current state at timeout, not captured closure values
          // We need to verify via a callback or current ref values
          // Since we can't access state directly in timeout, we'll check isMountedRef
          // and let the redirect happen if we're still mounted (user would have loaded by now if successful)
          console.error('[SupabaseProvider] Auth timeout after 30s - clearing state and redirecting to error page')
          
          if (typeof window !== 'undefined') {
            // Clear authentication state before redirecting
            // This ensures users can try signing in again
            try {
              // Clear browser storage
              clearStorageOnSignOut()
              
              // Clear server-side session
              fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'SIGNED_OUT', session: null }),
                credentials: 'same-origin',
              }).catch(() => {
                // Ignore errors - we're redirecting anyway
              })
              
              // Sign out from Supabase (non-blocking)
              supabase.auth.signOut().catch(() => {
                // Ignore errors - we're redirecting anyway
              })
            } catch (error) {
              console.error('[SupabaseProvider] Error clearing state on timeout:', error)
              // Continue with redirect even if cleanup fails
            }
            
            // Redirect to timeout error page (which will also clear state)
            window.location.href = '/auth/timeout-error'
          }
        }
      }, 30000) // 30 seconds
      
      return () => {
        if (extendedLoadingTimeoutRef.current) {
          clearTimeout(extendedLoadingTimeoutRef.current)
          extendedLoadingTimeoutRef.current = null
        }
      }
    } else {
      // Clear timeout if loading completes or user is found
      if (extendedLoadingTimeoutRef.current) {
        clearTimeout(extendedLoadingTimeoutRef.current)
        extendedLoadingTimeoutRef.current = null
      }
    }
  }, [loading, user])

  const contextValue: SupabaseContextType = {
    supabase,
    user,
    loading,
    sessionReady
  }

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}
