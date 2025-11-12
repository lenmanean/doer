import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Only initialize Stripe if secret key is available (allows build to succeed)
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get user's Stripe customer ID
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!userSettings?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this user' },
        { status: 404 }
      )
    }

    // Create Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userSettings.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'}/settings?section=subscription`,
    })

    return NextResponse.json(
      {
        url: portalSession.url,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error creating portal session', error)

    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : (error as Error)?.message ?? 'Unexpected server error creating portal session.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

