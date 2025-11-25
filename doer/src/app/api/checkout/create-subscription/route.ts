import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { ensureStripeCustomer } from '@/lib/stripe/customers'
import { requirePriceId } from '@/lib/stripe/prices'
import { type SubscriptionStatus, type BillingCycle } from '@/lib/billing/plans'
import { syncSubscriptionSnapshot } from '@/lib/billing/subscription-sync'
import { getActiveSubscriptionFromStripe, type StripeSubscription } from '@/lib/stripe/subscriptions'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Only initialize Stripe if secret key is available (allows build to succeed)
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

export async function POST(request: NextRequest) {
  // Declare subscription outside try block so it's accessible in catch for cleanup
  let subscription: Stripe.Subscription | null = null
  // Declare variables outside try block so they're accessible in catch for error logging
  let planSlug: string | undefined
  let billingCycle: BillingCycle | undefined
  let priceId: string | undefined
  
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
    planSlug = (body.planSlug as string | undefined)?.toLowerCase()
    const billingCycleRaw = ((body.billingCycle as string | undefined) || 'monthly').toLowerCase()
    const paymentMethodId = body.paymentMethodId as string | undefined

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

    // Type assert as BillingCycle after validation
    // This ensures TypeScript recognizes billingCycle as the correct type
    billingCycle = billingCycleRaw as BillingCycle

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'paymentMethodId is required' },
        { status: 400 }
      )
    }

    // Get price ID
    try {
      priceId = requirePriceId(planSlug, billingCycle)
    } catch (priceError) {
      console.error('[Create Subscription] Missing price ID:', priceError)
      return NextResponse.json(
        { 
          error: `Configuration error: Missing Stripe price ID for ${planSlug} plan (${billingCycle}). Please contact support.`,
          details: 'The payment configuration is incomplete. This is a server configuration issue.'
        },
        { status: 500 }
      )
    }

    // Validate price ID exists in Stripe (optional check - Stripe will also validate)
    if (stripe && priceId) {
      try {
        await stripe.prices.retrieve(priceId)
      } catch (priceRetrieveError: any) {
        // If price doesn't exist, provide a helpful error message
        if (priceRetrieveError?.code === 'resource_missing' || priceRetrieveError?.statusCode === 404) {
          console.error('[Create Subscription] Price ID not found in Stripe:', {
            priceId,
            planSlug,
            billingCycle,
            error: priceRetrieveError.message,
          })
          return NextResponse.json(
            { 
              error: `Configuration error: The selected plan (${planSlug} - ${billingCycle}) is not properly configured. Please contact support.`,
              details: `Price ID '${priceId}' does not exist in Stripe. This is a server configuration issue.`
            },
            { status: 500 }
          )
        }
        // For other errors, log but continue - Stripe will validate during subscription creation
        console.warn('[Create Subscription] Warning: Could not validate price ID:', priceRetrieveError)
      }
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

    // Check if user already has any subscription (active, trialing, or incomplete) - if so, UPDATE it instead of creating new
    let existingSubscription: StripeSubscription | null = null
    let existingStripeSubscription: Stripe.Subscription | null = null
    
    try {
      // First try to get active subscription
      existingSubscription = await getActiveSubscriptionFromStripe(user.id)
      
      // If no active subscription found, check for incomplete subscriptions directly from Stripe
      if (!existingSubscription) {
        const stripeCustomerId = await ensureStripeCustomer({
          supabase,
          stripe,
          userId: user.id,
          email: user.email,
        })
        
        if (stripeCustomerId) {
          const allSubscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'all',
            limit: 10,
          })
          
          // Find the most recent subscription (active, trialing, or incomplete)
          const recentSubscription = allSubscriptions.data
            .filter(sub => ['active', 'trialing', 'incomplete', 'incomplete_expired'].includes(sub.status))
            .sort((a, b) => (b.created || 0) - (a.created || 0))[0]
          
          if (recentSubscription) {
            existingStripeSubscription = recentSubscription
            console.log('[Create Subscription] Found existing subscription with status:', recentSubscription.status)
          }
        }
      } else if (existingSubscription.id) {
        // If we found an active subscription, retrieve it from Stripe to update
        try {
          existingStripeSubscription = await stripe.subscriptions.retrieve(existingSubscription.id)
        } catch (retrieveError) {
          console.warn('[Create Subscription] Could not retrieve existing subscription:', retrieveError)
        }
      }
    } catch (error) {
      // If fetch fails, continue anyway - might be first subscription
      console.log('[Create Subscription] Could not check existing subscription:', error)
    }

    if (existingStripeSubscription && existingStripeSubscription.id) {
      // User has existing subscription - UPDATE it instead of canceling and creating new
      // This is Stripe's recommended approach and avoids race conditions
      console.log('[Create Subscription] Upgrading existing subscription:', {
        existingSubscriptionId: existingStripeSubscription.id,
        existingStatus: existingStripeSubscription.status,
        newPlanSlug: planSlug,
        newBillingCycle: billingCycle,
        newPriceId: priceId,
      })

      // Get the current subscription item ID to update
      const currentItemId = existingStripeSubscription.items.data[0]?.id
      
      if (!currentItemId) {
        throw new Error('Cannot find subscription item to update')
      }

      // If subscription is incomplete or incomplete_expired, cancel it first
      // Then create a new one (can't update incomplete subscriptions)
      if (existingStripeSubscription.status === 'incomplete' || existingStripeSubscription.status === 'incomplete_expired') {
        console.log('[Create Subscription] Existing subscription is incomplete, canceling and creating new one')
        try {
          await stripe.subscriptions.cancel(existingStripeSubscription.id)
          // Mark as canceled in database immediately
          try {
            const { getServiceRoleClient } = await import('@/lib/supabase/service-role')
            const serviceSupabase = getServiceRoleClient()
            await serviceSupabase
              .from('user_plan_subscriptions')
              .update({
                status: 'canceled',
                cancel_at: new Date().toISOString().split('T')[0],
                cancel_at_period_end: false,
                updated_at: new Date().toISOString(),
              })
              .eq('external_subscription_id', existingStripeSubscription.id)
              .eq('user_id', user.id)
          } catch (dbError) {
            console.warn('[Create Subscription] Error marking incomplete subscription as canceled:', dbError)
          }
        } catch (cancelError) {
          console.warn('[Create Subscription] Error canceling incomplete subscription:', cancelError)
        }
        // Clear reference so we create new subscription below
        existingStripeSubscription = null
      } else {
        // Update the existing subscription - Stripe's recommended approach
        // This maintains the same subscription ID and avoids race conditions
        console.log('[Create Subscription] Updating existing subscription to new plan')
        
        // For upgrades, use 'pending_if_incomplete' which will attempt to charge
        // the default payment method automatically, but requires confirmation if payment fails
        // NOTE: metadata cannot be passed when payment_behavior is 'pending_if_incomplete'
        // We'll update metadata separately after the subscription update
        subscription = await stripe.subscriptions.update(existingStripeSubscription.id, {
          items: [
            {
              id: currentItemId,
              price: priceId, // Update to new price
            },
          ],
          // metadata is NOT allowed with pending_if_incomplete - will update separately
          payment_behavior: 'pending_if_incomplete', // Try to charge default payment method, require confirmation if it fails
          proration_behavior: 'always_invoice', // Prorate the difference
          expand: ['latest_invoice', 'latest_invoice.payment_intent'],
        })
        
        // Update metadata separately (not allowed in the update call above)
        try {
          await stripe.subscriptions.update(existingStripeSubscription.id, {
            metadata: {
              userId: user.id,
              planSlug,
              billingCycle,
            },
          })
          console.log('[Create Subscription] Metadata updated separately after subscription update')
        } catch (metadataError) {
          console.warn('[Create Subscription] Failed to update metadata separately:', metadataError)
          // Non-critical - metadata update can fail without breaking the subscription
        }

        console.log('[Create Subscription] Subscription updated (upgrade):', {
          subscriptionId: subscription.id,
          status: subscription.status,
          latestInvoice: subscription.latest_invoice
            ? typeof subscription.latest_invoice === 'string'
              ? subscription.latest_invoice
              : subscription.latest_invoice.id
            : null,
        })
        
        // If subscription is incomplete or past_due after update, we need to handle payment
        // The invoice should have a payment intent that needs confirmation
        if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired' || subscription.status === 'past_due') {
          console.log('[Create Subscription] Subscription requires payment after update, will handle payment via invoice', {
            status: subscription.status,
          })
          // Continue to invoice processing below - the payment intent will be extracted and returned
        } else if (subscription.status === 'active') {
          // Payment succeeded automatically - sync to database immediately
          console.log('[Create Subscription] Subscription is active after update, syncing to database')
          try {
            await syncSubscriptionSnapshot(subscription, { userId: user.id })
            console.log('[Create Subscription] Successfully synced updated subscription to database')
          } catch (syncError) {
            console.error('[Create Subscription] Error syncing updated subscription:', syncError)
            // Continue - webhook will handle it
          }
        }
      }
    }
    
    // Create new subscription if we don't have one yet (either no existing subscription or we canceled an incomplete one)
    if (!subscription) {
      // No existing subscription - create new one
    subscription = await stripe.subscriptions.create({
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
      expand: ['latest_invoice', 'latest_invoice.payment_intent'],
    })

      console.log('[Create Subscription] New subscription created:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      latestInvoice: subscription.latest_invoice
        ? typeof subscription.latest_invoice === 'string'
          ? subscription.latest_invoice
          : subscription.latest_invoice.id
        : null,
    })
    }

    const invoice = subscription.latest_invoice as Stripe.Invoice | string | null
    if (!invoice) {
      console.error('[Create Subscription] No invoice found on subscription', {
        subscriptionId: subscription.id,
        status: subscription.status,
      })
      return NextResponse.json(
        { error: 'No invoice found for subscription' },
        { status: 500 }
      )
    }

    // Check if invoice is already expanded from subscription creation
    let invoiceObj: Stripe.Invoice
    if (typeof invoice === 'object' && invoice.id) {
      // Invoice is already expanded - use it directly
      console.error('[Create Subscription] Invoice already expanded from subscription creation', {
        invoiceId: invoice.id,
        invoiceStatus: invoice.status,
        hasPaymentIntent: !!(invoice as any).payment_intent,
        paymentIntentType: typeof (invoice as any).payment_intent,
      })
      invoiceObj = invoice
    } else {
      // Invoice is just an ID - retrieve it with expansion
      const invoiceId = typeof invoice === 'string' ? invoice : invoice.id
      console.error('[Create Subscription] Retrieving invoice with expansion...', { invoiceId })
      invoiceObj = await stripe.invoices.retrieve(invoiceId, {
        expand: ['payment_intent'],
      })
      console.error('[Create Subscription] Retrieved invoice:', {
        invoiceId: invoiceObj.id,
        invoiceStatus: invoiceObj.status,
        hasPaymentIntent: !!(invoiceObj as any).payment_intent,
        paymentIntentType: typeof (invoiceObj as any).payment_intent,
      })
    }
    
    // If invoice is draft, finalize it first (required for payment intent creation)
    if (invoiceObj.status === 'draft') {
      console.log('[Create Subscription] Invoice is draft, finalizing...', {
        invoiceId: invoiceObj.id,
        amountDue: invoiceObj.amount_due,
      })
      try {
        invoiceObj = await stripe.invoices.finalizeInvoice(invoiceObj.id, {
          expand: ['payment_intent'],
        })
        console.log('[Create Subscription] Invoice finalized:', {
          invoiceId: invoiceObj.id,
          status: invoiceObj.status,
          amountDue: invoiceObj.amount_due,
          hasPaymentIntent: !!(invoiceObj as any).payment_intent,
          paymentIntentType: typeof (invoiceObj as any).payment_intent,
        })
      } catch (finalizeError) {
        console.error('[Create Subscription] Error finalizing invoice:', finalizeError)
        return NextResponse.json(
          { error: 'Failed to finalize invoice. Please try again.' },
          { status: 500 }
        )
      }
    }
    
    // If invoice amount is $0, there's no payment needed
    if (invoiceObj.amount_due === 0) {
      console.log('[Create Subscription] Invoice amount is $0, no payment intent needed')
      
      // Immediately update database with subscription information
      try {
        // Map Stripe subscription status to our enum
        const mapStatus = (stripeStatus: string): SubscriptionStatus => {
          const normalized = stripeStatus.toLowerCase().trim()
          switch (normalized) {
            case 'trialing':
              return 'trialing'
            case 'active':
              return 'active'
            case 'past_due':
              return 'past_due'
            case 'canceled':
            case 'unpaid':
            case 'incomplete':
            case 'incomplete_expired':
              return 'canceled'
            default:
              return 'active'
          }
        }
        
        // Format Stripe timestamp to date string (YYYY-MM-DD)
        const formatDate = (timestamp: number | null | undefined): string | undefined => {
          if (!timestamp) return undefined
          const date = new Date(timestamp * 1000) // Stripe timestamps are in seconds
          return date.toISOString().split('T')[0] // Format as YYYY-MM-DD
        }
        
        // Use syncSubscriptionSnapshot instead of deprecated assignSubscription
        // This properly handles incomplete subscriptions and payment status
        await syncSubscriptionSnapshot(subscription, { userId: user.id })
        
        console.log('[Create Subscription] Successfully synced subscription to database', {
          userId: user.id,
          planSlug,
          billingCycle,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
        })
      } catch (assignError) {
        console.error('[Create Subscription] Error assigning subscription to database:', assignError)
        // Don't fail the request - webhook will handle it
      }
      
      return NextResponse.json(
        {
          subscriptionId: subscription.id,
          clientSecret: null,
          status: subscription.status,
          message: 'Subscription created successfully. No payment required.',
        },
        { status: 200 }
      )
    }

    console.log('[Create Subscription] Invoice details:', {
      invoiceId: invoiceObj.id,
      status: invoiceObj.status,
      amountDue: invoiceObj.amount_due,
      currency: invoiceObj.currency,
      hasPaymentIntent: !!(invoiceObj as any).payment_intent,
      invoiceObjectKeys: Object.keys(invoiceObj),
      invoicePaymentIntentField: (invoiceObj as any).payment_intent,
    })

    // payment_intent is an expandable property on Invoice
    // Access it using type assertion since TypeScript may not recognize it in the type definition
    const paymentIntentRaw = (invoiceObj as any).payment_intent as
      | Stripe.PaymentIntent
      | string
      | null
      | undefined

    console.log('[Create Subscription] Payment intent raw value:', {
      type: typeof paymentIntentRaw,
      isString: typeof paymentIntentRaw === 'string',
      isObject: typeof paymentIntentRaw === 'object' && paymentIntentRaw !== null,
      isNull: paymentIntentRaw === null,
      isUndefined: paymentIntentRaw === undefined,
      value: paymentIntentRaw
        ? typeof paymentIntentRaw === 'string'
          ? paymentIntentRaw
          : (paymentIntentRaw as Stripe.PaymentIntent).id
        : null,
      rawValue: paymentIntentRaw,
    })
    
    // Also check if invoice has payment_intent_id field (sometimes it's a separate field)
    const paymentIntentId = (invoiceObj as any).payment_intent_id || (invoiceObj as any).payment_intent
    console.log('[Create Subscription] Payment intent ID check:', {
      paymentIntentId,
      type: typeof paymentIntentId,
      fromPaymentIntentField: (invoiceObj as any).payment_intent,
      fromPaymentIntentIdField: (invoiceObj as any).payment_intent_id,
    })

    // payment_intent can be a string ID or an expanded PaymentIntent object
    let paymentIntent: Stripe.PaymentIntent | string | null = paymentIntentRaw || null

    // If payment intent is null, try to retrieve it with retries
    if (!paymentIntent) {
      console.warn('[Create Subscription] No payment intent found on invoice, attempting recovery strategies...')
      
      // Strategy 0: Create payment intent manually for the invoice
      // When using default_incomplete, Stripe doesn't always create a payment intent automatically
      // We need to create one manually for the invoice amount
      console.error('[Create Subscription] Creating payment intent manually for invoice...', {
        invoiceId: invoiceObj.id,
        amountDue: invoiceObj.amount_due,
        currency: invoiceObj.currency,
        customerId: stripeCustomerId,
        paymentMethodId: paymentMethodId,
      })
      
      try {
        const manualPaymentIntent = await stripe.paymentIntents.create({
          amount: invoiceObj.amount_due,
          currency: invoiceObj.currency,
          customer: stripeCustomerId,
          payment_method: paymentMethodId,
          confirmation_method: 'automatic', // Use 'automatic' so client can confirm with publishable key
          confirm: false, // Don't confirm immediately - let client confirm for 3D Secure
          description: `Payment for subscription ${subscription.id}`,
          metadata: {
            subscription_id: subscription.id,
            invoice_id: invoiceObj.id,
            planSlug,
            billingCycle,
            userId: user.id,
          },
        })
        
        paymentIntent = manualPaymentIntent
        console.error('[Create Subscription] Successfully created payment intent manually:', {
          paymentIntentId: manualPaymentIntent.id,
          status: manualPaymentIntent.status,
          hasClientSecret: !!manualPaymentIntent.client_secret,
        })
      } catch (createError) {
        console.error('[Create Subscription] Error creating payment intent manually:', {
          error: createError instanceof Error ? createError.message : String(createError),
        })
        // Continue to other strategies
      }
      
      // Strategy 1: Check if invoice has payment_intent_id field (sometimes it's there but not expanded)
      if (!paymentIntent) {
        const invoicePaymentIntentId = (invoiceObj as any).payment_intent_id || 
          (typeof (invoiceObj as any).payment_intent === 'string' ? (invoiceObj as any).payment_intent : null) ||
          ((invoiceObj as any).payment_intent?.id ? (invoiceObj as any).payment_intent.id : null)
        
        if (invoicePaymentIntentId) {
          console.log('[Create Subscription] Found payment_intent ID on invoice, retrieving...', {
            paymentIntentId: invoicePaymentIntentId,
            source: (invoiceObj as any).payment_intent_id ? 'payment_intent_id' : 
                   (typeof (invoiceObj as any).payment_intent === 'string' ? 'payment_intent (string)' : 'payment_intent.id'),
          })
          try {
            const retrievedPI = await stripe.paymentIntents.retrieve(invoicePaymentIntentId)
            paymentIntent = retrievedPI
            console.log('[Create Subscription] Successfully retrieved payment intent by ID:', {
              paymentIntentId: retrievedPI.id,
              status: retrievedPI.status,
              hasClientSecret: !!retrievedPI.client_secret,
            })
          } catch (piError) {
            console.error('[Create Subscription] Error retrieving payment intent by ID:', {
              error: piError instanceof Error ? piError.message : String(piError),
              paymentIntentId: invoicePaymentIntentId,
            })
          }
        } else {
          console.log('[Create Subscription] No payment intent ID found on invoice', {
            invoiceId: invoiceObj.id,
            invoiceStatus: invoiceObj.status,
            invoiceKeys: Object.keys(invoiceObj),
            paymentIntentField: (invoiceObj as any).payment_intent,
            paymentIntentIdField: (invoiceObj as any).payment_intent_id,
          })
        }
      }
      
      // Strategy 2: Wait a bit and retrieve the invoice again (payment intent might be created asynchronously)
      if (!paymentIntent) {
        console.log('[Create Subscription] Waiting 1s and retrieving invoice again...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        try {
          const refreshedInvoice = await stripe.invoices.retrieve(invoiceObj.id, {
            expand: ['payment_intent'],
          })
          paymentIntent = (refreshedInvoice as any).payment_intent as Stripe.PaymentIntent | string | null
          console.log('[Create Subscription] Retrieved invoice again, payment intent:', {
            hasPaymentIntent: !!paymentIntent,
            type: typeof paymentIntent,
          })
          if (paymentIntent) {
            invoiceObj = refreshedInvoice
          }
        } catch (retrieveError) {
          console.error('[Create Subscription] Error retrieving invoice again:', retrieveError)
        }
      }

      // Strategy 3: Check if subscription has payment intent directly
      if (!paymentIntent) {
        console.log('[Create Subscription] Checking subscription for payment intent...')
        try {
          const refreshedSubscription = await stripe.subscriptions.retrieve(subscription.id, {
            expand: ['latest_invoice.payment_intent'],
          })
          const refreshedInvoice = refreshedSubscription.latest_invoice
          if (refreshedInvoice && typeof refreshedInvoice === 'object' && 'id' in refreshedInvoice) {
            paymentIntent = (refreshedInvoice as any).payment_intent as Stripe.PaymentIntent | string | null
            console.log('[Create Subscription] Found payment intent on refreshed subscription:', {
              hasPaymentIntent: !!paymentIntent,
              type: typeof paymentIntent,
            })
            if (paymentIntent) {
              // Re-retrieve the invoice to ensure we have the correct type
              invoiceObj = await stripe.invoices.retrieve(refreshedInvoice.id, {
                expand: ['payment_intent'],
              })
            }
          }
        } catch (subscriptionError) {
          console.error('[Create Subscription] Error retrieving subscription:', subscriptionError)
        }
      }

      // Strategy 3: If still no payment intent, check if we can create one manually
      // This shouldn't be necessary, but as a last resort
      if (!paymentIntent && invoiceObj.amount_due > 0) {
        console.error('[Create Subscription] No payment intent found after all recovery strategies', {
          invoiceId: invoiceObj.id,
          invoiceStatus: invoiceObj.status,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          amountDue: invoiceObj.amount_due,
          currency: invoiceObj.currency,
        })
        return NextResponse.json(
          { 
            error: 'No payment intent found for invoice. The subscription may require additional payment setup.',
            details: 'Please try again or contact support if the issue persists.',
            subscriptionId: subscription.id,
            invoiceId: invoiceObj.id,
          },
          { status: 500 }
        )
      }
    }

    if (!paymentIntent) {
      console.error('[Create Subscription] No payment intent found after all attempts', {
        invoiceId: invoiceObj.id,
        invoiceStatus: invoiceObj.status,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      })
      
      // Cancel the incomplete subscription to prevent accumulation of incomplete payment intents
      try {
        console.log('[Create Subscription] Canceling incomplete subscription to clean up...')
        await stripe.subscriptions.cancel(subscription.id)
        console.log('[Create Subscription] Successfully canceled incomplete subscription')
      } catch (cancelError) {
        console.error('[Create Subscription] Error canceling subscription:', cancelError)
        // Continue with error response even if cancel fails
      }
      
      return NextResponse.json(
        { 
          error: 'No payment intent found for invoice. The subscription may require additional payment setup.',
          details: 'Please try again or contact support if the issue persists.',
        },
        { status: 500 }
      )
    }

    let clientSecret: string | null = null
    if (typeof paymentIntent === 'object' && paymentIntent?.client_secret) {
      clientSecret = paymentIntent.client_secret
      console.log('[Create Subscription] Got client secret from expanded payment intent:', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      })
    } else if (typeof paymentIntent === 'string') {
      // If it's just an ID, retrieve the payment intent explicitly
      try {
        console.log('[Create Subscription] Payment intent is string ID, retrieving...')
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
      console.error('[Create Subscription] No client secret found after all attempts', {
        paymentIntentType: typeof paymentIntent,
        paymentIntent: paymentIntent,
        invoiceId: invoiceObj.id,
        subscriptionId: subscription.id,
      })
      
      // Cancel the incomplete subscription to prevent accumulation of incomplete payment intents
      try {
        console.log('[Create Subscription] Canceling incomplete subscription (no client secret)...')
        await stripe.subscriptions.cancel(subscription.id)
        console.log('[Create Subscription] Successfully canceled incomplete subscription')
      } catch (cancelError) {
        console.error('[Create Subscription] Error canceling subscription:', cancelError)
        // Continue with error response even if cancel fails
      }
      
      return NextResponse.json(
        { error: 'Failed to get payment intent client secret' },
        { status: 500 }
      )
    }

    console.log('[Create Subscription] Successfully created subscription with client secret')

    // Immediately update database with subscription information (dual-write pattern)
    // Webhook will serve as reconciliation backup
    try {
      // Map Stripe subscription status to our enum
      const mapStatus = (stripeStatus: string): SubscriptionStatus => {
        const normalized = stripeStatus.toLowerCase().trim()
        switch (normalized) {
          case 'trialing':
            return 'trialing'
          case 'active':
            return 'active'
          case 'past_due':
            return 'past_due'
          case 'canceled':
          case 'unpaid':
          case 'incomplete':
          case 'incomplete_expired':
            return 'canceled'
          default:
            return 'active'
        }
      }
      
      // Format Stripe timestamp to date string (YYYY-MM-DD)
      const formatDate = (timestamp: number | null | undefined): string | undefined => {
        if (!timestamp) return undefined
        const date = new Date(timestamp * 1000) // Stripe timestamps are in seconds
        return date.toISOString().split('T')[0] // Format as YYYY-MM-DD
      }
      
      const status = mapStatus(subscription.status)
      // Access period dates safely - they are numbers (Unix timestamps) on Stripe.Subscription
      const periodStart = formatDate((subscription as any).current_period_start)
      const periodEnd = formatDate((subscription as any).current_period_end)
      
      // Use syncSubscriptionSnapshot instead of deprecated assignSubscription
      // This properly handles incomplete subscriptions and payment status
      const { syncSubscriptionSnapshot } = await import('@/lib/billing/subscription-sync')
      await syncSubscriptionSnapshot(subscription, { userId: user.id })
      
      console.log('[Create Subscription] Successfully synced subscription to database', {
        userId: user.id,
        planSlug,
        billingCycle,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
      })
    } catch (assignError) {
      console.error('[Create Subscription] Error assigning subscription to database:', assignError)
      // Don't fail the request - webhook will handle it as backup
    }

    return NextResponse.json(
      {
        subscriptionId: subscription.id,
        clientSecret,
        status: subscription.status,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Create Subscription] Error creating subscription:', error)

    // If we created a subscription but then hit an error, try to clean it up
    // This prevents accumulation of incomplete subscriptions/payment intents
    if (subscription?.id && stripe) {
      try {
        console.log('[Create Subscription] Error occurred, attempting to cancel subscription for cleanup...')
        await stripe.subscriptions.cancel(subscription.id)
        console.log('[Create Subscription] Successfully canceled subscription after error')
      } catch (cancelError) {
        console.error('[Create Subscription] Error canceling subscription after error:', cancelError)
        // Continue with error response even if cancel fails
      }
    }

    // Handle Stripe-specific errors with better messages
    if (error instanceof Stripe.errors.StripeError) {
      let errorMessage = error.message
      let userFriendlyMessage = error.message

      // Handle specific Stripe error types
      if (error.type === 'StripeInvalidRequestError') {
        if (error.message.includes('No such price')) {
          userFriendlyMessage = `Configuration error: The selected plan is not properly configured. Please contact support.`
          console.error('[Create Subscription] Invalid price ID error:', {
            message: error.message,
            planSlug: planSlug || 'unknown',
            billingCycle: billingCycle || 'unknown',
            priceId: priceId || 'unknown',
          })
        } else if (error.message.includes('No such customer')) {
          userFriendlyMessage = `Payment configuration error. Please try again or contact support.`
        } else if (error.message.includes('No such payment_method')) {
          userFriendlyMessage = `Payment method error. Please try again with a different payment method.`
        }
      } else if (error.type === 'StripeCardError') {
        userFriendlyMessage = error.message || 'Payment failed. Please check your card details and try again.'
      } else if (error.type === 'StripeRateLimitError') {
        userFriendlyMessage = 'Too many requests. Please wait a moment and try again.'
      } else if (error.type === 'StripeAPIError') {
        userFriendlyMessage = 'Payment service temporarily unavailable. Please try again in a moment.'
      }

      return NextResponse.json(
        { 
          error: userFriendlyMessage,
          details: error.type === 'StripeInvalidRequestError' && error.message.includes('No such price')
            ? `The price ID '${error.message.match(/price_[^\s']+/)?.[0] || 'unknown'}' does not exist in Stripe. This is a server configuration issue.`
            : undefined
        },
        { status: 500 }
      )
    }

    // Handle other errors
    const message = (error as Error)?.message ?? 'Unexpected server error creating subscription.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

