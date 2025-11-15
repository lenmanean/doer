'use client'

import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, validateAndCleanSession } from '@/lib/supabase/client'

interface SupabaseContextType {
  supabase: typeof supabase
  user: User | null
  loading: boolean
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

export function SupabaseProvider({ children, initialUser }: SupabaseProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [loading, setLoading] = useState(initialUser === undefined || initialUser === null)
  const isMountedRef = useRef(true)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sessionValidationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    let subscription: { unsubscribe: () => void } | null = null

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
      // Add timeout protection - loading should never exceed 10 seconds
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      loadingTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && loading) {
          console.error('[SupabaseProvider] Loading timeout - forcing loading to false')
          setLoading(false)
        }
      }, 10000)

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
        if (isMountedRef.current) {
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current)
            loadingTimeoutRef.current = null
          }
          setLoading(false)
        }
      }
    }

    if (initialUser === undefined || initialUser === null) {
      resolveUser()
    } else {
      // Validate initial user if provided
      validateAndCleanSession().then(({ valid, user: validatedUser }) => {
        if (!isMountedRef.current) return
        if (!valid || !validatedUser) {
          // Initial user invalid - this is expected for new sessions
          setUser(null)
        } else if (validatedUser.id !== initialUser.id) {
          // User mismatch - update to validated user
          setUser(validatedUser)
        }
        setLoading(false)
      }).catch(() => {
        if (isMountedRef.current) {
          setLoading(false)
        }
      })
    }

    // Set up auth state change listener
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event) => {
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
        return
      }

      if (event === 'TOKEN_REFRESHED') {
        // Validate session after token refresh
        const { valid, user: validatedUser } = await validateAndCleanSession()
        if (!isMountedRef.current) return
        if (valid && validatedUser) {
          setUser(validatedUser)
        } else {
          setUser(null)
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
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      if (sessionValidationIntervalRef.current) {
        clearInterval(sessionValidationIntervalRef.current)
      }
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [initialUser]) // Only depend on initialUser to avoid infinite loops

  const contextValue: SupabaseContextType = {
    supabase,
    user,
    loading
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
