import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { autoAssignBasicPlan } from '@/lib/stripe/auto-assign-basic'

/**
 * Helper function to get the production domain URL
 */
function getProductionUrl(path: string): string {
  const productionDomain = process.env.NEXT_PUBLIC_APP_URL 
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
    : 'usedoer.com'
  return `https://${productionDomain}${path}`
}

/**
 * Helper function to determine redirect URL based on current request
 * Always uses production domain in production to ensure consistent redirects
 */
function getRedirectUrl(request: NextRequest, path: string): string {
  const origin = new URL(request.url).origin
  const host = request.headers.get('host') || ''
  const forwardedHost = request.headers.get('x-forwarded-host') || ''
  const isLocalEnv = process.env.NODE_ENV === 'development'
  
  // In development, use the origin
  if (isLocalEnv) {
    return `${origin}${path}`
  }
  
  // In production, always use production domain
  // This ensures that even if the callback is hit on a preview domain,
  // we redirect to the production domain
  return getProductionUrl(path)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
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
            } else {
              // Profile created successfully - assign Basic plan (non-blocking)
              autoAssignBasicPlan(user.id).catch((error) => {
                console.error('[Auth Callback] Failed to assign Basic plan for new user:', error)
              })
            }
          } else {
            // No username but user exists - still assign Basic plan (non-blocking)
            autoAssignBasicPlan(user.id).catch((error) => {
              console.error('[Auth Callback] Failed to assign Basic plan for new user:', error)
            })
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
          // Check if account is scheduled for deletion
          const { data: userSettings } = await supabase
            .from('user_settings')
            .select('scheduled_deletion_at')
            .eq('user_id', user.id)
            .maybeSingle()

          if (userSettings?.scheduled_deletion_at) {
            const deletionDate = new Date(userSettings.scheduled_deletion_at)
            const now = new Date()
            
            // If deletion date is in the future, redirect to restore page
            if (deletionDate > now) {
              redirectPath = '/account/restore'
            } else {
              // If deletion date has passed, allow normal flow (cron should have deleted)
              redirectPath = '/dashboard'
            }
          } else {
            redirectPath = '/dashboard'
          }
        }

        // Assign Basic plan to new users (non-blocking)
        // This ensures all users have a subscription from the start
        // autoAssignBasicPlan will skip if user already has a subscription
        autoAssignBasicPlan(user.id).catch((error) => {
          // Log error but don't block redirect
          console.error('[Auth Callback] Failed to assign Basic plan:', error)
        })
      }
      
      // Use custom redirect path or the determined path
      const finalPath = next || redirectPath
      
      // Get the redirect URL (always production domain in production)
      const redirectUrl = getRedirectUrl(request, finalPath)
      
      // Redirect to the production domain (removes code parameter from URL)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Return the user to an error page with instructions
  const errorUrl = getRedirectUrl(request, '/auth/auth-code-error')
  return NextResponse.redirect(errorUrl)
}
