/**
 * POST /api/admin/account-deletion/retry-stripe-cleanup
 * Admin endpoint to manually retry Stripe cleanup for a user
 * Requires admin authorization via ADMIN_API_KEY environment variable
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { cleanupStripeBillingData } from '@/lib/stripe/account-deletion'
import { serverLogger } from '@/lib/logger/server'

export const dynamic = 'force-dynamic'

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * Check if request is authorized as admin
 * Uses ADMIN_API_KEY environment variable for authorization
 */
function isAdminAuthorized(request: NextRequest): boolean {
  const adminApiKey = process.env.ADMIN_API_KEY
  if (!adminApiKey) {
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return false
  }

  // Support both "Bearer <key>" and direct key
  const providedKey = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader

  return providedKey === adminApiKey
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    if (!isAdminAuthorized(request)) {
      serverLogger.warn('Unauthorized admin access attempt', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { userId, stripeCustomerId } = body

    // Require either userId or stripeCustomerId
    if (!userId && !stripeCustomerId) {
      return NextResponse.json(
        { error: 'Either userId or stripeCustomerId is required' },
        { status: 400 }
      )
    }

    const supabase = getServiceRoleClient()
    let targetUserId: string | null = null
    let targetStripeCustomerId: string | null = null

    // If userId provided, get stripe_customer_id
    if (userId) {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!userSettings) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      targetUserId = userId
      targetStripeCustomerId = userSettings.stripe_customer_id
    } else if (stripeCustomerId) {
      // If stripeCustomerId provided, get userId
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .maybeSingle()

      if (!userSettings) {
        return NextResponse.json(
          { error: 'Stripe customer not found in database' },
          { status: 404 }
        )
      }

      targetUserId = userSettings.user_id
      targetStripeCustomerId = stripeCustomerId
    }

    if (!targetStripeCustomerId) {
      return NextResponse.json(
        { 
          success: false,
          message: 'User has no Stripe customer ID. Stripe cleanup skipped.',
          userId: targetUserId,
        },
        { status: 200 }
      )
    }

    // Log admin action
    serverLogger.info('Admin retry Stripe cleanup initiated', {
      adminAction: true,
      userId: targetUserId,
      stripeCustomerId: targetStripeCustomerId,
    })

    // Perform Stripe cleanup
    const cleanupResult = await cleanupStripeBillingData(stripe, targetStripeCustomerId)

    // Update audit log if record exists
    if (targetUserId) {
      const { data: existingAudit } = await supabase
        .from('account_deletion_audit')
        .select('id')
        .eq('user_id', targetUserId)
        .order('deletion_initiated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingAudit) {
        await supabase
          .from('account_deletion_audit')
          .update({
            stripe_cleanup_status: cleanupResult.success ? 'completed' : 'failed',
            subscriptions_canceled: cleanupResult.subscriptionsCanceled,
            payment_methods_detached: cleanupResult.paymentMethodsDetached,
            customer_deleted: cleanupResult.customerDeleted,
            error_details: cleanupResult.errors.length > 0
              ? { 
                  stripe_errors: cleanupResult.errors,
                  admin_retry: true,
                  retry_at: new Date().toISOString(),
                }
              : { admin_retry: true, retry_at: new Date().toISOString() },
          })
          .eq('id', existingAudit.id)
      } else {
        // Create new audit record for admin retry
        await supabase
          .from('account_deletion_audit')
          .insert({
            user_id: targetUserId,
            stripe_customer_id: targetStripeCustomerId,
            status: 'partial',
            stripe_cleanup_status: cleanupResult.success ? 'completed' : 'failed',
            subscriptions_canceled: cleanupResult.subscriptionsCanceled,
            payment_methods_detached: cleanupResult.paymentMethodsDetached,
            customer_deleted: cleanupResult.customerDeleted,
            error_details: {
              admin_retry: true,
              retry_at: new Date().toISOString(),
              stripe_errors: cleanupResult.errors,
            },
            ip_address: request.headers.get('x-forwarded-for') || 'admin',
            user_agent: request.headers.get('user-agent') || 'admin',
          })
      }
    }

    return NextResponse.json({
      success: cleanupResult.success,
      message: cleanupResult.success
        ? 'Stripe cleanup completed successfully'
        : 'Stripe cleanup completed with errors',
      userId: targetUserId,
      stripeCustomerId: targetStripeCustomerId,
      subscriptionsCanceled: cleanupResult.subscriptionsCanceled,
      paymentMethodsDetached: cleanupResult.paymentMethodsDetached,
      customerDeleted: cleanupResult.customerDeleted,
      errors: cleanupResult.errors,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    serverLogger.error('Admin retry Stripe cleanup failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}

