import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { cleanupStripeBillingDataImmediate } from '@/lib/stripe/account-deletion'
import { deleteAccountData } from '@/lib/billing/delete-account-data'
import { serverLogger } from '@/lib/logger/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * POST /api/account/delete-immediate
 * Immediately deletes the current user's account and cancels their subscription
 * This bypasses the scheduled deletion flow and deletes everything immediately
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

    // Get user email for audit log
    const userEmail = user.email || null

    // Get IP address and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create audit log entry with 'in_progress' status for immediate deletion
    const { data: auditRecord, error: auditError } = await supabaseService
      .from('account_deletion_audit')
      .insert({
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
        email: userEmail,
        status: 'in_progress',
        stripe_cleanup_status: stripeCustomerId && stripeDeletionEnabled ? 'pending' : 'skipped',
        ip_address: ipAddress,
        user_agent: userAgent,
        deletion_initiated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (auditError) {
      serverLogger.error('Failed to create audit log entry for immediate deletion', {
        userId: user.id,
        error: auditError.message,
      })
      // Continue with deletion even if audit log fails
    } else {
      auditRecordId = auditRecord.id
    }

    // Step 1: Clean up Stripe billing data immediately (if enabled and customer exists)
    let stripeCleanupResult = null
    if (stripeDeletionEnabled && stripe && stripeCustomerId) {
      serverLogger.logAccountDeletion('subscription_cancel_immediate', 'started', {
        userId: user.id,
        stripeCustomerId,
      })

      try {
        stripeCleanupResult = await cleanupStripeBillingDataImmediate(stripe, stripeCustomerId)
        
        // Update audit log with Stripe cleanup results
        if (auditRecordId) {
          // Determine cleanup status
          let cleanupStatus: 'completed' | 'failed' | 'partial' = 'completed'
          if (!stripeCleanupResult.success && stripeCleanupResult.errors.length > 0) {
            cleanupStatus = 'failed'
          } else if (stripeCleanupResult.errors.length > 0) {
            cleanupStatus = 'partial'
          }

          // Build error details
          const errorDetails: Record<string, any> = {}
          if (stripeCleanupResult.errors.length > 0) {
            errorDetails.stripe_errors = stripeCleanupResult.errors
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
          serverLogger.logAccountDeletion('subscription_cancel_immediate', 'completed', {
            userId: user.id,
            stripeCustomerId,
          })
        } else {
          serverLogger.logAccountDeletion('subscription_cancel_immediate', 'failed', {
            userId: user.id,
            stripeCustomerId,
            error: { message: 'Stripe cleanup partially failed', stripeError: stripeCleanupResult.errors },
          })
        }
      } catch (stripeError) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError)
        serverLogger.logAccountDeletion('subscription_cancel_immediate', 'failed', {
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
                step: 'stripe_cleanup_immediate',
              },
            })
            .eq('id', auditRecordId)
        }

        // Continue with database deletion even if Stripe cleanup fails
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

    // Step 2: Delete all DOER database records
    serverLogger.logAccountDeletion('db_cleanup_immediate', 'started', {
      userId: user.id,
      stripeCustomerId,
    })

    const deletionResult = await deleteAccountData(
      supabaseService,
      supabaseService,
      user.id
    )

    if (!deletionResult.success) {
      serverLogger.error('Database deletion had errors', {
        userId: user.id,
        errors: deletionResult.errors,
      })
    }

    serverLogger.logAccountDeletion('db_cleanup_immediate', 'completed', {
      userId: user.id,
      stripeCustomerId,
      metadata: deletionResult.errors.length > 0 ? { errors: deletionResult.errors } : undefined,
    })

    // Step 3: Delete the user from Supabase Auth
    serverLogger.logAccountDeletion('auth_delete_immediate', 'started', {
      userId: user.id,
      stripeCustomerId,
    })

    const { error: deleteUserError } = await supabaseService.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      const errorMsg = `Failed to delete auth user ${user.id}: ${deleteUserError.message}`
      serverLogger.logAccountDeletion('auth_delete_immediate', 'failed', {
        userId: user.id,
        stripeCustomerId,
        error: { message: deleteUserError.message },
      })

      // Update audit log with error
      if (auditRecordId) {
        await supabaseService
          .from('account_deletion_audit')
          .update({
            status: 'failed',
            error_details: { 
              auth_delete_error: deleteUserError.message,
              step: 'auth_delete',
            },
          })
          .eq('id', auditRecordId)
      }

      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      )
    }

    serverLogger.logAccountDeletion('auth_delete_immediate', 'completed', {
      userId: user.id,
      stripeCustomerId,
    })

    // Update audit log with completion
    if (auditRecordId) {
      const finalStatus = deletionResult.success && (!stripeCleanupResult || stripeCleanupResult.success)
        ? 'completed'
        : 'partial'
      
      await supabaseService
        .from('account_deletion_audit')
        .update({
          status: finalStatus,
          deletion_completed_at: new Date().toISOString(),
        })
        .eq('id', auditRecordId)
    }

    serverLogger.info('Account deleted immediately', {
      userId: user.id,
      stripeCustomerId,
      duration: new Date().getTime() - deletionStartTime.getTime(),
    })

    return NextResponse.json({ 
      success: true,
      message: 'Your account has been deleted immediately.',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    serverLogger.error('Unexpected error in POST /api/account/delete-immediate', {
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

