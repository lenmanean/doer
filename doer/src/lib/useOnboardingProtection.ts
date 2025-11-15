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
  const supabase = supabaseContext?.supabase
  const [resolvedUser, setResolvedUser] = useState<any>(providerUser)
  const [authCheckInProgress, setAuthCheckInProgress] = useState(false)
  
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

  // Keep resolved user in sync with provider user
  useEffect(() => {
    setResolvedUser(providerUser || null)
  }, [providerUser?.id, providerUser])

  // When provider reports no user but we're authenticated locally (fresh login),
  // attempt to resolve the user directly from Supabase once before redirecting.
  useEffect(() => {
    if (!supabase) return
    if (providerLoading) return
    if (providerUser) return
    if (authCheckInProgress) return

    let isMounted = true
    setAuthCheckInProgress(true)

    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (!isMounted) return
        if (!providerUser && data?.user && !error) {
          setResolvedUser(data.user)
        }
      })
      .catch((error) => {
        if (error && !error.message?.includes('session')) {
          console.error('[useOnboardingProtection] Fallback user lookup failed:', error)
        }
      })
      .finally(() => {
        if (isMounted) {
          setAuthCheckInProgress(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [supabase, providerLoading, providerUser, authCheckInProgress])

  const effectiveUser = resolvedUser

  // Fetch profile when user is available
  useEffect(() => {
    if (!supabase) return
    
    // If provider is still loading, wait (but with timeout)
    if (providerLoading) {
      // Set loading timeout - never wait more than 10 seconds
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

    // Provider finished loading
    if (!effectiveUser) {
      if (authCheckInProgress) {
        console.warn('[useOnboardingProtection] Awaiting auth resolution before redirecting')
        return
      }
      // No user - redirect to login
      console.error('[useOnboardingProtection] No user found, redirecting to login')
      setLoading(false)
      setProfile(null)
      router.push('/login')
      return
    }

    // Prevent concurrent fetches or re-fetching for the same user
    if (isFetchingRef.current) {
      return
    }

    // If we've already fetched for this user, don't fetch again
    if (fetchedUserIdRef.current === effectiveUser.id) {
      // Profile might still be loading, but we've already initiated the fetch
      if (profile) {
        setLoading(false)
      }
      return
    }

    // Fetch profile with timeout protection
    const fetchProfile = async () => {
      if (!supabase || !effectiveUser || isFetchingRef.current) return
      
      isFetchingRef.current = true
      fetchedUserIdRef.current = effectiveUser.id
      hasFetchedProfileRef.current = true
      
      // Set timeout for profile fetch (10 seconds max)
      if (profileFetchTimeoutRef.current) {
        clearTimeout(profileFetchTimeoutRef.current)
      }
      
      const timeoutPromise = new Promise<void>((resolve) => {
        profileFetchTimeoutRef.current = setTimeout(() => {
          resolve()
        }, 10000)
      })

      try {
        console.error('[useOnboardingProtection] Fetching user profile for user:', effectiveUser.id)
        
        const profilePromise = supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', effectiveUser.id)
          .single()

        const result = await Promise.race([
          profilePromise.then((result) => ({ result, timedOut: false })),
          timeoutPromise.then(() => ({ result: null, timedOut: true }))
        ])

        if (!isMountedRef.current) return

        if (result.timedOut) {
          console.error('[useOnboardingProtection] Profile fetch timed out, using fallback')
          setProfile({
            first_name: effectiveUser.email?.split('@')[0] || 'User',
            email: effectiveUser.email
          })
          setLoading(false)
          return
        }

        const { data: userProfile, error: profileError } = result.result as any

        if (profileError?.code === 'PGRST116') {
          // Profile doesn't exist - create it
          console.error('[useOnboardingProtection] Profile not found, creating...')
          try {
            const { data: newProfile, error: createError } = await supabase
              .from('user_settings')
              .insert({
                user_id: effectiveUser.id,
                first_name: effectiveUser.email?.split('@')[0] || 'User'
              })
              .select()
              .single()

            if (!isMountedRef.current) return

            if (createError) {
              console.error('[useOnboardingProtection] Error creating profile:', createError)
              setProfile({
                first_name: effectiveUser.email?.split('@')[0] || 'User',
                email: effectiveUser.email
              })
            } else if (newProfile) {
              setProfile(newProfile)
            }
          } catch (createErr) {
            console.error('[useOnboardingProtection] Error in profile creation:', createErr)
            setProfile({
              first_name: effectiveUser.email?.split('@')[0] || 'User',
              email: effectiveUser.email
            })
          }
        } else if (profileError) {
          console.error('[useOnboardingProtection] Error fetching profile:', profileError)
          setProfile({
            first_name: effectiveUser.email?.split('@')[0] || 'User',
            email: effectiveUser.email
          })
        } else if (userProfile) {
          console.error('[useOnboardingProtection] Profile fetched successfully')
          setProfile(userProfile)
        } else {
          setProfile({
            first_name: providerUser.email?.split('@')[0] || 'User',
            email: providerUser.email
          })
        }
      } catch (error) {
        console.error('[useOnboardingProtection] Unexpected error fetching profile:', error)
        if (isMountedRef.current) {
          setProfile({
            first_name: providerUser.email?.split('@')[0] || 'User',
            email: providerUser.email
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
  }, [providerUser, providerLoading, router, supabase]) // Removed profile from deps to prevent infinite loop

  // Reset profile when user changes
  useEffect(() => {
    if (!providerUser) {
      setProfile(null)
      hasFetchedProfileRef.current = false
      fetchedUserIdRef.current = null
      isFetchingRef.current = false
    } else if (fetchedUserIdRef.current && fetchedUserIdRef.current !== providerUser.id) {
      // User changed - reset profile and fetch state
      setProfile(null)
      hasFetchedProfileRef.current = false
      fetchedUserIdRef.current = null
      isFetchingRef.current = false
    }
  }, [providerUser]) // Removed profile from deps to prevent infinite loop

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  return {
    user: providerUser, // Always use provider user as source of truth
    profile,
    loading: providerLoading || loading, // Loading if provider is loading OR we're fetching profile
    handleSignOut
  }
}
