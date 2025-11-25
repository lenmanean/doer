import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { ensureStripeCustomer } from '@/lib/stripe/customers'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

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

    const body = await request.json()
    const planSlug = (body.planSlug as string | undefined)?.toLowerCase()
    const billingCycle = ((body.billingCycle as string | undefined) || 'monthly').toLowerCase()

    // Validate planSlug and billingCycle
    if (!planSlug || !['basic', 'pro'].includes(planSlug)) {
      return NextResponse.json(
        { error: 'Invalid planSlug. Must be "basic" or "pro"' },
        { status: 400 }
      )
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json(
        { error: 'Invalid billingCycle. Must be "monthly" or "annual"' },
        { status: 400 }
      )
    }

    const stripeCustomerId = await ensureStripeCustomer({
      supabase,
      stripe,
      userId: user.id,
      email: user.email,
    })

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: {
        userId: user.id,
        planSlug,
        billingCycle,
      },
    })

    if (!setupIntent.client_secret) {
      return NextResponse.json(
        { error: 'Failed to create setup intent' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error creating setup intent', error)

    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : (error as Error)?.message ?? 'Unexpected server error creating setup intent.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

