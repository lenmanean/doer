import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/check-username
 * Checks if a username is available
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

    // Validate username format
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: 'Username must be 3-20 characters', available: false },
        { status: 400 }
      )
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, underscores, and hyphens', available: false },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if username exists (case-insensitive)
    const { data, error } = await supabase
      .from('user_settings')
      .select('username')
      .ilike('username', username)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which means username is available
      console.error('Error checking username:', error)
      return NextResponse.json(
        { error: 'Failed to check username availability' },
        { status: 500 }
      )
    }

    // If data exists, username is taken
    const available = !data

    return NextResponse.json({ available })
  } catch (error) {
    console.error('Unexpected error in POST /api/auth/check-username:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}










