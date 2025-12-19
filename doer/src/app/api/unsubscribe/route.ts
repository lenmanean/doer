import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Email validation regex pattern
 * Matches standard email format
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * GET /api/unsubscribe?email=...
 * POST /api/unsubscribe { email: ... }
 * 
 * Handles unsubscribe requests from waitlist emails
 * Sets unsubscribed_at timestamp to prevent future emails
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json(
      { error: 'Email parameter is required' },
      { status: 400 }
    )
  }

  return handleUnsubscribe(email)
}

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

    return handleUnsubscribe(email)
  } catch (error) {
    logger.error('Error parsing unsubscribe request body', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

async function handleUnsubscribe(email: string) {
  // Normalize email
  const normalizedEmail = email.trim().toLowerCase()

  // Validate email format
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    )
  }

  try {
    // Use service role client to bypass RLS
    const supabase = getServiceRoleClient()

    // Check if email exists in waitlist
    const { data: existingEntry, error: checkError } = await supabase
      .from('waitlist')
      .select('id, unsubscribed_at')
      .eq('email', normalizedEmail)
      .single()

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        // No rows returned - email not found
        // Return success anyway to prevent email enumeration
        logger.info('Unsubscribe requested for non-existent email', {
          email: normalizedEmail,
        })
        return NextResponse.json({
          success: true,
          message: 'You have been unsubscribed from waitlist emails.',
        })
      }

      logger.error('Error checking waitlist entry for unsubscribe', {
        error: checkError.message,
        email: normalizedEmail,
      })
      return NextResponse.json(
        { error: 'Failed to process unsubscribe request' },
        { status: 500 }
      )
    }

    if (!existingEntry) {
      // Email not found - return success anyway to prevent enumeration
      return NextResponse.json({
        success: true,
        message: 'You have been unsubscribed from waitlist emails.',
      })
    }

    // If already unsubscribed, return success
    if (existingEntry.unsubscribed_at) {
      return NextResponse.json({
        success: true,
        message: 'You are already unsubscribed from waitlist emails.',
      })
    }

    // Set unsubscribed_at timestamp
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        unsubscribed_at: now,
      })
      .eq('id', existingEntry.id)

    if (updateError) {
      logger.error('Failed to update unsubscribed_at', {
        error: updateError.message,
        email: normalizedEmail,
      })
      return NextResponse.json(
        { error: 'Failed to process unsubscribe request' },
        { status: 500 }
      )
    }

    logger.info('Waitlist unsubscribe successful', {
      email: normalizedEmail,
    })

    return NextResponse.json({
      success: true,
      message: 'You have been unsubscribed from waitlist emails.',
    })
  } catch (error) {
    logger.error('Unexpected error in unsubscribe handler', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      email: normalizedEmail,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




