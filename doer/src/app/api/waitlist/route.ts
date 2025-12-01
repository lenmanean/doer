import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

/**
 * Email validation regex pattern
 * Matches standard email format
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/waitlist
 * Handles waitlist email signups
 * 
 * Body: { email: string, source?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, source } = body

    // Validate email is provided
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Normalize email (lowercase, trim whitespace)
    const normalizedEmail = email.trim().toLowerCase()

    // Validate email format
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Get IP address and user agent from request headers
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    
    const userAgent = request.headers.get('user-agent') || null

    // Create Supabase client
    const supabase = await createClient()

    // Check if email already exists
    const { data: existingEntry } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    // If email already exists, return success (don't reveal it exists)
    if (existingEntry) {
      return NextResponse.json({
        success: true,
        message: 'Thank you for joining our waitlist!',
      })
    }

    // Insert new waitlist entry
    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({
        email: normalizedEmail,
        source: source || null,
        ip_address: ipAddress,
        user_agent: userAgent,
      })

    if (insertError) {
      console.error('Error inserting waitlist entry:', insertError)
      // Check if it's a duplicate key error (race condition)
      if (insertError.code === '23505') {
        // Unique constraint violation - email already exists
        return NextResponse.json({
          success: true,
          message: 'Thank you for joining our waitlist!',
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to join waitlist. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for joining our waitlist!',
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/waitlist:', error)
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}

