import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { cleanupStripeBillingData } from '@/lib/stripe/account-deletion'
import { serverLogger } from '@/lib/logger/server'
import { calculateDeletionDate } from '@/lib/billing/account-deletion'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * POST /api/settings/delete-account
 * Schedules the current user's account for deletion at subscription period end
 * Includes Stripe subscription cancellation (at period end)
 * Account will be automatically deleted by cron job after period end
 */
export async function POST(request: NextRequest) {
  const deletionStartTime = new Date()
  let auditRecordId: string | null = null
  
  try {
    const supabase = await createClient()
    const supabaseService = getServiceRoleClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { confirmation } = body

    // Require explicit confirmation
    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Invalid confirmation' },
        { status: 400 }
      )
    }

    // Check feature flag
    const stripeDeletionEnabled = process.env.ENABLE_STRIPE_ACCOUNT_DELETION === 'true'

    // Get user settings to retrieve Stripe customer ID
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('stripe_customer_id, scheduled_deletion_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const stripeCustomerId = userSettings?.stripe_customer_id || null

    // Check if account is already scheduled for deletion
    if (userSettings?.scheduled_deletion_at) {
      return NextResponse.json(
        { error: 'Account is already scheduled for deletion' },
        { status: 400 }
      )
    }

    // Get user email for audit log (for trial abuse prevention)
    const userEmail = user.email || null

    // Get IP address and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Calculate deletion date based on subscription period end
    const scheduledDeletionAt = await calculateDeletionDate(user.id)

    // Create audit log entry with 'scheduled' status
    const { data: auditRecord, error: auditError } = await supabaseService
      .from('account_deletion_audit')
      .insert({
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
        email: userEmail,
        status: 'scheduled',
        stripe_cleanup_status: stripeCustomerId && stripeDeletionEnabled ? 'pending' : 'skipped',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select('id')
      .single()

    if (auditError) {
      serverLogger.error('Failed to create audit log entry', {
        userId: user.id,
        error: auditError.message,
      })
      return NextResponse.json(
        { error: 'Failed to schedule account deletion' },
        { status: 500 }
      )
    } else {
      auditRecordId = auditRecord.id
    }

    // Step 1: Schedule Stripe subscription cancellation (at period end)
    let stripeCleanupResult = null
    if (stripeDeletionEnabled && stripe && stripeCustomerId) {
      serverLogger.logAccountDeletion('subscription_cancel', 'started', {
        userId: user.id,
        stripeCustomerId,
      })

      try {
        stripeCleanupResult = await cleanupStripeBillingData(stripe, stripeCustomerId)
        
        // Update audit log with Stripe cleanup results
        if (auditRecordId) {
          // Determine cleanup status
          let cleanupStatus: 'completed' | 'failed' | 'partial' | 'deferred' = 'completed'
          if (!stripeCleanupResult.success && stripeCleanupResult.errors.length > 0) {
            cleanupStatus = 'failed'
          } else if (stripeCleanupResult.customerDeletionDeferred) {
            cleanupStatus = 'deferred'
          } else if (stripeCleanupResult.errors.length > 0) {
            cleanupStatus = 'partial'
          }

          // Build error details with additional context
          const errorDetails: Record<string, any> = {}
          if (stripeCleanupResult.errors.length > 0) {
            errorDetails.stripe_errors = stripeCleanupResult.errors
          }
          if (stripeCleanupResult.customerDeletionDeferred) {
            errorDetails.customer_deletion_deferred = true
            errorDetails.deferred_reason = 'Active subscriptions scheduled to cancel at period end'
            errorDetails.subscriptions_scheduled = stripeCleanupResult.subscriptionsScheduledForCancellation
          }

          await supabaseService
            .from('account_deletion_audit')
            .update({
              stripe_cleanup_status: cleanupStatus,
              subscriptions_canceled: stripeCleanupResult.subscriptionsCanceled,
              payment_methods_detached: stripeCleanupResult.paymentMethodsDetached,
              customer_deleted: stripeCleanupResult.customerDeleted,
              error_details: Object.keys(errorDetails).length > 0 ? errorDetails : {},
            })
            .eq('id', auditRecordId)
        }

        if (stripeCleanupResult.success) {
          serverLogger.logAccountDeletion('subscription_cancel', 'completed', {
            userId: user.id,
            stripeCustomerId,
          })
        } else {
          serverLogger.logAccountDeletion('subscription_cancel', 'failed', {
            userId: user.id,
            stripeCustomerId,
            error: { message: 'Stripe cleanup partially failed', stripeError: stripeCleanupResult.errors },
          })
        }
      } catch (stripeError) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError)
        serverLogger.logAccountDeletion('subscription_cancel', 'failed', {
          userId: user.id,
          stripeCustomerId,
          error: { message: errorMessage },
        })

        // Update audit log with error
        if (auditRecordId) {
          await supabaseService
            .from('account_deletion_audit')
            .update({
              stripe_cleanup_status: 'failed',
              error_details: { 
                stripe_error: errorMessage,
                step: 'stripe_cleanup',
              },
            })
            .eq('id', auditRecordId)
        }

        // Continue with scheduling even if Stripe cleanup fails
        // User will be informed of partial success
      }
    } else if (!stripeCustomerId) {
      serverLogger.info('No Stripe customer ID found, skipping Stripe cleanup', {
        userId: user.id,
      })
    } else if (!stripeDeletionEnabled) {
      serverLogger.info('Stripe account deletion disabled by feature flag', {
        userId: user.id,
      })
    }

    // Step 2: Schedule account deletion (set scheduled_deletion_at)
    serverLogger.logAccountDeletion('schedule_deletion', 'started', {
      userId: user.id,
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      stripeCustomerId,
    })

    // Set scheduled_deletion_at in user_settings
    const { error: scheduleError } = await supabase
      .from('user_settings')
      .update({ scheduled_deletion_at: scheduledDeletionAt.toISOString() })
      .eq('user_id', user.id)

    if (scheduleError) {
      serverLogger.error('Error scheduling account deletion', {
        userId: user.id,
        error: scheduleError.message,
      })

      // Update audit log
      if (auditRecordId) {
        await supabaseService
          .from('account_deletion_audit')
          .update({
            status: 'failed',
            error_details: { 
              schedule_error: scheduleError.message,
              step: 'schedule_deletion',
            },
          })
          .eq('id', auditRecordId)
      }

      return NextResponse.json(
        { error: 'Failed to schedule account deletion' },
        { status: 500 }
      )
    }

    serverLogger.logAccountDeletion('schedule_deletion', 'completed', {
      userId: user.id,
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      stripeCustomerId,
    })

    // Format deletion date for user message
    const deletionDateFormatted = scheduledDeletionAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

    // Return success message indicating account will be deleted at period end
    let message = `Your account has been scheduled for deletion on ${deletionDateFormatted}. You will retain access until then. You can restore your account at any time before this date by signing in.`
    
    if (stripeCleanupResult && !stripeCleanupResult.success) {
      message += ' We encountered an issue scheduling your subscription cancellation. Our team will complete this process manually.'
    }

    return NextResponse.json({ 
      success: true,
      message,
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    serverLogger.error('Unexpected error in POST /api/settings/delete-account', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Update audit log if it exists
    if (auditRecordId) {
      try {
        const supabaseService = getServiceRoleClient()
        await supabaseService
          .from('account_deletion_audit')
          .update({
            status: 'failed',
            error_details: {
              unexpected_error: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
            },
          })
          .eq('id', auditRecordId)
      } catch (auditUpdateError) {
        serverLogger.error('Failed to update audit log with error', {
          auditRecordId,
          error: auditUpdateError instanceof Error ? auditUpdateError.message : String(auditUpdateError),
        })
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



















