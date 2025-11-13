import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { ensureStripeCustomer } from '@/lib/stripe/customers'
import { requirePriceId } from '@/lib/stripe/prices'
import { fetchActiveSubscription } from '@/lib/billing/plans'

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
    const paymentMethodId = body.paymentMethodId as string | undefined

    // Validate inputs
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

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'paymentMethodId is required' },
        { status: 400 }
      )
    }

    // Get price ID
    const priceId = requirePriceId(planSlug, billingCycle)

    // Check if user already has active subscription
    try {
      const existingSubscription = await fetchActiveSubscription(user.id)
      if (existingSubscription) {
        // User has active subscription - this will be handled as upgrade/downgrade by Stripe
        // We'll let Stripe handle proration automatically
      }
    } catch (error) {
      // If fetch fails, continue anyway - might be first subscription
      console.log('[Create Subscription] Could not check existing subscription:', error)
    }

    const stripeCustomerId = await ensureStripeCustomer({
      supabase,
      stripe,
      userId: user.id,
      email: user.email,
    })

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    })

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata: {
        userId: user.id,
        planSlug,
        billingCycle,
      },
      expand: ['latest_invoice.payment_intent'],
    })

    console.log('[Create Subscription] Subscription created:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      latestInvoice: subscription.latest_invoice
        ? typeof subscription.latest_invoice === 'string'
          ? subscription.latest_invoice
          : subscription.latest_invoice.id
        : null,
    })

    const invoice = subscription.latest_invoice as Stripe.Invoice | string | null
    if (!invoice) {
      console.error('[Create Subscription] No invoice found on subscription')
      return NextResponse.json(
        { error: 'No invoice found for subscription' },
        { status: 500 }
      )
    }

    // If invoice is a string ID, retrieve it
    let invoiceObj: Stripe.Invoice
    if (typeof invoice === 'string') {
      invoiceObj = await stripe.invoices.retrieve(invoice, {
        expand: ['payment_intent'],
      })
    } else {
      invoiceObj = invoice
    }

    console.log('[Create Subscription] Invoice details:', {
      invoiceId: invoiceObj.id,
      status: invoiceObj.status,
      paymentIntent: invoiceObj.payment_intent
        ? typeof invoiceObj.payment_intent === 'string'
          ? invoiceObj.payment_intent
          : invoiceObj.payment_intent.id
        : null,
    })

    // payment_intent can be a string ID or an expanded PaymentIntent object
    const paymentIntent = invoiceObj.payment_intent as Stripe.PaymentIntent | string | null

    if (!paymentIntent) {
      console.error('[Create Subscription] No payment intent found on invoice')
      return NextResponse.json(
        { error: 'No payment intent found for invoice' },
        { status: 500 }
      )
    }

    let clientSecret: string | null = null
    if (typeof paymentIntent === 'object' && paymentIntent?.client_secret) {
      clientSecret = paymentIntent.client_secret
    } else if (typeof paymentIntent === 'string') {
      // If it's just an ID, retrieve the payment intent explicitly
      try {
        const retrievedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent)
        clientSecret = retrievedPaymentIntent.client_secret
        console.log('[Create Subscription] Retrieved payment intent:', {
          paymentIntentId: retrievedPaymentIntent.id,
          status: retrievedPaymentIntent.status,
          hasClientSecret: !!clientSecret,
        })
      } catch (retrieveError) {
        console.error('[Create Subscription] Error retrieving payment intent:', retrieveError)
        return NextResponse.json(
          { error: 'Failed to retrieve payment intent. Please retry.' },
          { status: 500 }
        )
      }
    }

    if (!clientSecret) {
      console.error('[Create Subscription] No client secret found', {
        paymentIntentType: typeof paymentIntent,
        paymentIntent: paymentIntent,
      })
      return NextResponse.json(
        { error: 'Failed to get payment intent client secret' },
        { status: 500 }
      )
    }

    console.log('[Create Subscription] Successfully created subscription with client secret')

    return NextResponse.json(
      {
        subscriptionId: subscription.id,
        clientSecret,
        status: subscription.status,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error creating subscription', error)

    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : (error as Error)?.message ?? 'Unexpected server error creating subscription.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

