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

/**
 * Check if a Stripe customer is deleted and if the corresponding user exists in DOER
 * Returns { customerDeleted: boolean, userExists: boolean, userId: string | null }
 */
async function checkCustomerAndUserStatus(
  stripe: Stripe | null,
  stripeCustomerId: string | null
): Promise<{ customerDeleted: boolean; userExists: boolean; userId: string | null }> {
  if (!stripe || !stripeCustomerId) {
    return { customerDeleted: false, userExists: false, userId: null }
  }

  try {
    // Check if customer is deleted in Stripe
    const customer = await stripe.customers.retrieve(stripeCustomerId)
    const customerDeleted = typeof customer === 'object' && 'deleted' in customer && customer.deleted === true

    // Check if user exists in DOER
    const supabase = getServiceRoleClient()
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle()

    const userId = userSettings?.user_id || null
    const userExists = !!userId

    return { customerDeleted, userExists, userId }
  } catch (error) {
    // If customer retrieval fails, assume not deleted (might be a different error)
    // But still check if user exists
    const supabase = getServiceRoleClient()
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle()

    const userId = userSettings?.user_id || null
    const userExists = !!userId

    return { customerDeleted: false, userExists, userId }
  }
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
        
        // Check if customer is deleted (shouldn't happen for new checkout, but handle gracefully)
        if (stripeCustomerId) {
          const { customerDeleted, userExists } = await checkCustomerAndUserStatus(stripe, stripeCustomerId)
          if (customerDeleted) {
            logger.info('Ignoring checkout.session.completed for deleted customer', {
              sessionId: session.id,
              stripeCustomerId,
            })
            break
          }
        }
        
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
            logger.error('Failed to sync subscription after checkout', {
              error: syncError instanceof Error ? syncError.message : String(syncError),
              errorStack: syncError instanceof Error ? syncError.stack : undefined,
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

      case 'customer.subscription.trial_will_end': {
        // Trial is about to end - notify user or prepare for transition
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.userId
        
        if (userId) {
          subscriptionCache.invalidateUser(userId)
          logger.info('Trial will end soon', {
            subscriptionId: subscription.id,
            userId,
            trialEnd: (subscription as any).trial_end,
          })
          
          // Sync subscription to ensure database is up to date
          try {
            await syncSubscriptionSnapshot(subscription, { userId })
          } catch (syncError) {
            logger.error('Failed to sync subscription on trial_will_end', {
              error: syncError instanceof Error ? syncError.message : String(syncError),
              subscriptionId: subscription.id,
              userId,
            })
          }
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Skip processing if subscription is canceled - we handle deletions separately
        // This prevents race conditions where a canceled subscription gets re-synced as active
        // However, we should still process trialing subscriptions even if they're set to cancel at period end
        if (subscription.status === 'canceled') {
          logger.info('Skipping sync for canceled subscription', {
            subscriptionId: subscription.id,
            status: subscription.status,
          })
          break
        }
        
        // For subscriptions that are set to cancel at period end but are still active/trialing,
        // we still want to sync them (they're still active until the period ends)
        if (subscription.cancel_at_period_end && subscription.status !== 'trialing' && subscription.status !== 'active') {
          logger.info('Skipping sync for subscription set to cancel (not active/trialing)', {
            subscriptionId: subscription.id,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          })
          break
        }
        
        const stripeCustomerId = extractCustomerId(subscription)
        
        // Check if customer is deleted - if so, ignore webhook
        if (stripeCustomerId) {
          const { customerDeleted, userExists, userId: checkedUserId } = await checkCustomerAndUserStatus(stripe, stripeCustomerId)
          if (customerDeleted) {
            logger.info('Ignoring subscription event for deleted customer', {
              subscriptionId: subscription.id,
              stripeCustomerId,
              eventType: event.type,
            })
            break
          }
          // If user doesn't exist but customer isn't deleted, log inconsistency
          if (!userExists && checkedUserId === null) {
            logger.warn('Subscription event for customer with no user in DOER', {
              subscriptionId: subscription.id,
              stripeCustomerId,
              eventType: event.type,
            })
            // Continue processing in case user was just created
          }
        }
        
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
            logger.error('Failed to sync subscription snapshot from webhook', {
              error: syncError instanceof Error ? syncError.message : String(syncError),
              errorStack: syncError instanceof Error ? syncError.stack : undefined,
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
            const stripeCustomerId = extractCustomerId(subscription)
            
            // Check if customer is deleted - if so, ignore webhook
            if (stripeCustomerId) {
              const { customerDeleted } = await checkCustomerAndUserStatus(stripe, stripeCustomerId)
              if (customerDeleted) {
                logger.info('Ignoring invoice.payment_succeeded for deleted customer', {
                  subscriptionId: subscription.id,
                  invoiceId: invoice.id,
                  stripeCustomerId,
                })
                break
              }
            }
            
            let userId = subscription.metadata?.userId
            
            // Fallback: If userId is missing from subscription metadata, try to get it from customer
            if (!userId) {
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
            logger.error('Failed to sync subscription after payment succeeded', {
              error: syncError instanceof Error ? syncError.message : String(syncError),
              errorStack: syncError instanceof Error ? syncError.stack : undefined,
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

      case 'customer.subscription.deleted': {
        // Subscription deleted event - clean up customer if no other subscriptions remain
        // This handles cleanup for customers whose subscriptions ended after account deletion
        const subscription = event.data.object as Stripe.Subscription
        const stripeCustomerId = extractCustomerId(subscription)
        
        logger.info('Subscription deleted event received', {
          subscriptionId: subscription.id,
          stripeCustomerId,
        })
        
        if (!stripeCustomerId || !stripe) {
          logger.warn('Subscription deleted event missing customer ID or Stripe client', {
            subscriptionId: subscription.id,
          })
          break
        }
        
        try {
          // Check if customer has any other active subscriptions
          const remainingSubscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'all',
            limit: 100,
          })
          
          // Filter out the subscription that just ended
          const activeSubscriptions = remainingSubscriptions.data.filter(
            sub => sub.id !== subscription.id && 
                   (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due')
          )
          
          if (activeSubscriptions.length === 0) {
            // No active subscriptions remaining - safe to delete customer
            // This cleans up customers after account deletion when their subscriptions end
            logger.info('No active subscriptions remaining, cleaning up customer', {
              stripeCustomerId,
              subscriptionId: subscription.id,
            })
            
            try {
              // Check if customer is already deleted
              const customer = await stripe.customers.retrieve(stripeCustomerId)
              if (typeof customer === 'object' && 'deleted' in customer && customer.deleted) {
                logger.info('Customer already deleted', { stripeCustomerId })
              } else {
                // Delete the customer
                await stripe.customers.del(stripeCustomerId)
                logger.info('Customer deleted after subscription ended', {
                  stripeCustomerId,
                  subscriptionId: subscription.id,
                })
                
                // Update audit log if record exists
                const supabase = getServiceRoleClient()
                const { data: userSettings } = await supabase
                  .from('user_settings')
                  .select('user_id')
                  .eq('stripe_customer_id', stripeCustomerId)
                  .maybeSingle()
                
                if (userSettings?.user_id) {
                  await supabase
                    .from('account_deletion_audit')
                    .update({
                      stripe_cleanup_status: 'completed',
                      customer_deleted: true,
                    })
                    .eq('user_id', userSettings.user_id)
                    .eq('stripe_customer_id', stripeCustomerId)
                  
                  logger.info('Updated audit log for customer deletion after subscription end', {
                    userId: userSettings.user_id,
                    stripeCustomerId,
                  })
                }
              }
            } catch (deleteError) {
              logger.error('Failed to delete customer after subscription end', {
                error: deleteError instanceof Error ? deleteError.message : String(deleteError),
                stripeCustomerId,
                subscriptionId: subscription.id,
              })
              // Don't throw - this is cleanup, not critical
            }
          } else {
            logger.info('Customer has other active subscriptions, skipping cleanup', {
              stripeCustomerId,
              activeSubscriptionCount: activeSubscriptions.length,
            })
          }
        } catch (error) {
          logger.error('Error checking subscriptions for customer cleanup', {
            error: error instanceof Error ? error.message : String(error),
            stripeCustomerId,
            subscriptionId: subscription.id,
          })
          // Don't throw - this is cleanup, not critical
        }
        break
      }

      case 'customer.deleted': {
        // Customer deleted event - update audit log if record exists
        const customer = event.data.object as Stripe.Customer
        const stripeCustomerId = customer.id
        
        logger.info('Customer deleted event received', {
          stripeCustomerId,
        })
        
        // Try to find user by stripe_customer_id and update audit log
        const supabase = getServiceRoleClient()
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('user_id')
          .eq('stripe_customer_id', stripeCustomerId)
          .maybeSingle()
        
        if (userSettings?.user_id) {
          // Update audit log if record exists
          await supabase
            .from('account_deletion_audit')
            .update({
              stripe_cleanup_status: 'completed',
              customer_deleted: true,
            })
            .eq('user_id', userSettings.user_id)
            .eq('stripe_customer_id', stripeCustomerId)
          
          // Invalidate cache
          subscriptionCache.invalidateUser(userSettings.user_id)
          
          logger.info('Updated audit log for customer deletion', {
            userId: userSettings.user_id,
            stripeCustomerId,
          })
        } else {
          logger.warn('Customer deleted event for unknown user', {
            stripeCustomerId,
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



