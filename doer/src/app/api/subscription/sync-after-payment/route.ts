import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { syncSubscriptionSnapshot } from '@/lib/billing/subscription-sync'
import { subscriptionCache } from '@/lib/cache/subscription-cache'
import { logger } from '@/lib/logger'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * POST /api/subscription/sync-after-payment
 * Manually sync subscription status after payment confirmation
 * This ensures the subscription is properly activated and synced to the database
 */
export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { subscriptionId } = body

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId is required' },
        { status: 400 }
      )
    }

    // Retrieve the subscription from Stripe to get latest status
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'latest_invoice.payment_intent'],
    })

    console.log('[Sync After Payment] Subscription status:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      userId: user.id,
    })

    // If subscription is still incomplete, check if payment was successful
    if (subscription.status === 'incomplete') {
      const invoice = subscription.latest_invoice
      let invoiceObj: Stripe.Invoice | null = null

      if (typeof invoice === 'string') {
        invoiceObj = await stripe.invoices.retrieve(invoice, {
          expand: ['payment_intent'],
        })
      } else if (invoice && typeof invoice === 'object') {
        invoiceObj = invoice as Stripe.Invoice
      }

      if (invoiceObj) {
        // payment_intent is an expandable property, use type assertion
        const paymentIntent = (invoiceObj as any).payment_intent
        let paymentIntentObj: Stripe.PaymentIntent | null = null

        if (typeof paymentIntent === 'string') {
          paymentIntentObj = await stripe.paymentIntents.retrieve(paymentIntent)
        } else if (paymentIntent && typeof paymentIntent === 'object') {
          paymentIntentObj = paymentIntent as Stripe.PaymentIntent
        }

        // If payment succeeded, the subscription should become active
        // Sometimes Stripe needs a moment to update the subscription status
        if (paymentIntentObj?.status === 'succeeded') {
          console.log('[Sync After Payment] Payment succeeded but subscription still incomplete, waiting...')
          
          // Wait a bit and retrieve subscription again
          // Stripe may need a few seconds to update subscription status after payment
          await new Promise(resolve => setTimeout(resolve, 3000))
          const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId)
          
          if (updatedSubscription.status === 'active') {
            console.log('[Sync After Payment] Subscription now active after payment')
            // Sync the active subscription
            await syncSubscriptionSnapshot(updatedSubscription, { userId: user.id })
            subscriptionCache.invalidateUser(user.id)
            
            return NextResponse.json({
              success: true,
              status: 'active',
              message: 'Subscription activated and synced',
            })
          } else if (updatedSubscription.status === 'incomplete') {
            // Subscription is still incomplete even though payment succeeded
            // This can happen if Stripe needs more time, or if there's an issue
            // Try to pay the invoice again or check if there's a pending payment
            console.warn('[Sync After Payment] Subscription still incomplete after payment succeeded', {
              subscriptionId: updatedSubscription.id,
              status: updatedSubscription.status,
              latestInvoice: updatedSubscription.latest_invoice,
            })
            
            // Even though it's incomplete, sync it as active since payment succeeded
            // Our sync logic will handle this correctly
            await syncSubscriptionSnapshot(updatedSubscription, { userId: user.id })
            subscriptionCache.invalidateUser(user.id)
            
            return NextResponse.json({
              success: true,
              status: 'incomplete_but_paid',
              message: 'Payment succeeded but subscription still processing. Synced as active.',
            })
          } else {
            console.warn('[Sync After Payment] Subscription status unexpected after payment succeeded', {
              subscriptionId: updatedSubscription.id,
              status: updatedSubscription.status,
            })
          }
        }
      }
    }

    // Sync subscription regardless of status (webhook will handle it too)
    await syncSubscriptionSnapshot(subscription, { userId: user.id })
    subscriptionCache.invalidateUser(user.id)

    return NextResponse.json({
      success: true,
      status: subscription.status,
      message: 'Subscription synced',
    })
  } catch (error) {
    logger.error('Error syncing subscription after payment', error as Error)
    return NextResponse.json(
      { error: 'Failed to sync subscription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

