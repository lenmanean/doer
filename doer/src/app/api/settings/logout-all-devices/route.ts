import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/settings/logout-all-devices
 * Signs out the user from all devices and sessions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sign out from all devices using global scope
    // This invalidates all refresh tokens for the user
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })

    if (signOutError) {
      console.error('Error signing out all devices:', signOutError)
      // Try to sign out current session as fallback
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Failed to sign out all devices, but current session was signed out' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'You have been logged out of all devices.'
    })
  } catch (error) {
    console.error('Error logging out all devices:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

