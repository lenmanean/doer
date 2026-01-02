/**
 * Unit tests for Stripe account deletion cleanup
 * Tests idempotency, error handling, and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import Stripe from 'stripe'
import { cleanupStripeBillingData } from '@/lib/stripe/account-deletion'

// Mock Stripe client
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: {
        list: vi.fn(),
        cancel: vi.fn(),
      },
      paymentMethods: {
        list: vi.fn(),
        detach: vi.fn(),
      },
      customers: {
        retrieve: vi.fn(),
        del: vi.fn(),
      },
    })),
  }
})

// Mock logger
vi.mock('@/lib/logger/server', () => ({
  serverLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock retry utility
vi.mock('@/lib/stripe/retry', () => ({
  stripeWithRetry: vi.fn((fn) => fn()),
}))

describe('cleanupStripeBillingData', () => {
  let mockStripe: any
  const customerId = 'cus_test123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe = new Stripe('sk_test_123')
  })

  describe('Idempotency', () => {
    it('should skip already deleted customer', async () => {
      // Customer already deleted
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: true,
      })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      expect(result.success).toBe(true)
      expect(result.customerDeleted).toBe(true)
      expect(mockStripe.subscriptions.list).not.toHaveBeenCalled()
      expect(mockStripe.paymentMethods.list).not.toHaveBeenCalled()
      expect(mockStripe.customers.del).not.toHaveBeenCalled()
    })

    it('should skip already canceled subscriptions', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({
        data: [
          { id: 'sub_1', status: 'canceled' },
          { id: 'sub_2', status: 'canceled' },
        ],
      })
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] })
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      expect(result.success).toBe(true)
      expect(result.subscriptionsCanceled).toBe(0)
      expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled()
    })
  })

  describe('Multiple Subscriptions', () => {
    it('should cancel all active subscriptions', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({
        data: [
          { id: 'sub_1', status: 'active' },
          { id: 'sub_2', status: 'trialing' },
          { id: 'sub_3', status: 'past_due' },
        ],
      })
      mockStripe.subscriptions.cancel.mockResolvedValue({ id: 'sub_1', status: 'canceled' })
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] })
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      expect(result.subscriptionsCanceled).toBe(3)
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(true)
    })

    it('should continue if one subscription cancellation fails', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({
        data: [
          { id: 'sub_1', status: 'active' },
          { id: 'sub_2', status: 'active' },
        ],
      })
      mockStripe.subscriptions.cancel
        .mockResolvedValueOnce({ id: 'sub_1', status: 'canceled' })
        .mockRejectedValueOnce(new Error('Network error'))
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] })
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      expect(result.subscriptionsCanceled).toBe(1)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.success).toBe(true) // Customer deletion succeeded
    })
  })

  describe('Payment Method Detachment', () => {
    it('should detach all payment methods', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({ data: [] })
      mockStripe.paymentMethods.list.mockResolvedValue({
        data: [
          { id: 'pm_1' },
          { id: 'pm_2' },
        ],
      })
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: 'pm_1', customer: null })
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      expect(result.paymentMethodsDetached).toBe(2)
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledTimes(2)
    })

    it('should handle already detached payment methods', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({ data: [] })
      mockStripe.paymentMethods.list.mockResolvedValue({
        data: [{ id: 'pm_1' }],
      })
      mockStripe.paymentMethods.detach.mockRejectedValue(
        new Error('Payment method already detached')
      )
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      // Should treat already detached as success
      expect(result.paymentMethodsDetached).toBe(1)
      expect(result.success).toBe(true)
    })
  })

  describe('Customer Deletion', () => {
    it('should delete customer successfully', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({ data: [] })
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] })
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      expect(result.customerDeleted).toBe(true)
      expect(result.success).toBe(true)
      expect(mockStripe.customers.del).toHaveBeenCalledWith(customerId)
    })

    it('should handle customer not found error', async () => {
      mockStripe.customers.retrieve.mockRejectedValue(
        new Error('No such customer: cus_test123')
      )

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      // Should treat not found as success (already deleted)
      expect(result.customerDeleted).toBe(true)
      expect(result.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockRejectedValue(new Error('Rate limit exceeded'))
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] })
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      // Customer deletion should still succeed
      expect(result.customerDeleted).toBe(true)
      expect(result.success).toBe(true)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should return partial success if customer deletion fails', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({
        data: [{ id: 'sub_1', status: 'active' }],
      })
      mockStripe.subscriptions.cancel.mockResolvedValue({ id: 'sub_1', status: 'canceled' })
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] })
      mockStripe.customers.del.mockRejectedValue(new Error('Deletion failed'))

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      expect(result.subscriptionsCanceled).toBe(1)
      expect(result.customerDeleted).toBe(false)
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle customer with no subscriptions or payment methods', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({ data: [] })
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] })
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      expect(result.subscriptionsCanceled).toBe(0)
      expect(result.paymentMethodsDetached).toBe(0)
      expect(result.customerDeleted).toBe(true)
      expect(result.success).toBe(true)
    })

    it('should handle mixed subscription statuses', async () => {
      mockStripe.customers.retrieve.mockResolvedValue({
        id: customerId,
        deleted: false,
      })
      mockStripe.subscriptions.list.mockResolvedValue({
        data: [
          { id: 'sub_1', status: 'active' },
          { id: 'sub_2', status: 'canceled' },
          { id: 'sub_3', status: 'trialing' },
          { id: 'sub_4', status: 'past_due' },
        ],
      })
      mockStripe.subscriptions.cancel.mockResolvedValue({ id: 'sub_1', status: 'canceled' })
      mockStripe.paymentMethods.list.mockResolvedValue({ data: [] })
      mockStripe.customers.del.mockResolvedValue({ id: customerId, deleted: true })

      const result = await cleanupStripeBillingData(mockStripe, customerId)

      // Should cancel active, trialing, and past_due (3 total)
      expect(result.subscriptionsCanceled).toBe(3)
    })
  })
})

