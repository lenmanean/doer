import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Get the user after successful authentication
      const { data: { user } } = await supabase.auth.getUser()
      
      let redirectPath = '/dashboard' // default
      
      if (user) {
        // Check if user has a plan (completed onboarding)
        const { data: plan } = await supabase
          .from('plans')
          .select('*')
          .eq('user_id', user.id)
          .single()
        
        if (!plan) {
          redirectPath = '/onboarding'
        } else {
          redirectPath = '/roadmap'
        }
      }
      
      // Use custom redirect path or the determined path
      const finalPath = next || redirectPath
      
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${finalPath}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${finalPath}`)
      } else {
        return NextResponse.redirect(`${origin}${finalPath}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
