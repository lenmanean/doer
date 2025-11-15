import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/supabase-provider'
import { signOutClient } from '@/lib/auth/sign-out-client'

interface UseOnboardingProtectionReturn {
  user: any
  profile: any
  loading: boolean
  handleSignOut: () => Promise<void>
}

/**
 * Custom hook to protect routes from users who haven't completed onboarding
 * Fetches from user_settings table for real profile data
 * 
 * Simplified Implementation:
 * - Relies entirely on SupabaseProvider as single source of truth for auth state
 * - Only fetches profile data (not auth state)
 * - Has timeout protection to prevent infinite loading
 * - Handles component remounts gracefully
 */
export function useOnboardingProtection(): UseOnboardingProtectionReturn {
  const router = useRouter()
  const supabaseContext = useSupabase()
  const providerUser = supabaseContext?.user || null
  const providerLoading = supabaseContext?.loading ?? true
  const sessionReady = supabaseContext?.sessionReady ?? false
  const supabase = supabaseContext?.supabase
  const [resolvedUser, setResolvedUser] = useState<any>(providerUser)
  const [authResolutionState, setAuthResolutionState] = useState<'pending' | 'checking' | 'resolved'>(
    providerUser ? 'resolved' : 'pending'
  )
  
  // Only manage profile state - user comes from provider
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Refs for tracking state
  const isMountedRef = useRef(true)
  const hasFetchedProfileRef = useRef(false)
  const fetchedUserIdRef = useRef<string | null>(null) // Track which user ID we've fetched for
  const profileFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFetchingRef = useRef(false) // Prevent concurrent fetches

  // Cleanup function
  const cleanup = useCallback(() => {
    if (profileFetchTimeoutRef.current) {
      clearTimeout(profileFetchTimeoutRef.current)
      profileFetchTimeoutRef.current = null
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }, [])

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    if (!supabase) {
      console.error('[useOnboardingProtection] No supabase client available for sign out')
      window.location.href = '/'
      return
    }
    
    try {
      console.error('[useOnboardingProtection] Starting sign out...')
      setProfile(null)
      await signOutClient(supabase)
      console.error('[useOnboardingProtection] Sign out successful, redirecting...')
      window.location.href = '/'
    } catch (error) {
      console.error('[useOnboardingProtection] Error signing out:', error)
      setProfile(null)
      window.location.href = '/'
    }
  }, [supabase])

  // Sync resolved user whenever provider user changes
  useEffect(() => {
    if (providerUser) {
      setResolvedUser(providerUser)
      setAuthResolutionState('resolved')
    } else {
      setResolvedUser(null)
      setAuthResolutionState((state) => (state === 'checking' ? state : 'pending'))
    }
  }, [providerUser?.id, providerUser])

  // When provider hasn't supplied a user yet, attempt a one-time fallback lookup
  useEffect(() => {
    if (!supabase) return
    if (providerLoading) return
    if (!sessionReady) return
    if (resolvedUser) return
    if (authResolutionState !== 'pending') return

    let cancelled = false
    setAuthResolutionState('checking')
    console.warn('[useOnboardingProtection] Provider user missing, running fallback auth check')

    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (cancelled) return
        if (data?.user && !error) {
          console.warn('[useOnboardingProtection] Fallback auth resolved user:', data.user.id)
          setResolvedUser(data.user)
        } else {
          console.warn('[useOnboardingProtection] Fallback auth returned no user')
        }
      })
      .catch((error) => {
        if (!cancelled && error && !error.message?.includes('session')) {
          console.error('[useOnboardingProtection] Fallback auth lookup failed:', error)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthResolutionState('resolved')
        }
      })

    return () => {
      cancelled = true
    }
  }, [supabase, providerLoading, resolvedUser, authResolutionState, sessionReady])

  // Redirect if, after all resolutions, no user is present
  useEffect(() => {
    if (providerLoading) return
    if (!sessionReady) return
    if (authResolutionState !== 'resolved') return
    if (resolvedUser) return

    console.error('[useOnboardingProtection] No authenticated user after resolution, redirecting to login')
    setProfile(null)
    setLoading(false)
    router.push('/login')
  }, [authResolutionState, providerLoading, resolvedUser, router, sessionReady])

  const effectiveUser = resolvedUser
  const fallbackUser = effectiveUser || providerUser

  // Fetch profile when user is available
  useEffect(() => {
    if (!sessionReady) {
      console.warn('[useOnboardingProtection] Waiting for session sync before profile fetch')
      return
    }
    if (!effectiveUser) return

    // If provider is still loading, wait (but with timeout)
    if (providerLoading) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      loadingTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && providerLoading) {
          console.error('[useOnboardingProtection] Provider loading timeout, forcing loading to false')
          setLoading(false)
        }
      }, 10000)
      return
    }

    if (isFetchingRef.current) {
      return
    }

    if (fetchedUserIdRef.current === effectiveUser.id) {
      if (profile) {
        setLoading(false)
      }
      return
    }

    const fetchProfile = async () => {
      if (!effectiveUser || isFetchingRef.current) return

      isFetchingRef.current = true
      fetchedUserIdRef.current = effectiveUser.id
      hasFetchedProfileRef.current = true

      if (profileFetchTimeoutRef.current) {
        clearTimeout(profileFetchTimeoutRef.current)
      }

      const controller = new AbortController()
      profileFetchTimeoutRef.current = setTimeout(() => {
        controller.abort()
      }, 10000)

      try {
        console.error('[useOnboardingProtection] Fetching user profile via /api/profile for user:', effectiveUser.id)
        
        const response = await fetch('/api/profile', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal
        })

        if (!isMountedRef.current) return

        if (!response.ok) {
          console.error('[useOnboardingProtection] /api/profile returned error', response.status)
          setProfile({
            first_name: fallbackUser?.email?.split('@')[0] || 'User',
            email: fallbackUser?.email || undefined
          })
        } else {
          const data = await response.json()
          if (data?.profile) {
            console.error('[useOnboardingProtection] Profile fetched successfully via API')
            setProfile(data.profile)
          } else {
            setProfile({
              first_name: fallbackUser?.email?.split('@')[0] || 'User',
              email: fallbackUser?.email || undefined
            })
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.error('[useOnboardingProtection] Profile fetch timed out via API, using fallback')
        } else {
          console.error('[useOnboardingProtection] Unexpected error fetching profile via API:', error)
        }
        if (isMountedRef.current) {
          setProfile({
            first_name: fallbackUser?.email?.split('@')[0] || 'User',
            email: fallbackUser?.email || undefined
          })
        }
      } finally {
        isFetchingRef.current = false
        if (isMountedRef.current) {
          if (profileFetchTimeoutRef.current) {
            clearTimeout(profileFetchTimeoutRef.current)
            profileFetchTimeoutRef.current = null
          }
          setLoading(false)
        }
      }
    }

    fetchProfile()
  }, [effectiveUser?.id, providerLoading, router, fallbackUser?.email, sessionReady])

  // Reset profile when user changes
  useEffect(() => {
    if (!effectiveUser) {
      setProfile(null)
      hasFetchedProfileRef.current = false
      fetchedUserIdRef.current = null
      isFetchingRef.current = false
    } else if (fetchedUserIdRef.current && fetchedUserIdRef.current !== effectiveUser.id) {
      // User changed - reset profile and fetch state
      setProfile(null)
      hasFetchedProfileRef.current = false
      fetchedUserIdRef.current = null
      isFetchingRef.current = false
    }
  }, [effectiveUser?.id]) // Removed profile from deps to prevent infinite loop

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  return {
    user: effectiveUser, // Use resolved user as source of truth
    profile,
    loading: providerLoading || loading, // Loading if provider is loading OR we're fetching profile
    handleSignOut
  }
}
