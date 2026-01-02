import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { serverLogger } from '@/lib/logger/server'
import { deleteAccountData } from '@/lib/billing/delete-account-data'
import { cleanupStripeBillingData } from '@/lib/stripe/account-deletion'
import Stripe from 'stripe'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
let stripe: Stripe | null = null
if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey)
}

/**
 * Cron job endpoint for processing scheduled account deletions
 * Runs daily at midnight UTC via Vercel Cron
 * 
 * Security: Verifies cron secret from Vercel
 * Uses service role client to bypass RLS for cron operations
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    serverLogger.warn('Unauthorized cron request for scheduled deletions', { 
      hasAuthHeader: !!authHeader 
    })
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const supabaseService = getServiceRoleClient()
    const stripeDeletionEnabled = process.env.ENABLE_STRIPE_ACCOUNT_DELETION === 'true'
    const now = new Date().toISOString()

    // Find all accounts where scheduled_deletion_at has passed
    const { data: accountsToDelete, error: fetchError } = await supabaseService
      .from('user_settings')
      .select('user_id, stripe_customer_id, scheduled_deletion_at')
      .not('scheduled_deletion_at', 'is', null)
      .lte('scheduled_deletion_at', now)

    if (fetchError) {
      serverLogger.error('Failed to fetch accounts scheduled for deletion', {
        error: fetchError.message,
      })
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      )
    }

    if (!accountsToDelete || accountsToDelete.length === 0) {
      serverLogger.info('No accounts scheduled for deletion', {
        timestamp: now,
      })
      return NextResponse.json({
        success: true,
        message: 'No accounts to delete',
        processed: 0,
      })
    }

    serverLogger.info('Processing scheduled account deletions', {
      count: accountsToDelete.length,
      timestamp: now,
    })

    const results = {
      total: accountsToDelete.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process each account
    for (const account of accountsToDelete) {
      const userId = account.user_id
      const stripeCustomerId = account.stripe_customer_id

      try {
        // Find audit record for this user
        const { data: auditRecords } = await supabaseService
          .from('account_deletion_audit')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'scheduled')
          .order('deletion_initiated_at', { ascending: false })
          .limit(1)

        const auditRecordId = auditRecords && auditRecords.length > 0 ? auditRecords[0].id : null

        // Step 1: Clean up Stripe billing data (if enabled and customer exists)
        let stripeCleanupResult = null
        if (stripeDeletionEnabled && stripe && stripeCustomerId) {
          serverLogger.logAccountDeletion('stripe_cleanup_cron', 'started', {
            userId,
            stripeCustomerId,
          })

          try {
            stripeCleanupResult = await cleanupStripeBillingData(stripe, stripeCustomerId)
            
            // Update audit log with Stripe cleanup results
            if (auditRecordId) {
              let cleanupStatus: 'completed' | 'failed' | 'partial' | 'deferred' = 'completed'
              if (!stripeCleanupResult.success && stripeCleanupResult.errors.length > 0) {
                cleanupStatus = 'failed'
              } else if (stripeCleanupResult.customerDeletionDeferred) {
                cleanupStatus = 'deferred'
              } else if (stripeCleanupResult.errors.length > 0) {
                cleanupStatus = 'partial'
              }

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
          } catch (stripeError) {
            const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError)
            serverLogger.error('Stripe cleanup failed in cron job', {
              userId,
              stripeCustomerId,
              error: errorMessage,
            })
            // Continue with deletion even if Stripe cleanup fails
          }
        }

        // Step 2: Delete all DOER database records
        const deletionResult = await deleteAccountData(
          supabaseService,
          supabaseService,
          userId
        )

        if (!deletionResult.success) {
          results.errors.push(...deletionResult.errors.map(e => `${userId}: ${e}`))
        }

        // Step 3: Delete the user from Supabase Auth
        serverLogger.logAccountDeletion('auth_delete_cron', 'started', {
          userId,
          stripeCustomerId,
        })

        const { error: deleteUserError } = await supabaseService.auth.admin.deleteUser(userId)

        if (deleteUserError) {
          const errorMsg = `Failed to delete auth user ${userId}: ${deleteUserError.message}`
          serverLogger.logAccountDeletion('auth_delete_cron', 'failed', {
            userId,
            stripeCustomerId,
            error: { message: deleteUserError.message },
          })
          results.errors.push(errorMsg)
          results.failed++
          continue
        }

        serverLogger.logAccountDeletion('auth_delete_cron', 'completed', {
          userId,
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

        results.successful++
        serverLogger.info('Successfully deleted account', {
          userId,
          stripeCustomerId,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        serverLogger.error('Error processing scheduled deletion', {
          userId: account.user_id,
          error: errorMessage,
          stack: errorStack,
        })
        results.errors.push(`${account.user_id}: ${errorMessage}`)
        results.failed++
      }
    }

    serverLogger.info('Completed processing scheduled account deletions', {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
    })

    return NextResponse.json({
      success: true,
      processed: results.successful,
      failed: results.failed,
      total: results.total,
      errors: results.errors,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    serverLogger.error('Scheduled deletion cron job failed', {
      error: errorMessage,
      stack: errorStack,
    })
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

