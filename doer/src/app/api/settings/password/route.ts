import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/password-security-server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/password
 * Updates the current user's password
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { current_password, new_password } = body

    // Validate input
    if (!new_password || typeof new_password !== 'string') {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordValidation = await validatePassword(new_password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.error || 'Password does not meet requirements' },
        { status: 400 }
      )
    }

    // Update password using Supabase Auth
    const { data, error } = await supabase.auth.updateUser({
      password: new_password
    })

    if (error) {
      console.error('Error updating password:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update password' },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Password updated successfully'
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/settings/password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}













































