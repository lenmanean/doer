import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

/**
 * GET /api/waitlist/retrieve-goal
 * Retrieves the goal associated with the authenticated user's email from the waitlist
 * 
 * Security: Only authenticated users can retrieve their own goal
 * Returns null if no goal is found or user doesn't exist in waitlist
 */
export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get user's email (normalized to lowercase for matching)
    const userEmail = user.email?.trim().toLowerCase()

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      )
    }

    // Query waitlist table for user's email
    const { data: waitlistEntry, error: waitlistError } = await supabase
      .from('waitlist')
      .select('goal')
      .eq('email', userEmail)
      .single()

    // If not found, return null (not an error - user might not have been on waitlist)
    if (waitlistError) {
      if (waitlistError.code === 'PGRST116') {
        // No rows returned - user not in waitlist
        return NextResponse.json({
          success: true,
          goal: null,
        })
      }

      // Other database error
      console.error('Error querying waitlist:', waitlistError)
      return NextResponse.json(
        { error: 'Failed to retrieve waitlist goal' },
        { status: 500 }
      )
    }

    // Return goal if found, null if goal field is null
    return NextResponse.json({
      success: true,
      goal: waitlistEntry?.goal || null,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/waitlist/retrieve-goal:', error)

    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}










