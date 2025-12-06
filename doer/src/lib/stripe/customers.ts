import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface EnsureStripeCustomerParams {
  supabase: SupabaseClient
  stripe: Stripe
  userId: string
  email?: string | null
  metadata?: Record<string, string>
}

/**
 * Ensures a Stripe customer exists for a user.
 * Uses upsert pattern to prevent duplicate customer creation in race conditions.
 * 
 * This function is idempotent - multiple concurrent calls will result in the same customer ID.
 */
export async function ensureStripeCustomer({
  supabase,
  stripe,
  userId,
  email,
  metadata = {},
}: EnsureStripeCustomerParams): Promise<string> {
  // First, try to get existing customer ID
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (settings?.stripe_customer_id) {
    // Verify customer still exists in Stripe
    try {
      await stripe.customers.retrieve(settings.stripe_customer_id)
      return settings.stripe_customer_id
    } catch (error) {
      // Customer doesn't exist in Stripe, need to create new one
      logger.warn('Stripe customer not found, will create new one', {
        userId,
        stripeCustomerId: settings.stripe_customer_id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (settingsError && settingsError.code !== 'PGRST116') {
    throw new Error(`Failed to load user settings for Stripe customer: ${settingsError.message}`)
  }

  // Create customer in Stripe with idempotency key to prevent duplicates
  // Use userId as part of idempotency key to ensure same user always gets same customer
  const idempotencyKey = `customer-${userId}`
  
  let customer: Stripe.Customer
  try {
    customer = await stripe.customers.create(
      {
        email: email || undefined,
        metadata: {
          userId,
          ...metadata,
        },
      },
      {
        idempotencyKey,
      }
    )
  } catch (error: any) {
    // If customer already exists (idempotency key collision), retrieve it
    if (error?.code === 'idempotency_key_in_use' || error?.message?.includes('already been used')) {
      // Try to find existing customer by metadata
      const existingCustomers = await stripe.customers.list({
        email: email || undefined,
        limit: 10,
      })
      
      const existingCustomer = existingCustomers.data.find(
        c => c.metadata?.userId === userId
      )
      
      if (existingCustomer) {
        customer = existingCustomer
        logger.info('Found existing Stripe customer via metadata', {
          userId,
          stripeCustomerId: customer.id,
        })
      } else {
        // If we can't find it, this is a real error
        throw new Error(`Failed to create or retrieve Stripe customer: ${error.message}`)
      }
    } else {
      throw error
    }
  }

  // Use upsert to atomically set customer ID
  // This prevents race conditions where multiple requests try to set customer ID simultaneously
  const { data: updatedSettings, error: upsertError } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customer.id,
      },
      {
        onConflict: 'user_id',
      }
    )
    .select('stripe_customer_id')
    .single()

  if (upsertError) {
    // If upsert failed, check if another request already set the customer ID
    const { data: checkSettings } = await supabase
      .from('user_settings')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (checkSettings?.stripe_customer_id) {
      // Another request already set it, use that value
      logger.info('Customer ID already set by concurrent request', {
        userId,
        stripeCustomerId: checkSettings.stripe_customer_id,
      })
      return checkSettings.stripe_customer_id
    }

    throw new Error(`Failed to persist Stripe customer id: ${upsertError.message}`)
  }

  // If upsert succeeded but returned a different customer ID, another request won the race
  // Use the one from database (source of truth)
  if (updatedSettings?.stripe_customer_id && updatedSettings.stripe_customer_id !== customer.id) {
    logger.warn('Race condition detected: using customer ID from database', {
      userId,
      createdCustomerId: customer.id,
      databaseCustomerId: updatedSettings.stripe_customer_id,
    })
    return updatedSettings.stripe_customer_id
  }

  return customer.id
}









