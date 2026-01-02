import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { cleanupStripeBillingData } from '@/lib/stripe/account-deletion'
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
 * POST /api/settings/delete-account
 * Deletes the current user's account and all associated data
 * Includes Stripe customer cleanup if feature flag is enabled
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

    // Get user settings to retrieve Stripe customer ID before deletion
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const stripeCustomerId = userSettings?.stripe_customer_id || null

    // Get user email for audit log (for trial abuse prevention)
    const userEmail = user.email || null

    // Get IP address and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create audit log entry
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
      })
      .select('id')
      .single()

    if (auditError) {
      serverLogger.error('Failed to create audit log entry', {
        userId: user.id,
        error: auditError.message,
      })
      // Continue with deletion even if audit log fails
    } else {
      auditRecordId = auditRecord.id
    }

    // Step 1: Clean up Stripe billing data (if enabled and customer exists)
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
          await supabaseService
            .from('account_deletion_audit')
            .update({
              stripe_cleanup_status: stripeCleanupResult.success ? 'completed' : 'failed',
              subscriptions_canceled: stripeCleanupResult.subscriptionsCanceled,
              payment_methods_detached: stripeCleanupResult.paymentMethodsDetached,
              customer_deleted: stripeCleanupResult.customerDeleted,
              error_details: stripeCleanupResult.errors.length > 0 
                ? { stripe_errors: stripeCleanupResult.errors }
                : {},
            })
            .eq('id', auditRecordId)
        }

        if (stripeCleanupResult.success) {
          serverLogger.logAccountDeletion('customer_delete', 'completed', {
            userId: user.id,
            stripeCustomerId,
          })
        } else {
          serverLogger.logAccountDeletion('customer_delete', 'failed', {
            userId: user.id,
            stripeCustomerId,
            error: { message: 'Stripe cleanup partially failed', stripeError: stripeCleanupResult.errors },
          })
        }
      } catch (stripeError) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError)
        serverLogger.logAccountDeletion('customer_delete', 'failed', {
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

        // Continue with DOER deletion even if Stripe cleanup fails
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
    serverLogger.logAccountDeletion('db_cleanup', 'started', {
      userId: user.id,
      stripeCustomerId,
    })

    // Delete all user plans (cascades will handle milestones, tasks, etc.)
    const { error: plansError } = await supabase
      .from('plans')
      .delete()
      .eq('user_id', user.id)

    if (plansError) {
      serverLogger.error('Error deleting user plans', {
        userId: user.id,
        error: plansError.message,
      })
      // Continue anyway, we'll try to delete the profile and user
    }

    // Delete free mode tasks (tasks with plan_id: null)
    const { error: freeTasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .is('plan_id', null)

    if (freeTasksError) {
      serverLogger.error('Error deleting free mode tasks', {
        userId: user.id,
        error: freeTasksError.message,
      })
      // Continue anyway
    }

    // Delete free mode task schedules (task_schedule with plan_id: null)
    const { error: freeTaskSchedulesError } = await supabase
      .from('task_schedule')
      .delete()
      .eq('user_id', user.id)
      .is('plan_id', null)

    if (freeTaskSchedulesError) {
      serverLogger.error('Error deleting free mode task schedules', {
        userId: user.id,
        error: freeTaskSchedulesError.message,
      })
      // Continue anyway
    }

    // Delete health snapshots
    const { error: healthSnapshotsError } = await supabase
      .from('health_snapshots')
      .delete()
      .eq('user_id', user.id)

    if (healthSnapshotsError) {
      serverLogger.error('Error deleting health snapshots', {
        userId: user.id,
        error: healthSnapshotsError.message,
      })
      // Continue anyway
    }

    // Delete onboarding responses
    const { error: onboardingError } = await supabase
      .from('onboarding_responses')
      .delete()
      .eq('user_id', user.id)

    if (onboardingError) {
      serverLogger.error('Error deleting onboarding responses', {
        userId: user.id,
        error: onboardingError.message,
      })
      // Continue anyway
    }

    // Delete scheduling history
    const { error: schedulingHistoryError } = await supabase
      .from('scheduling_history')
      .delete()
      .eq('user_id', user.id)

    if (schedulingHistoryError) {
      serverLogger.error('Error deleting scheduling history', {
        userId: user.id,
        error: schedulingHistoryError.message,
      })
      // Continue anyway
    }

    // Delete task completions
    const { error: taskCompletionsError } = await supabase
      .from('task_completions')
      .delete()
      .eq('user_id', user.id)

    if (taskCompletionsError) {
      serverLogger.error('Error deleting task completions', {
        userId: user.id,
        error: taskCompletionsError.message,
      })
      // Continue anyway
    }

    // Delete billing-related records
    const { error: subscriptionsError } = await supabaseService
      .from('user_plan_subscriptions')
      .delete()
      .eq('user_id', user.id)

    if (subscriptionsError) {
      serverLogger.error('Error deleting user plan subscriptions', {
        userId: user.id,
        error: subscriptionsError.message,
      })
      // Continue anyway
    }

    const { error: usageBalancesError } = await supabaseService
      .from('plan_usage_balances')
      .delete()
      .eq('user_id', user.id)

    if (usageBalancesError) {
      serverLogger.error('Error deleting usage balances', {
        userId: user.id,
        error: usageBalancesError.message,
      })
      // Continue anyway
    }

    const { error: usageLedgerError } = await supabaseService
      .from('usage_ledger')
      .delete()
      .eq('user_id', user.id)

    if (usageLedgerError) {
      serverLogger.error('Error deleting usage ledger', {
        userId: user.id,
        error: usageLedgerError.message,
      })
      // Continue anyway
    }

    const { error: apiTokensError } = await supabaseService
      .from('api_tokens')
      .delete()
      .eq('user_id', user.id)

    if (apiTokensError) {
      serverLogger.error('Error deleting API tokens', {
        userId: user.id,
        error: apiTokensError.message,
      })
      // Continue anyway
    }

    // Delete user profile (should cascade from user deletion, but let's be explicit)
    const { error: profileError } = await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', user.id)

    if (profileError) {
      serverLogger.error('Error deleting user profile', {
        userId: user.id,
        error: profileError.message,
      })
      // Continue anyway
    }

    // Step 3: Delete the user from Supabase Auth using service role
    serverLogger.logAccountDeletion('auth_delete', 'started', {
      userId: user.id,
      stripeCustomerId,
    })

    const { error: deleteUserError } = await supabaseService.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      serverLogger.logAccountDeletion('auth_delete', 'failed', {
        userId: user.id,
        stripeCustomerId,
        error: { message: deleteUserError.message },
      })

      // Update audit log
      if (auditRecordId) {
        await supabaseService
          .from('account_deletion_audit')
          .update({
            status: 'failed',
            error_details: { 
              auth_error: deleteUserError.message,
              step: 'auth_delete',
            },
          })
          .eq('id', auditRecordId)
      }

      return NextResponse.json(
        { error: 'Failed to delete user account' },
        { status: 500 }
      )
    }

    serverLogger.logAccountDeletion('auth_delete', 'completed', {
      userId: user.id,
      stripeCustomerId,
    })

    // Update audit log with completion
    const deletionEndTime = new Date()
    if (auditRecordId) {
      const finalStatus = stripeCleanupResult && !stripeCleanupResult.success 
        ? 'partial' 
        : 'completed'
      
      await supabaseService
        .from('account_deletion_audit')
        .update({
          status: finalStatus,
          deletion_completed_at: deletionEndTime.toISOString(),
        })
        .eq('id', auditRecordId)
    }

    // Sign out the user (this will happen automatically, but let's be explicit)
    await supabase.auth.signOut()

    // Determine response message based on Stripe cleanup result
    let message = 'Account and all data have been permanently deleted.'
    if (stripeCleanupResult && !stripeCleanupResult.success) {
      message = 'Your account has been deleted. We encountered an issue removing your billing information from Stripe. Our team will complete this process manually. You will receive a confirmation email when complete.'
    }

    return NextResponse.json({ 
      success: true,
      message,
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



















