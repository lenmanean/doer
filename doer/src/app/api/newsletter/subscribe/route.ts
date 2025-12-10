import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/mailer'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, source = 'blog' } = body

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

    // Validate source
    const validSources = ['blog', 'landing', 'other']
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source' },
        { status: 400 }
      )
    }

    // Extract IP address and user agent
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    const userAgent = request.headers.get('user-agent') || null

    // Create Supabase client
    const supabase = await createClient()

    // Check if email already exists
    const { data: existingSubscription } = await supabase
      .from('newsletter_subscriptions')
      .select('id, is_active, unsubscribed_at')
      .eq('email', normalizedEmail)
      .single()

    // If email exists and is active, return success (don't reveal it exists)
    if (existingSubscription && existingSubscription.is_active) {
      return NextResponse.json({
        success: true,
        message: 'Thank you for subscribing!',
      })
    }

    // If email exists but is unsubscribed, don't auto-reactivate
    // User must explicitly resubscribe (respects previous unsubscribe decision)
    if (existingSubscription && !existingSubscription.is_active) {
      // Return success without revealing they were previously unsubscribed
      // This prevents email enumeration while respecting unsubscribe
      return NextResponse.json({
        success: true,
        message: 'Thank you for subscribing!',
      })
    }

    // Insert new subscription
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .insert({
        email: normalizedEmail,
        source: source,
        ip_address: ipAddress,
        user_agent: userAgent,
        is_active: true,
        subscribed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing newsletter subscription:', error)
      // Check if it's a duplicate key error (race condition)
      if (error.code === '23505') {
        // Unique constraint violation - email already exists
        return NextResponse.json({
          success: true,
          message: 'Thank you for subscribing!',
        })
      }

      return NextResponse.json(
        { error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      )
    }

    // Note: Following waitlist pattern - no confirmation email sent
    // Newsletter emails will be sent separately via email marketing service

    return NextResponse.json({
      success: true,
      message: 'Thank you for subscribing!',
      id: data.id,
    })
  } catch (error) {
    console.error('Error in newsletter subscribe API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
