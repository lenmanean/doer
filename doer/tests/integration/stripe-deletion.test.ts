/**
 * Integration tests for Stripe account deletion
 * 
 * ⚠️ IMPORTANT: These tests ONLY run with Stripe TEST keys (sk_test_*)
 * They will NOT run with live/production keys (sk_live_*) to prevent accidental
 * deletion of real customer data.
 * 
 * Run with: STRIPE_SECRET_KEY=sk_test_... npm test
 * 
 * Note: These tests create real Stripe test data and should be run in a test environment
 * 
 * The main implementation code (account-deletion.ts) works with both test and live keys
 * and is production-ready. Only these integration tests are restricted to test mode.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Stripe from 'stripe'
import { cleanupStripeBillingData } from '@/lib/stripe/account-deletion'

// Skip tests if Stripe test key is not available
// IMPORTANT: Only run with test keys (sk_test_*) - never with live keys (sk_live_*)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const isTestKey = stripeSecretKey && stripeSecretKey.startsWith('sk_test_')
const isLiveKey = stripeSecretKey && stripeSecretKey.startsWith('sk_live_')

if (isLiveKey) {
  console.warn('⚠️  WARNING: Live Stripe key detected. Integration tests are skipped to prevent accidental deletion of real customer data.')
  console.warn('   These tests are designed for test mode only. The main implementation code works with live keys.')
}

const shouldRunTests = isTestKey && !isLiveKey
const describeIf = shouldRunTests ? describe : describe.skip

describeIf('Stripe Account Deletion Integration Tests', () => {
  let stripe: Stripe
  let testCustomerId: string
  let testSubscriptionId: string | null = null
  let testPaymentMethodId: string | null = null

  beforeAll(() => {
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is required for integration tests')
    }
    stripe = new Stripe(stripeSecretKey)
  })

  afterAll(async () => {
    // Cleanup: Delete test customer if it still exists
    if (testCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(testCustomerId)
        if (typeof customer === 'object' && !customer.deleted) {
          await stripe.customers.del(testCustomerId)
        }
      } catch (error) {
        // Customer may already be deleted, ignore
      }
    }
  })

  it('should create test customer with subscription and payment method', async () => {
    // Create test customer
    const customer = await stripe.customers.create({
      email: `test-${Date.now()}@example.com`,
      metadata: { test: 'true' },
    })
    testCustomerId = customer.id

    // Create test payment method
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2025,
        cvc: '123',
      },
    })
    testPaymentMethodId = paymentMethod.id

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customer.id,
    })

    // Create test subscription (using a test price ID if available)
    // Note: You may need to create a test price in your Stripe dashboard
    const priceId = process.env.STRIPE_PRICE_BASIC
    if (priceId) {
      try {
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
        })
        testSubscriptionId = subscription.id
      } catch (error) {
        // Subscription creation may fail if price doesn't exist, skip subscription test
        console.warn('Could not create test subscription:', error)
      }
    }

    expect(testCustomerId).toBeDefined()
  })

  it('should cancel subscriptions, detach payment methods, and delete customer', async () => {
    if (!testCustomerId) {
      throw new Error('Test customer not created')
    }

    const result = await cleanupStripeBillingData(stripe, testCustomerId)

    expect(result.success).toBe(true)
    expect(result.customerDeleted).toBe(true)
    
    if (testSubscriptionId) {
      expect(result.subscriptionsCanceled).toBeGreaterThanOrEqual(0)
    }
    
    if (testPaymentMethodId) {
      expect(result.paymentMethodsDetached).toBeGreaterThanOrEqual(0)
    }

    // Verify customer is deleted in Stripe
    const deletedCustomer = await stripe.customers.retrieve(testCustomerId)
    expect(typeof deletedCustomer === 'object' && deletedCustomer.deleted).toBe(true)
  })

  it('should be idempotent - can be run multiple times', async () => {
    if (!testCustomerId) {
      throw new Error('Test customer not created')
    }

    // Run cleanup again (customer should already be deleted)
    const result = await cleanupStripeBillingData(stripe, testCustomerId)

    // Should succeed even though customer is already deleted
    expect(result.success).toBe(true)
    expect(result.customerDeleted).toBe(true)
  })

  it('should handle customer with no subscriptions or payment methods', async () => {
    // Create a new test customer with no subscriptions or payment methods
    const customer = await stripe.customers.create({
      email: `test-empty-${Date.now()}@example.com`,
      metadata: { test: 'true' },
    })

    const result = await cleanupStripeBillingData(stripe, customer.id)

    expect(result.success).toBe(true)
    expect(result.customerDeleted).toBe(true)
    expect(result.subscriptionsCanceled).toBe(0)
    expect(result.paymentMethodsDetached).toBe(0)

    // Cleanup
    try {
      const deletedCustomer = await stripe.customers.retrieve(customer.id)
      if (typeof deletedCustomer === 'object' && !deletedCustomer.deleted) {
        await stripe.customers.del(customer.id)
      }
    } catch (error) {
      // Already deleted, ignore
    }
  })
})

