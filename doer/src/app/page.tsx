import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from './landing'

export default async function Home() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Check if user has a plan (completed onboarding)
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (!plan) {
      redirect('/onboarding')
    } else {
      redirect('/roadmap')
    }
  } else {
    // Show landing page for non-authenticated users
    return <LandingPage />
  }
}

