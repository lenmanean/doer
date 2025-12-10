import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

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

    // Create Supabase client
    const supabase = await createClient()

    // Find subscription
    const { data: subscription, error: findError } = await supabase
      .from('newsletter_subscriptions')
      .select('id, is_active')
      .eq('email', normalizedEmail)
      .single()

    // If subscription doesn't exist or already unsubscribed, return success
    // (don't reveal whether email exists to prevent enumeration)
    if (findError || !subscription || !subscription.is_active) {
      return NextResponse.json({
        success: true,
        message: 'You have been unsubscribed from our newsletter.',
      })
    }

    // Update subscription to inactive
    const { error: updateError } = await supabase
      .from('newsletter_subscriptions')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    if (updateError) {
      console.error('Error unsubscribing from newsletter:', updateError)
      return NextResponse.json(
        { error: 'Failed to unsubscribe. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'You have been unsubscribed from our newsletter.',
    })
  } catch (error) {
    console.error('Error in newsletter unsubscribe API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
