/**
 * Stripe account deletion cleanup
 * Handles idempotent cancellation of subscriptions, detachment of payment methods,
 * and deletion of Stripe customers with retry logic and safe re-entry.
 */

import Stripe from 'stripe'
import { stripeWithRetry } from './retry'
import { serverLogger } from '@/lib/logger/server'

export interface StripeCleanupResult {
  success: boolean
  subscriptionsCanceled: number
  paymentMethodsDetached: number
  customerDeleted: boolean
  errors: Array<{ step: string; error: string }>
}

/**
 * Check if a Stripe error indicates the resource is already deleted or not found
 */
function isNotFoundOrDeletedError(error: unknown): boolean {
  if (!error) return false

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('no such customer') ||
      message.includes('customer does not exist') ||
      message.includes('already been deleted') ||
      message.includes('not found')
    )
  }

  // Check for Stripe API errors
  if (typeof error === 'object' && 'type' in error) {
    const errorType = String((error as { type?: string }).type).toLowerCase()
    return errorType === 'invalid_request_error' || errorType === 'resource_missing'
  }

  return false
}

/**
 * Check if a Stripe error indicates the resource is already in the desired state
 */
function isAlreadyInDesiredStateError(error: unknown): boolean {
  if (!error) return false

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('already canceled') ||
      message.includes('already deleted') ||
      message.includes('already detached')
    )
  }

  return false
}

/**
 * Cancel all subscriptions for a Stripe customer
 * Idempotent: skips already canceled subscriptions
 */
async function cancelAllSubscriptions(
  stripe: Stripe,
  customerId: string
): Promise<{ canceled: number; errors: Array<{ subscriptionId: string; error: string }> }> {
  const errors: Array<{ subscriptionId: string; error: string }> = []
  let canceled = 0

  try {
    // List all subscriptions for the customer
    const subscriptions = await stripeWithRetry(() =>
      stripe.subscriptions.list({
        customer: customerId,
        limit: 100,
      })
    )

    for (const subscription of subscriptions.data) {
      // Skip if already canceled
      if (subscription.status === 'canceled') {
        serverLogger.debug('Subscription already canceled, skipping', {
          subscriptionId: subscription.id,
          customerId,
        })
        continue
      }

      try {
        // Cancel subscription immediately
        await stripeWithRetry(() => stripe.subscriptions.cancel(subscription.id))
        canceled++
        serverLogger.info('Subscription canceled', {
          subscriptionId: subscription.id,
          customerId,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // If already canceled or not found, treat as success
        if (isNotFoundOrDeletedError(error) || isAlreadyInDesiredStateError(error)) {
          canceled++
          serverLogger.info('Subscription already canceled or not found, treating as success', {
            subscriptionId: subscription.id,
            customerId,
            error: errorMessage,
          })
        } else {
          errors.push({ subscriptionId: subscription.id, error: errorMessage })
          serverLogger.error('Failed to cancel subscription', {
            subscriptionId: subscription.id,
            customerId,
            error: errorMessage,
          })
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    serverLogger.error('Failed to list subscriptions', {
      customerId,
      error: errorMessage,
    })
    // Don't throw - return partial results
  }

  return { canceled, errors }
}

/**
 * Detach all payment methods from a Stripe customer
 * Idempotent: skips already detached payment methods
 */
async function detachAllPaymentMethods(
  stripe: Stripe,
  customerId: string
): Promise<{ detached: number; errors: Array<{ paymentMethodId: string; error: string }> }> {
  const errors: Array<{ paymentMethodId: string; error: string }> = []
  let detached = 0

  try {
    // List all payment methods for the customer
    const paymentMethods = await stripeWithRetry(() =>
      stripe.paymentMethods.list({
        customer: customerId,
        limit: 100,
      })
    )

    for (const paymentMethod of paymentMethods.data) {
      try {
        // Detach payment method
        await stripeWithRetry(() => stripe.paymentMethods.detach(paymentMethod.id))
        detached++
        serverLogger.info('Payment method detached', {
          paymentMethodId: paymentMethod.id,
          customerId,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // If already detached or not found, treat as success
        if (isNotFoundOrDeletedError(error) || isAlreadyInDesiredStateError(error)) {
          detached++
          serverLogger.info('Payment method already detached or not found, treating as success', {
            paymentMethodId: paymentMethod.id,
            customerId,
            error: errorMessage,
          })
        } else {
          errors.push({ paymentMethodId: paymentMethod.id, error: errorMessage })
          serverLogger.error('Failed to detach payment method', {
            paymentMethodId: paymentMethod.id,
            customerId,
            error: errorMessage,
          })
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    serverLogger.error('Failed to list payment methods', {
      customerId,
      error: errorMessage,
    })
    // Don't throw - return partial results
  }

  return { detached, errors }
}

/**
 * Delete a Stripe customer (tombstone)
 * Idempotent: checks if customer is already deleted before attempting deletion
 */
async function deleteCustomer(
  stripe: Stripe,
  customerId: string
): Promise<{ deleted: boolean; error?: string }> {
  try {
    // First, check if customer is already deleted
    const customer = await stripeWithRetry(() => stripe.customers.retrieve(customerId))
    
    // Handle expanded customer object
    if (typeof customer === 'object' && 'deleted' in customer) {
      if (customer.deleted) {
        serverLogger.info('Customer already deleted, skipping', { customerId })
        return { deleted: true }
      }
    }

    // Delete the customer
    await stripeWithRetry(() => stripe.customers.del(customerId))
    serverLogger.info('Customer deleted', { customerId })
    return { deleted: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // If customer is already deleted or not found, treat as success
    if (isNotFoundOrDeletedError(error)) {
      serverLogger.info('Customer already deleted or not found, treating as success', {
        customerId,
        error: errorMessage,
      })
      return { deleted: true }
    }

    serverLogger.error('Failed to delete customer', {
      customerId,
      error: errorMessage,
    })
    return { deleted: false, error: errorMessage }
  }
}

/**
 * Clean up all Stripe billing data for a user
 * This function is idempotent and can be safely re-run
 * 
 * Order of operations:
 * 1. Cancel all subscriptions (prevents new charges)
 * 2. Detach all payment methods (removes payment capability)
 * 3. Delete customer (tombstone, auto-detaches remaining payment methods)
 * 
 * @param stripe - Stripe client instance
 * @param customerId - Stripe customer ID to clean up
 * @returns Result object with success status and counts
 */
export async function cleanupStripeBillingData(
  stripe: Stripe,
  customerId: string
): Promise<StripeCleanupResult> {
  const result: StripeCleanupResult = {
    success: false,
    subscriptionsCanceled: 0,
    paymentMethodsDetached: 0,
    customerDeleted: false,
    errors: [],
  }

  serverLogger.info('Starting Stripe billing data cleanup', { customerId })

  // Step 1: Cancel all subscriptions
  serverLogger.info('Canceling subscriptions', { customerId })
  const subscriptionResult = await cancelAllSubscriptions(stripe, customerId)
  result.subscriptionsCanceled = subscriptionResult.canceled
  subscriptionResult.errors.forEach(err => {
    result.errors.push({ step: 'subscription_cancel', error: `${err.subscriptionId}: ${err.error}` })
  })

  // Step 2: Detach all payment methods
  serverLogger.info('Detaching payment methods', { customerId })
  const paymentMethodResult = await detachAllPaymentMethods(stripe, customerId)
  result.paymentMethodsDetached = paymentMethodResult.detached
  paymentMethodResult.errors.forEach(err => {
    result.errors.push({ step: 'payment_method_detach', error: `${err.paymentMethodId}: ${err.error}` })
  })

  // Step 3: Delete customer (this also auto-detaches any remaining payment methods)
  serverLogger.info('Deleting customer', { customerId })
  const customerResult = await deleteCustomer(stripe, customerId)
  result.customerDeleted = customerResult.deleted
  if (customerResult.error) {
    result.errors.push({ step: 'customer_delete', error: customerResult.error })
  }

  // Consider cleanup successful if customer is deleted, even if some subscriptions/payment methods had errors
  // (they may have been cleaned up by customer deletion)
  result.success = result.customerDeleted

  serverLogger.info('Stripe billing data cleanup completed', {
    customerId,
    success: result.success,
    subscriptionsCanceled: result.subscriptionsCanceled,
    paymentMethodsDetached: result.paymentMethodsDetached,
    customerDeleted: result.customerDeleted,
    errorCount: result.errors.length,
  })

  return result
}

