import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { ensureStripeCustomer } from '@/lib/stripe/customers'
import { requirePriceId } from '@/lib/stripe/prices'
import { getCountryCode } from '@/lib/stripe/country-codes'
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

    // Ensure customer exists
    const stripeCustomerId = await ensureStripeCustomer({
      supabase,
      stripe,
      userId: user.id,
      email: user.email,
    })

    // Update customer address if country is provided
    if (countryName) {
      const countryCode = getCountryCode(countryName)
      if (countryCode) {
        try {
          await stripe.customers.update(stripeCustomerId, {
            address: {
              country: countryCode,
              line1: address || undefined,
            },
          })
        } catch (updateError) {
          console.error('[Preview Invoice] Error updating customer address:', updateError)
          // Non-fatal - continue with tax calculation
        }
      }
    }

    // Preview invoice using upcoming invoice API
    // Stripe automatically calculates tax based on customer address if Stripe Tax is enabled
    try {
      // Use type assertion since retrieveUpcoming exists in runtime but not in TypeScript types
      const upcomingInvoice = await (stripe.invoices as any).retrieveUpcoming({
        customer: stripeCustomerId,
        subscription_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
      })

      // Extract tax amount from total_tax_amounts
      const taxAmount = (upcomingInvoice.total_tax_amounts as Stripe.InvoiceTotalTaxAmount[] | undefined)?.reduce(
        (sum: number, tax: Stripe.InvoiceTotalTaxAmount) => sum + tax.amount,
        0
      ) || 0

      const subtotal = upcomingInvoice.subtotal || 0
      const total = upcomingInvoice.total || subtotal

      return NextResponse.json({
        subtotal,
        tax: taxAmount,
        total,
        currency: upcomingInvoice.currency || 'usd',
        taxBreakdown: upcomingInvoice.total_tax_amounts || [],
      })
    } catch (invoiceError: any) {
      // Handle case where Stripe Tax is not configured
      if (
        invoiceError?.code === 'tax_id_invalid' ||
        invoiceError?.message?.includes('automatic tax') ||
        invoiceError?.message?.includes('tax')
      ) {
        console.warn('[Preview Invoice] Stripe Tax not configured, returning subtotal only:', invoiceError)
        // Return subtotal without tax
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
      throw invoiceError
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

