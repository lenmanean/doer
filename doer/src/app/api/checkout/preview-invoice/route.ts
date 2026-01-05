import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { ensureStripeCustomer } from '@/lib/stripe/customers'
import { requirePriceId } from '@/lib/stripe/prices'
import type { BillingCycle } from '@/lib/billing/plans'

// Helper function to convert country name to ISO code
function getCountryCode(countryName: string | null | undefined): string | undefined {
  if (!countryName || countryName === 'Other') return undefined
  const countryMap: Record<string, string> = {
    'United States': 'US',
    'Canada': 'CA',
    'United Kingdom': 'GB',
    'Australia': 'AU',
    'Germany': 'DE',
    'France': 'FR',
    'Japan': 'JP',
  }
  return countryMap[countryName] || undefined
}

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

    // Basic plan has no tax (free)
    if (planSlug === 'basic') {
      const price = await stripe.prices.retrieve(priceId)
      const subtotal = price.unit_amount || 0
      return NextResponse.json({
        subtotal,
        tax: 0,
        total: subtotal,
        currency: price.currency || 'usd',
        taxBreakdown: [],
      })
    }

    // Ensure customer exists and update address for tax calculation
    const stripeCustomerId = await ensureStripeCustomer({
      supabase,
      stripe,
      userId: user.id,
      email: user.email,
    })

    // Update customer address for accurate tax calculation
    const countryCode = countryName ? getCountryCode(countryName) : null
    if (countryCode) {
      try {
        await stripe.customers.update(stripeCustomerId, {
          address: {
            country: countryCode,
            line1: address || undefined,
            city: city || undefined,
            state: state || undefined,
            postal_code: zip || undefined,
          },
        })
      } catch (updateError) {
        console.warn('[Preview Invoice] Error updating customer address:', updateError)
        // Non-fatal - continue with tax preview
      }
    }

    // For subscription tax preview, create a temporary subscription with default_incomplete
    // to get the tax amount from the upcoming invoice, then cancel it
    let tempSubscription: Stripe.Subscription | null = null
    try {
      const price = await stripe.prices.retrieve(priceId)
      const subtotal = price.unit_amount || 0

      // Create temporary subscription with default_incomplete payment behavior
      // This generates an invoice with tax calculation without charging
      tempSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId, quantity: 1 }],
        payment_behavior: 'default_incomplete', // Don't charge, just calculate
        automatic_tax: { enabled: true },
        expand: ['latest_invoice', 'latest_invoice.total_tax_amounts'],
      })

      // Get tax amount from the invoice
      const invoice = tempSubscription.latest_invoice
      let taxAmount = 0
      let taxBreakdown: any[] = []

      if (invoice && typeof invoice !== 'string') {
        taxBreakdown = invoice.total_tax_amounts || []
        taxAmount = taxBreakdown.reduce((sum: number, tax: any) => sum + (tax?.amount || 0), 0)
      }

      const total = subtotal + taxAmount

      // Cancel the temporary subscription immediately
      try {
        await stripe.subscriptions.cancel(tempSubscription.id)
      } catch (cancelError) {
        console.warn('[Preview Invoice] Error canceling temp subscription:', cancelError)
        // Non-fatal - subscription might auto-cancel
      }

      return NextResponse.json({
        subtotal,
        tax: taxAmount,
        total,
        currency: price.currency || 'usd',
        taxBreakdown,
      })
    } catch (previewError: any) {
      // Clean up temp subscription if it was created
      if (tempSubscription) {
        try {
          await stripe.subscriptions.cancel(tempSubscription.id)
        } catch (cancelError) {
          console.warn('[Preview Invoice] Error canceling temp subscription on error:', cancelError)
        }
      }

      // Handle case where Stripe Tax is not configured
      if (
        previewError?.code === 'tax_id_invalid' ||
        previewError?.message?.includes('automatic tax') ||
        previewError?.message?.includes('tax')
      ) {
        console.warn('[Preview Invoice] Stripe Tax not configured, returning subtotal only:', previewError)
        const price = await stripe.prices.retrieve(priceId)
        const subtotal = price.unit_amount || 0
        return NextResponse.json({
          subtotal,
          tax: 0,
          total: subtotal,
          currency: price.currency || 'usd',
          taxBreakdown: [],
          warning: 'Tax calculation unavailable',
        })
      }

      // Re-throw other errors
      throw previewError
    }
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

