/**
 * Helper function to actually delete account data
 * Used by cron job to process scheduled deletions
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { serverLogger } from '@/lib/logger/server'

/**
 * Actually delete all DOER database records for a user
 * This is the actual deletion logic (not scheduling)
 */
export async function deleteAccountData(
  supabase: SupabaseClient,
  supabaseService: SupabaseClient,
  userId: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []

  serverLogger.logAccountDeletion('db_cleanup', 'started', {
    userId,
  })

  // Delete all user plans (cascades will handle milestones, tasks, etc.)
  const { error: plansError } = await supabase
    .from('plans')
    .delete()
    .eq('user_id', userId)

  if (plansError) {
    const errorMsg = `Error deleting user plans: ${plansError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  // Delete free mode tasks (tasks with plan_id: null)
  const { error: freeTasksError } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .is('plan_id', null)

  if (freeTasksError) {
    const errorMsg = `Error deleting free mode tasks: ${freeTasksError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  // Delete free mode task schedules (task_schedule with plan_id: null)
  const { error: freeTaskSchedulesError } = await supabase
    .from('task_schedule')
    .delete()
    .eq('user_id', userId)
    .is('plan_id', null)

  if (freeTaskSchedulesError) {
    const errorMsg = `Error deleting free mode task schedules: ${freeTaskSchedulesError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  // Delete health snapshots
  const { error: healthSnapshotsError } = await supabase
    .from('health_snapshots')
    .delete()
    .eq('user_id', userId)

  if (healthSnapshotsError) {
    const errorMsg = `Error deleting health snapshots: ${healthSnapshotsError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  // Delete onboarding responses
  const { error: onboardingError } = await supabase
    .from('onboarding_responses')
    .delete()
    .eq('user_id', userId)

  if (onboardingError) {
    const errorMsg = `Error deleting onboarding responses: ${onboardingError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  // Delete scheduling history
  const { error: schedulingHistoryError } = await supabase
    .from('scheduling_history')
    .delete()
    .eq('user_id', userId)

  if (schedulingHistoryError) {
    const errorMsg = `Error deleting scheduling history: ${schedulingHistoryError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  // Delete task completions
  const { error: taskCompletionsError } = await supabase
    .from('task_completions')
    .delete()
    .eq('user_id', userId)

  if (taskCompletionsError) {
    const errorMsg = `Error deleting task completions: ${taskCompletionsError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  // Delete billing-related records (use service role)
  const { error: subscriptionsError } = await supabaseService
    .from('user_plan_subscriptions')
    .delete()
    .eq('user_id', userId)

  if (subscriptionsError) {
    const errorMsg = `Error deleting user plan subscriptions: ${subscriptionsError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  const { error: usageBalancesError } = await supabaseService
    .from('plan_usage_balances')
    .delete()
    .eq('user_id', userId)

  if (usageBalancesError) {
    const errorMsg = `Error deleting usage balances: ${usageBalancesError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  const { error: usageLedgerError } = await supabaseService
    .from('usage_ledger')
    .delete()
    .eq('user_id', userId)

  if (usageLedgerError) {
    const errorMsg = `Error deleting usage ledger: ${usageLedgerError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  const { error: apiTokensError } = await supabaseService
    .from('api_tokens')
    .delete()
    .eq('user_id', userId)

  if (apiTokensError) {
    const errorMsg = `Error deleting API tokens: ${apiTokensError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  // Delete user profile
  const { error: profileError } = await supabase
    .from('user_settings')
    .delete()
    .eq('user_id', userId)

  if (profileError) {
    const errorMsg = `Error deleting user profile: ${profileError.message}`
    serverLogger.error(errorMsg, { userId })
    errors.push(errorMsg)
  }

  serverLogger.logAccountDeletion('db_cleanup', 'completed', {
    userId,
    errors: errors.length > 0 ? errors : undefined,
  })

  return {
    success: errors.length === 0,
    errors,
  }
}

