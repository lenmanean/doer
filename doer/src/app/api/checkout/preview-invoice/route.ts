import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { requirePriceId } from '@/lib/stripe/prices'
import type { BillingCycle } from '@/lib/billing/plans'

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
    const billingCycleRaw = ((body.billingCycle as string | undefined) || 'monthly').toLowerCase()
    const countryName = body.country as string | undefined
    const address = body.address as string | undefined
    const city = body.city as string | undefined
    const state = body.state as string | undefined
    const zip = body.zip as string | undefined

    // Validate inputs
    if (!planSlug || !['basic', 'pro'].includes(planSlug)) {
      return NextResponse.json(
        { error: 'Invalid planSlug. Must be "basic" or "pro"' },
        { status: 400 }
      )
    }

    if (!['monthly', 'annual'].includes(billingCycleRaw)) {
      return NextResponse.json(
        { error: 'Invalid billingCycle. Must be "monthly" or "annual"' },
        { status: 400 }
      )
    }

    const billingCycle = billingCycleRaw as BillingCycle

    // Get price ID
    let priceId: string
    try {
      priceId = requirePriceId(planSlug, billingCycle)
    } catch (priceError) {
      console.error('[Preview Invoice] Missing price ID:', priceError)
      return NextResponse.json(
        { error: `Configuration error: Missing Stripe price ID for ${planSlug} plan (${billingCycle})` },
        { status: 500 }
      )
    }

    // Return base price only - tax will be calculated at checkout
    // Stripe's create_preview API doesn't support recurring prices, and we don't want
    // to create temporary subscriptions. Tax will be calculated correctly when the
    // actual subscription is created (automatic_tax is enabled in create-subscription endpoint)
    const price = await stripe.prices.retrieve(priceId)
    const subtotal = price.unit_amount || 0

    return NextResponse.json({
      subtotal,
      tax: 0, // Tax will be calculated at checkout
      total: subtotal,
      currency: price.currency || 'usd',
      taxBreakdown: [],
    })
  } catch (error) {
    console.error('[Preview Invoice] Error:', error)

    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : (error as Error)?.message ?? 'Unexpected server error previewing invoice'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

