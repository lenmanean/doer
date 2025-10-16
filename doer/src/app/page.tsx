import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from './landing'

export default async function Home() {
  const supabase = await createClient()
  
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    // If there's an error or no user, show landing page
    if (error || !user) {
      console.log('No authenticated user, showing landing page')
      return <LandingPage />
    }

    // Check if user has a plan (completed onboarding)
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (planError && planError.code !== 'PGRST116') {
      // If there's an actual error (not just no plan found), show landing page
      console.log('Error checking plan, showing landing page:', planError)
      return <LandingPage />
    }
    
    if (!plan) {
      redirect('/onboarding')
    } else {
      redirect('/roadmap')
    }
  } catch (error) {
    console.log('Error in home page auth check, showing landing page:', error)
    // If there's any error, show landing page
    return <LandingPage />
  }
}

