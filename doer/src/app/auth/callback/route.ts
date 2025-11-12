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
        // Get username from user metadata
        const username = user.user_metadata?.username
        
        // Check if user has completed profile setup
        const { data: profile } = await supabase
          .from('user_settings')
          .select('username, first_name')
          .eq('user_id', user.id)
          .single()

        // If no profile exists or username not set, store username and redirect to profile setup
        if (!profile) {
          // Create profile with username
          if (username) {
            const { error: insertError } = await supabase
              .from('user_settings')
              .insert({
                user_id: user.id,
                username: username,
                timezone: 'UTC',
                locale: 'en-US'
              })
            
            // Check for unique constraint violation
            if (insertError) {
              console.error('Username insert error:', insertError)
              // Username already taken - clear from metadata and let user choose new one
              if (insertError.code === '23505') { // Unique violation
                await supabase.auth.updateUser({
                  data: { username: null }
                })
              }
            }
          }
          redirectPath = '/auth/profile-setup'
        } else if (!profile.username && username) {
          // Update existing profile with username
          const { error: updateError } = await supabase
            .from('user_settings')
            .update({ username: username })
            .eq('user_id', user.id)
          
          // Check for unique constraint violation
          if (updateError) {
            console.error('Username update error:', updateError)
            // Username already taken - clear from metadata and let user choose new one
            if (updateError.code === '23505') { // Unique violation
              await supabase.auth.updateUser({
                data: { username: null }
              })
            }
          }
          redirectPath = '/auth/profile-setup'
        } else if (!profile.first_name) {
          // Username exists but profile incomplete
          redirectPath = '/auth/profile-setup'
        } else {
          redirectPath = '/dashboard'
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
