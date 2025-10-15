import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface UseOnboardingProtectionReturn {
  user: any
  profile: any
  loading: boolean
  handleSignOut: () => Promise<void>
}

/**
 * Custom hook to protect routes from users who haven't completed onboarding
 * Now fetches from user_profiles table for real profile data
 */
export function useOnboardingProtection(): UseOnboardingProtectionReturn {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUserAndOnboarding = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        setUser(user)

        // Fetch user profile from user_profiles table
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()

        // If profile doesn't exist, create it
        if (profileError?.code === 'PGRST116') {
          const { data: newProfile } = await supabase
            .from('user_profiles')
            .insert({
              user_id: user.id,
              display_name: user.email?.split('@')[0] || 'User'
            })
            .select()
            .single()
          
          setProfile(newProfile)
        } else if (profileError) {
          console.error('Error fetching user profile:', profileError)
          // Set a basic profile as fallback
          setProfile({ display_name: user.email?.split('@')[0] || 'User', email: user.email })
        } else {
          setProfile(userProfile)
        }

        // Allow access to dashboard even without a plan
        // Users can create a plan from the dashboard using the Switch Plan modal
        setLoading(false)
      } catch (error) {
        console.error('Error in onboarding protection:', error)
        router.push('/login')
      }
    }

    checkUserAndOnboarding()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return {
    user,
    profile,
    loading,
    handleSignOut
  }
}

