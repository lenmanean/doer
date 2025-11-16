import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/supabase-provider'

interface UseOnboardingCompletionProtectionReturn {
  user: any
  profile: any
  loading: boolean
}

/**
 * Custom hook to protect onboarding pages from unauthenticated users
 * Note: With multiple plans support, users can access onboarding even with existing plans
 */
export function useOnboardingCompletionProtection(): UseOnboardingCompletionProtectionReturn {
  const { user, supabase, loading: authLoading, sessionReady } = useSupabase()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Wait for provider to resolve auth state
    if (authLoading || !sessionReady) return
    if (!user) {
      router.push('/login')
      return
    }

    const checkUserAndOnboarding = async () => {
      try {
        // Fetch user profile (optional - for display purposes)
        // Note: We no longer redirect users with existing plans since they can create multiple plans
        const { data: plan, error } = await supabase
          .from('plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single()

        if (error?.code === 'PGRST301' || (error as any)?.status === 403) {
          console.warn('User not authorized for plan fetch - likely RLS misconfig or missing session.')
          setLoading(false)
          return
        }

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user plan:', error)
          // If there's an actual error (not just no plan found), allow access to onboarding
          setLoading(false)
          return
        }

        // Set profile but don't redirect - users can create multiple plans
        setProfile(plan)

        setLoading(false)
      } catch (error) {
        console.error('Error in onboarding completion protection:', error)
        router.push('/login')
      }
    }

    checkUserAndOnboarding()
  }, [router, supabase, user, authLoading, sessionReady])

  return {
    user,
    profile,
    loading
  }
}
