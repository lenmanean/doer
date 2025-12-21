import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendResendEmail } from '@/lib/email/resend'
import { Email0Welcome } from '@/emails/waitlist/Email0Welcome'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

/**
 * Email validation regex pattern
 * Matches standard email format
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Get base URL for unsubscribe links
 */
function getBaseUrl(request: NextRequest): string {
  const origin = request.headers.get('origin') || request.headers.get('host')
  if (origin) {
    // If origin includes protocol, use it; otherwise construct from host
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return origin
    }
    // Use https in production, http in development
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    return `${protocol}://${origin}`
  }
  // Fallback to environment variable or default
  return process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'
}

/**
 * POST /api/waitlist
 * Handles waitlist email signups with optional goal capture and UTM attribution
 * 
 * Body: { 
 *   email: string, 
 *   source?: string, 
 *   goal?: string,
 *   utm_source?: string,
 *   utm_campaign?: string,
 *   utm_medium?: string,
 *   utm_content?: string,
 *   utm_term?: string,
 *   adset?: string,
 *   ad_name?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      email, 
      source, 
      goal,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term,
      adset,
      ad_name,
    } = body

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

    // Insert new waitlist entry with UTM attribution
    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({
        email: normalizedEmail,
        source: source || null,
        goal: goal && typeof goal === 'string' ? goal.trim() : null,
        ip_address: ipAddress,
        user_agent: userAgent,
        utm_source: utm_source && typeof utm_source === 'string' ? utm_source.trim() : null,
        utm_campaign: utm_campaign && typeof utm_campaign === 'string' ? utm_campaign.trim() : null,
        utm_medium: utm_medium && typeof utm_medium === 'string' ? utm_medium.trim() : null,
        utm_content: utm_content && typeof utm_content === 'string' ? utm_content.trim() : null,
        utm_term: utm_term && typeof utm_term === 'string' ? utm_term.trim() : null,
        adset: adset && typeof adset === 'string' ? adset.trim() : null,
        ad_name: ad_name && typeof ad_name === 'string' ? ad_name.trim() : null,
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

    // Send welcome email on first-time signup only
    // Do this after successful insert to ensure we only send for new signups
    const baseUrl = getBaseUrl(request)
    const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(normalizedEmail)}`
    
    const emailResult = await sendResendEmail({
      to: normalizedEmail,
      subject: 'Welcome to DOER!',
      react: Email0Welcome({ unsubscribeUrl }),
      tag: 'waitlist-welcome',
      unsubscribeUrl,
    })

    // Update email timestamps only if email was sent successfully
    if (emailResult.success) {
      const now = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('waitlist')
        .update({
          welcome_sent_at: now,
          last_email_sent_at: now,
        })
        .eq('email', normalizedEmail)

      if (updateError) {
        logger.error('Failed to update email timestamps after welcome email', {
          error: updateError.message,
          email: normalizedEmail,
        })
        // Don't fail the request - email was sent, just timestamp update failed
      }
    } else {
      logger.error('Failed to send welcome email', {
        error: emailResult.error,
        email: normalizedEmail,
      })
      // Don't fail the request - signup succeeded, email sending failed
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

