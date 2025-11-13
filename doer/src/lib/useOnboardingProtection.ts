import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { signOutClient } from '@/lib/auth/sign-out-client'
import { useSupabase } from '@/components/providers/supabase-provider'

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
 * Best Practices Implementation:
 * - Trusts SupabaseProvider user state as source of truth
 * - Only performs async checks when provider has no user AND has finished loading
 * - Uses proper error handling without aggressive timeouts
 * - Handles component remounts gracefully
 * - Prevents redundant session checks
 */
export function useOnboardingProtection(): UseOnboardingProtectionReturn {
  const router = useRouter()
  const supabaseContext = useSupabase()
  const providerUser = supabaseContext?.user || null
  const providerLoading = supabaseContext?.loading ?? true
  
  // Initialize state with provider user if available
  const [user, setUser] = useState<any>(providerUser)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Refs for tracking initialization state
  const isMountedRef = useRef(true)
  const hasInitializedRef = useRef(false)
  const isInitializingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const profileFetchRef = useRef<Promise<any> | null>(null)
  
  // Safe state setters
  const safeSetLoading = useCallback((value: boolean) => {
    if (isMountedRef.current) {
      setLoading(value)
    }
  }, [])
  
  const safeSetUser = useCallback((value: any) => {
    if (isMountedRef.current) {
      setUser(value)
    }
  }, [])
  
  const safeSetProfile = useCallback((value: any) => {
    if (isMountedRef.current) {
      setProfile(value)
    }
  }, [])
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])
  
  // Sync with provider user state changes
  useEffect(() => {
    if (providerUser && providerUser !== user) {
      console.log('[useOnboardingProtection] Provider user updated, syncing')
      safeSetUser(providerUser)
      // If we have user but no profile, trigger profile fetch
      if (!profile) {
        hasInitializedRef.current = false
      }
    } else if (!providerUser && user && !providerLoading) {
      // Provider lost user and finished loading - this is a real logout
      console.log('[useOnboardingProtection] Provider user cleared (logout)')
      safeSetUser(null)
      safeSetProfile(null)
      hasInitializedRef.current = false
    }
  }, [providerUser, user, profile, providerLoading, safeSetUser, safeSetProfile])
  
  // Main initialization effect
  useEffect(() => {
    isMountedRef.current = true
    
    // If we already have user and profile, we're done
    if (user && profile && hasInitializedRef.current) {
      console.log('[useOnboardingProtection] Already initialized with user and profile')
      safeSetLoading(false)
      return
    }
    
    // If provider is still loading, wait for it (but with a safety timeout)
    if (providerLoading) {
      console.log('[useOnboardingProtection] Provider still loading, waiting...')
      
      // If we already have a user from state, we can proceed
      if (user) {
        // We have a user, just need profile
        if (profile) {
          hasInitializedRef.current = true
          isInitializingRef.current = false
          safeSetLoading(false)
          return
        }
        // User exists but no profile - will be handled when provider finishes
        return
      }
      
      // Safety: if provider is loading for more than 3 seconds, check session directly
      // This prevents infinite loading if provider gets stuck
      if (isInitializingRef.current) {
        return // Already checking session
      }
      
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && providerLoading && !user) {
          console.warn('[useOnboardingProtection] Provider loading timeout, checking session directly')
          // Check session directly instead of waiting
          isInitializingRef.current = true
          const abortController = new AbortController()
          abortControllerRef.current = abortController
          
          const checkSessionDirectly = async () => {
            try {
              const { data: { user: authenticatedUser }, error } = await supabase.auth.getUser()

              if (abortController.signal.aborted || !isMountedRef.current) {
                return
              }
              
              if (authenticatedUser) {
                safeSetUser(authenticatedUser)
                safeSetProfile({
                  display_name: authenticatedUser.email?.split('@')[0] || 'User',
                  email: authenticatedUser.email
                })
                hasInitializedRef.current = true
                isInitializingRef.current = false
                safeSetLoading(false)
              } else {
                // No session - redirect to login
                hasInitializedRef.current = true
                isInitializingRef.current = false
                safeSetLoading(false)
                router.push('/login')
              }
            } catch (error) {
              if (!abortController.signal.aborted && isMountedRef.current) {
                console.error('[useOnboardingProtection] Error checking session directly:', error)
                hasInitializedRef.current = true
                isInitializingRef.current = false
                safeSetLoading(false)
                router.push('/login')
              }
            }
          }
          
          checkSessionDirectly()
        }
      }, 3000)
      
      return () => clearTimeout(timeoutId)
    }
    
    // Provider has finished loading - make decision
    // PRIORITY 1: Use provider user if available (most reliable)
    if (providerUser) {
      console.log('[useOnboardingProtection] Provider has user, using it')
      
      // Update user state if needed
      if (!user || user.id !== providerUser.id) {
        safeSetUser(providerUser)
      }
      
      // If we have user but no profile, fetch profile
      if (!profile) {
        // Prevent duplicate profile fetches
        if (isInitializingRef.current) {
          return
        }
        
        isInitializingRef.current = true
        const abortController = new AbortController()
        abortControllerRef.current = abortController
        
        // Fetch profile with timeout safety
        const fetchProfile = async () => {
          let timeoutId: NodeJS.Timeout | null = null
          let timedOut = false
          
          try {
            console.log('[useOnboardingProtection] Fetching user profile...')
            
            // Set up timeout that will use fallback if query takes too long (increased to 20 seconds)
            const timeoutPromise = new Promise<void>((resolve) => {
              timeoutId = setTimeout(() => {
                timedOut = true
                resolve()
              }, 20000)
            })
            
            // Fetch profile
            const profilePromise = supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', providerUser.id)
              .single()
            
            // Race between timeout and actual query
            const result = await Promise.race([
              profilePromise.then((result) => ({ result, timedOut: false })),
              timeoutPromise.then(() => ({ result: null, timedOut: true }))
            ])
            
            // Clear timeout if query completed first
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
            
            if (abortController.signal.aborted || !isMountedRef.current) {
              return
            }
            
            // If timed out, use fallback
            if (result.timedOut && timedOut) {
              console.warn('[useOnboardingProtection] Profile fetch timed out after 20s, using fallback')
              safeSetProfile({
                display_name: providerUser.email?.split('@')[0] || 'User',
                email: providerUser.email
              })
              hasInitializedRef.current = true
              isInitializingRef.current = false
              safeSetLoading(false)
              return
            }
            
            const { data: userProfile, error: profileError } = result.result as any
            
            if (profileError?.code === 'PGRST116') {
              // Profile doesn't exist - create it
              console.log('[useOnboardingProtection] Profile not found, creating...')
              const { data: newProfile, error: createError } = await supabase
                .from('user_settings')
                .insert({
                  user_id: providerUser.id,
                  display_name: providerUser.email?.split('@')[0] || 'User'
                })
                .select()
                .single()
              
              if (abortController.signal.aborted || !isMountedRef.current) {
                return
              }
              
              if (createError) {
                console.error('[useOnboardingProtection] Error creating profile:', createError)
                // Use fallback profile
                safeSetProfile({
                  display_name: providerUser.email?.split('@')[0] || 'User',
                  email: providerUser.email
                })
              } else if (newProfile) {
                safeSetProfile(newProfile)
              }
            } else if (profileError) {
              console.error('[useOnboardingProtection] Error fetching profile:', profileError)
              // Use fallback profile
              safeSetProfile({
                display_name: providerUser.email?.split('@')[0] || 'User',
                email: providerUser.email
              })
            } else if (userProfile) {
              safeSetProfile(userProfile)
            }
            
            hasInitializedRef.current = true
            isInitializingRef.current = false
            safeSetLoading(false)
          } catch (error: any) {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
            if (!abortController.signal.aborted && isMountedRef.current) {
              console.error('[useOnboardingProtection] Error in profile fetch:', error)
              // Use fallback profile - always set loading to false
              safeSetProfile({
                display_name: providerUser.email?.split('@')[0] || 'User',
                email: providerUser.email
              })
              hasInitializedRef.current = true
              isInitializingRef.current = false
              safeSetLoading(false)
            }
          }
        }
        
        fetchProfile()
      } else {
        // We have both user and profile
        hasInitializedRef.current = true
        isInitializingRef.current = false
        safeSetLoading(false)
      }
      
      return
    }
    
    // PRIORITY 2: Provider has no user and has finished loading
    // Only now do we check session (if provider says no user)
    if (!providerUser && !providerLoading) {
      // Check if we've already initialized (prevents remount redirects)
      if (hasInitializedRef.current) {
        console.log('[useOnboardingProtection] Already initialized, skipping redirect (remount)')
        safeSetLoading(false)
        return
      }
      
      // Prevent duplicate initializations
      if (isInitializingRef.current) {
        return
      }
      
      isInitializingRef.current = true
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      
      // Try to get session - no aggressive timeout, let it complete naturally
      const checkSession = async () => {
        try {
          console.log('[useOnboardingProtection] Provider has no user, verifying auth state...')
          
          // Check provider user one more time before async call
          if (supabaseContext?.user) {
            console.log('[useOnboardingProtection] Provider user appeared, using it')
            safeSetUser(supabaseContext.user)
            hasInitializedRef.current = true
            isInitializingRef.current = false
            safeSetLoading(false)
            return
          }
          
          // Verify auth state - prefer verified user result
          const { data: { user: authenticatedUser }, error } = await supabase.auth.getUser()
          
          if (abortController.signal.aborted || !isMountedRef.current) {
            return
          }
          
          // Check provider user again after session call
          if (supabaseContext?.user) {
            console.log('[useOnboardingProtection] Provider user appeared during session check')
            safeSetUser(supabaseContext.user)
            hasInitializedRef.current = true
            isInitializingRef.current = false
            safeSetLoading(false)
            return
          }
          
          if (error) {
            console.warn('[useOnboardingProtection] Session check error:', error)
            // Check provider one more time
            if (supabaseContext?.user) {
              safeSetUser(supabaseContext.user)
              hasInitializedRef.current = true
              isInitializingRef.current = false
              safeSetLoading(false)
              return
            }
            
            // No user found - redirect to login
            hasInitializedRef.current = true
            isInitializingRef.current = false
            safeSetLoading(false)
            router.push('/login')
            return
          }
          
          if (authenticatedUser) {
            console.log('[useOnboardingProtection] Found verified user from Supabase')
            safeSetUser(authenticatedUser)
            // Fetch profile in background
            const { data: userProfile } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', authenticatedUser.id)
              .single()
            
            if (abortController.signal.aborted || !isMountedRef.current) {
              return
            }
            
            if (userProfile) {
              safeSetProfile(userProfile)
            } else {
              safeSetProfile({
                display_name: authenticatedUser.email?.split('@')[0] || 'User',
                email: authenticatedUser.email
              })
            }
            
            hasInitializedRef.current = true
            isInitializingRef.current = false
            safeSetLoading(false)
          } else {
            // No authenticated user found - redirect to login
            console.warn('[useOnboardingProtection] No verified user found, redirecting to login')
            hasInitializedRef.current = true
            isInitializingRef.current = false
            safeSetLoading(false)
            router.push('/login')
          }
        } catch (error) {
          if (!abortController.signal.aborted && isMountedRef.current) {
            console.error('[useOnboardingProtection] Error in session check:', error)
            
            // Final check of provider user
            if (supabaseContext?.user) {
              safeSetUser(supabaseContext.user)
              hasInitializedRef.current = true
              isInitializingRef.current = false
              safeSetLoading(false)
              return
            }
            
            // If we've already initialized, don't redirect (remount scenario)
            if (hasInitializedRef.current) {
              safeSetLoading(false)
              return
            }
            
            hasInitializedRef.current = true
            isInitializingRef.current = false
            safeSetLoading(false)
            router.push('/login')
          }
        }
      }
      
      checkSession()
    }
    
    // Cleanup function
    return () => {
      console.log('[useOnboardingProtection] Cleanup: component unmounting')
      isMountedRef.current = false
      cleanup()
      isInitializingRef.current = false
    }
  }, [providerUser, providerLoading, user, profile, router, safeSetUser, safeSetProfile, safeSetLoading, cleanup])
  
  const handleSignOut = useCallback(async () => {
    try {
      // Use supabase client from provider context (most reliable)
      const supabaseClient = supabaseContext?.supabase || supabase
      
      console.log('[useOnboardingProtection] Starting sign out...')
      
      // Clear local state first to provide immediate feedback
      safeSetUser(null)
      safeSetProfile(null)
      
      // Sign out using the client
      await signOutClient(supabaseClient)
      
      console.log('[useOnboardingProtection] Sign out successful, redirecting...')
      
      // Force a hard reload to clear any cached auth state
      // Using window.location.href ensures a full page reload and clears all state
      window.location.href = '/'
    } catch (error) {
      console.error('[useOnboardingProtection] Error signing out:', error)
      // Even if sign out fails, try to clear local state and redirect
      safeSetUser(null)
      safeSetProfile(null)
      // Force a hard reload even on error to ensure clean state
      window.location.href = '/'
    }
  }, [router, supabaseContext, supabase, safeSetUser, safeSetProfile])

  return {
    user,
    profile,
    loading,
    handleSignOut
  }
}
