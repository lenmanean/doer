import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'
import { subscriptionCache } from '@/lib/cache/subscription-cache'
import { syncSubscriptionSnapshot } from '@/lib/billing/subscription-sync'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Only initialize Stripe if secret key is available (allows build to succeed)
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * Extracts customer ID from Stripe subscription object
 * Customer can be a string ID or a Customer object
 */
function extractCustomerId(subscription: Stripe.Subscription | Stripe.Checkout.Session): string | null {
  if (typeof subscription.customer === 'string') {
    return subscription.customer
  }
  if (subscription.customer && typeof subscription.customer === 'object' && 'id' in subscription.customer) {
    return subscription.customer.id
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
  }

  if (!webhookSecret) {
    return NextResponse.json({ success: false, error: 'Webhook secret not configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ success: false, error: 'Missing Stripe signature header' }, { status: 400 })
  }

  const payload = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    logger.error('Stripe webhook invalid signature', error as Error)
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const stripeCustomerId = extractCustomerId(session)
        
        // Extract user ID from metadata
        const userId = session.metadata?.userId
        
        if (!userId) {
          logger.warn('Missing userId in checkout session metadata', { sessionId: session.id })
          break
        }

        // Invalidate cache for this user
        subscriptionCache.invalidateUser(userId)

        // Update user_settings.stripe_customer_id (needed for Stripe lookups)
        if (stripeCustomerId) {
          const supabase = getServiceRoleClient()
          await supabase
            .from('user_settings')
            .upsert({
              user_id: userId,
              stripe_customer_id: stripeCustomerId,
            }, {
              onConflict: 'user_id',
            })
          logger.info('Updated stripe_customer_id', { userId, stripeCustomerId })
        }
        
        if (session.subscription && typeof session.subscription === 'string') {
          try {
            const subscription = await stripe!.subscriptions.retrieve(session.subscription)
            await syncSubscriptionSnapshot(subscription, { userId })
          } catch (syncError) {
            logger.error('Failed to sync subscription after checkout', syncError as Error, {
              userId,
              sessionId: session.id,
              subscriptionId: session.subscription,
            })
          }
        } else {
          logger.warn('Checkout session missing subscription reference', { sessionId: session.id })
        }
        
        logger.info('Checkout completed - subscription snapshot updated', { userId })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Skip processing if subscription is canceled - we handle deletions separately
        // This prevents race conditions where a canceled subscription gets re-synced as active
        if (subscription.status === 'canceled' || subscription.cancel_at_period_end) {
          logger.info('Skipping sync for canceled subscription', {
            subscriptionId: subscription.id,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          })
          break
        }
        
        const stripeCustomerId = extractCustomerId(subscription)
        let userId = subscription.metadata?.userId
        
        // Fallback: If userId is missing from subscription metadata, try to get it from customer metadata or user_settings
        if (!userId && stripeCustomerId && stripe) {
          try {
            const customer = await stripe.customers.retrieve(stripeCustomerId)
            // Check if customer is not deleted and has metadata
            if (customer && typeof customer !== 'string' && !customer.deleted && 'metadata' in customer && customer.metadata?.userId) {
              userId = customer.metadata.userId as string
            } else {
              // Try to find userId from user_settings by stripe_customer_id
              const supabase = getServiceRoleClient()
              const { data: userSettings } = await supabase
                .from('user_settings')
                .select('user_id')
                .eq('stripe_customer_id', stripeCustomerId)
                .maybeSingle()
              
              if (userSettings?.user_id) {
                userId = userSettings.user_id
              }
            }
          } catch (lookupError) {
            logger.warn('Failed to lookup userId from customer', {
              error: lookupError instanceof Error ? lookupError.message : String(lookupError),
              stripeCustomerId,
              subscriptionId: subscription.id,
            })
          }
        }
        
        // Update stripe_customer_id if we have it
        if (stripeCustomerId && userId) {
          const supabase = getServiceRoleClient()
          await supabase
            .from('user_settings')
            .upsert({
              user_id: userId,
              stripe_customer_id: stripeCustomerId,
            }, {
              onConflict: 'user_id',
            })
        }
        
        // Invalidate cache for this user
        if (userId) {
          subscriptionCache.invalidateUser(userId)
        }

        if (userId) {
          try {
            await syncSubscriptionSnapshot(subscription, { userId })
          } catch (syncError) {
            logger.error('Failed to sync subscription snapshot from webhook', syncError as Error, {
              userId,
              subscriptionId: subscription.id,
            })
          }
        } else {
          logger.warn('Subscription event missing userId metadata', { 
            subscriptionId: subscription.id,
            stripeCustomerId,
            hasMetadata: !!subscription.metadata,
          })
        }
        
        logger.info('Subscription updated/created - snapshot stored', {
          subscriptionId: subscription.id,
          status: subscription.status,
          userId,
        })
        break
      }

      case 'customer.subscription.deleted': {
        // Subscription deleted - no action needed, we query Stripe directly
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.userId
        if (userId) {
          subscriptionCache.invalidateUser(userId)
        }
        logger.info('Subscription deleted - will be reflected in Stripe queries', {
          subscriptionId: subscription.id,
        })
        break
      }

      case 'invoice.payment_failed': {
        // Payment failed - no action needed, we query Stripe directly
        const invoice = event.data.object as Stripe.Invoice
        logger.warn('Payment failed - will be reflected in Stripe queries', {
          invoiceId: invoice.id,
        })
        break
      }

      case 'invoice.payment_succeeded': {
        // Payment succeeded - sync the subscription to ensure it's up to date
        const invoice = event.data.object as Stripe.Invoice
        // Invoice.subscription can be a string ID or an expanded Subscription object
        // Access subscription using type assertion since it may not be in the type definition
        const invoiceSubscription = (invoice as any).subscription
        const subscriptionId = invoiceSubscription
          ? (typeof invoiceSubscription === 'string' 
            ? invoiceSubscription 
            : (invoiceSubscription as Stripe.Subscription).id)
          : null
        
        if (subscriptionId && stripe) {
          try {
            // Retrieve the subscription to get the latest state
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            let userId = subscription.metadata?.userId
            
            // Fallback: If userId is missing from subscription metadata, try to get it from customer
            if (!userId) {
              const stripeCustomerId = extractCustomerId(subscription)
              if (stripeCustomerId) {
                try {
                  const customer = await stripe.customers.retrieve(stripeCustomerId)
                  // Check if customer is not deleted and has metadata
                  if (customer && typeof customer !== 'string' && !customer.deleted && 'metadata' in customer && customer.metadata?.userId) {
                    userId = customer.metadata.userId as string
                  } else {
                    // Try to find userId from user_settings by stripe_customer_id
                    const supabase = getServiceRoleClient()
                    const { data: userSettings } = await supabase
                      .from('user_settings')
                      .select('user_id')
                      .eq('stripe_customer_id', stripeCustomerId)
                      .maybeSingle()
                    
                    if (userSettings?.user_id) {
                      userId = userSettings.user_id
                    }
                  }
                } catch (lookupError) {
                  logger.warn('Failed to lookup userId from customer after payment', {
                    error: lookupError instanceof Error ? lookupError.message : String(lookupError),
                    stripeCustomerId,
                    subscriptionId: subscription.id,
                  })
                }
              }
            }
            
            if (userId) {
              // Invalidate cache for this user
              subscriptionCache.invalidateUser(userId)
              
              // Sync the subscription snapshot
              await syncSubscriptionSnapshot(subscription, { userId })
              
              logger.info('Payment succeeded - subscription synced', {
                subscriptionId: subscription.id,
                status: subscription.status,
                userId,
              })
            } else {
              logger.warn('Payment succeeded but subscription missing userId metadata', {
                subscriptionId: subscription.id,
                invoiceId: invoice.id,
                hasMetadata: !!subscription.metadata,
              })
            }
          } catch (syncError) {
            logger.error('Failed to sync subscription after payment succeeded', syncError as Error, {
              subscriptionId,
              invoiceId: invoice.id,
            })
          }
        } else {
          logger.warn('Payment succeeded but invoice missing subscription reference', {
            invoiceId: invoice.id,
          })
        }
        break
      }

      default:
        logger.debug('Unhandled event type', { eventType: event.type })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Stripe webhook handler error', error as Error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}



