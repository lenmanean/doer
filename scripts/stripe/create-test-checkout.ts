#!/usr/bin/env ts-node

import Stripe from 'stripe'

import { requirePriceId } from '../../src/lib/stripe/prices'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  console.error('Missing STRIPE_SECRET_KEY environment variable')
  process.exit(1)
}

const stripe = new Stripe(stripeSecretKey)

async function main() {
  const [userId, planSlug, billingCycle = 'monthly', successUrl, cancelUrl] = process.argv.slice(2)

  if (!userId || !planSlug) {
    console.error('Usage: ts-node scripts/stripe/create-test-checkout.ts <userId> <planSlug> [billingCycle] [successUrl] [cancelUrl]')
    process.exit(1)
  }

  const priceId =
    process.env.PRICE_ID_OVERRIDE || requirePriceId(planSlug, billingCycle)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl || 'https://example.com/success',
    cancel_url: cancelUrl || 'https://example.com/cancel',
    metadata: {
      userId,
      planSlug,
      billingCycle,
    },
    subscription_data: {
      metadata: {
        userId,
        planSlug,
        billingCycle,
        priceId,
      },
    },
  })

  console.log('Created checkout session:', session.id)
  if (session.url) {
    console.log('URL:', session.url)
  }
}

main().catch((error) => {
  console.error('Failed to create test checkout session', error)
  process.exit(1)
})

