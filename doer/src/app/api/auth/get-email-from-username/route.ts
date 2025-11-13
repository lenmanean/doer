import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/get-email-from-username
 * Gets the email associated with a username for login purposes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Look up username (case-insensitive) and get the associated user_id
    const { data, error } = await supabase
      .from('user_settings')
      .select('user_id')
      .ilike('username', username)
      .single()

    if (error || !data) {
      // Don't reveal whether username exists for security
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Get the user's email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(data.user_id)

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    return NextResponse.json({ email: userData.user.email })
  } catch (error) {
    console.error('Unexpected error in POST /api/auth/get-email-from-username:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}






