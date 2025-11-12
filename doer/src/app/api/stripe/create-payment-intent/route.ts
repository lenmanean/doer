import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { ensureStripeCustomer } from '@/lib/stripe/customers'
import { getPriceIdForPlan } from '@/lib/stripe/prices'

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
    let { amount } = body as { amount?: number }
    let currency = (body.currency as string | undefined) || 'usd'
    const description = (body.description as string | undefined) || undefined
    const metadata = (body.metadata as Record<string, unknown> | undefined) || {}
    const receiptEmail = (body.receiptEmail as string | undefined) || undefined
    const planSlug = (body.planSlug as string | undefined) || (metadata?.planSlug as string | undefined)
    const billingCycle =
      (body.billingCycle as string | undefined) ||
      (metadata?.billingCycle as string | undefined) ||
      'monthly'
    const explicitPriceId = (body.priceId as string | undefined) || (metadata?.priceId as string | undefined)

    const stripeCustomerId = await ensureStripeCustomer({
      supabase,
      stripe,
      userId: user.id,
      email: user.email,
    })

    let priceId: string | undefined = explicitPriceId
    if (!priceId && planSlug) {
      priceId = getPriceIdForPlan(planSlug, billingCycle)
    }

    if ((!amount || amount <= 0) && priceId) {
      const price = await stripe.prices.retrieve(priceId)
      if (price.unit_amount && price.currency) {
        amount = price.unit_amount
        currency = price.currency
      } else {
        amount = 0
      }
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        {
          requiresPayment: false,
          message: 'No payment required for this plan.',
          priceId,
        },
        { status: 200 }
      )
    }

    if (!Number.isInteger(amount) || amount < 1) {
      return NextResponse.json(
        {
          error:
            'Invalid amount. Provide an integer amount in the smallest currency unit (e.g. cents).',
        },
        { status: 400 }
      )
    }

    const finalMetadata: Record<string, string> = {
      ...(metadata || {}),
      userId: user.id,
      planSlug: (typeof planSlug === 'string' ? planSlug : (typeof metadata?.planSlug === 'string' ? metadata.planSlug : 'unknown')),
      billingCycle: (typeof billingCycle === 'string' ? billingCycle : (typeof metadata?.billingCycle === 'string' ? metadata.billingCycle : 'monthly')),
      ...(priceId ? { priceId: String(priceId) } : {}),
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description,
      metadata: finalMetadata,
      receipt_email: receiptEmail || user.email || undefined,
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
    })

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: 'Failed to create payment intent.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        customerId: stripeCustomerId,
        priceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error creating payment intent', error)

    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : (error as Error)?.message ?? 'Unexpected server error creating payment intent.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}


