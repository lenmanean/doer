import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/check-email
 * Checks if an email is already registered
 * 
 * Note: This endpoint is used during signup to provide better UX.
 * For security, we don't reveal whether an email exists during login attempts.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.trim().toLowerCase()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format', available: false },
        { status: 400 }
      )
    }

    const supabase = getServiceRoleClient()

    // Check if email exists in auth.users (case-insensitive)
    // Note: Supabase enforces email uniqueness at the database level, so this check
    // is primarily for UX. If this check misses a duplicate, Supabase will still
    // catch it during signup and return an error, which we handle in the signup form.
    const { data: users, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('Error checking email:', error)
      return NextResponse.json(
        { error: 'Failed to check email availability' },
        { status: 500 }
      )
    }

    // Check if any user has this email (case-insensitive)
    const emailExists = users?.users?.some(
      user => user.email?.toLowerCase() === normalizedEmail
    ) ?? false

    const available = !emailExists

    return NextResponse.json({ available })
  } catch (error) {
    console.error('Unexpected error in POST /api/auth/check-email:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

