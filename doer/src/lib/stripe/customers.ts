import Stripe from 'stripe'

import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface EnsureStripeCustomerParams {
  supabase: SupabaseClient
  stripe: Stripe
  userId: string
  email?: string | null
  metadata?: Record<string, string>
}

export async function ensureStripeCustomer({
  supabase,
  stripe,
  userId,
  email,
  metadata = {},
}: EnsureStripeCustomerParams): Promise<string> {
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (settingsError && settingsError.code !== 'PGRST116') {
    throw new Error(`Failed to load user settings for Stripe customer: ${settingsError.message}`)
  }

  if (settings?.stripe_customer_id) {
    return settings.stripe_customer_id
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: {
      userId,
      ...metadata,
    },
  })

  const { error: updateError } = await supabase
    .from('user_settings')
    .update({ stripe_customer_id: customer.id })
    .eq('user_id', userId)

  if (updateError) {
    throw new Error(`Failed to persist Stripe customer id: ${updateError.message}`)
  }

  return customer.id
}







