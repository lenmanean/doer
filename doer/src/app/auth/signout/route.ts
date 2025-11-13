import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    console.log('[auth/signout] Server-side sign out requested')
    
    const supabase = await createClient()

    // Attempt to sign out
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('[auth/signout] Supabase sign out failed:', error)
      // Still return success if the error is not critical (e.g., session already expired)
      // This prevents blocking the client-side sign out
      if (error.message?.includes('session') || error.message?.includes('invalid')) {
        console.warn('[auth/signout] Non-critical error (session may already be cleared), returning success')
        return NextResponse.json({ success: true, warning: error.message })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[auth/signout] Server-side sign out successful')
    
    // Create response with cleared cookies
    const response = NextResponse.json({ success: true })
    
    // Explicitly clear any auth-related cookies
    response.cookies.delete('sb-access-token')
    response.cookies.delete('sb-refresh-token')
    response.cookies.delete('supabase-auth-token')
    
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[auth/signout] Unexpected error:', error)
    // Return success even on unexpected errors to avoid blocking client-side sign out
    // The client-side sign out should have already cleared the session
    return NextResponse.json({ success: true, warning: message })
  }
}





