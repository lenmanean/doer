import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * POST /api/settings/delete-account
 * Deletes the current user's account and all associated data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
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

    // Delete all user plans (cascades will handle milestones, tasks, etc.)
    const { error: plansError } = await supabase
      .from('plans')
      .delete()
      .eq('user_id', user.id)

    if (plansError) {
      console.error('Error deleting user plans:', plansError)
      // Continue anyway, we'll try to delete the profile and user
    }

    // Delete free mode tasks (tasks with plan_id: null)
    const { error: freeTasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .is('plan_id', null)

    if (freeTasksError) {
      console.error('Error deleting free mode tasks:', freeTasksError)
      // Continue anyway
    }

    // Delete free mode task schedules (task_schedule with plan_id: null)
    const { error: freeTaskSchedulesError } = await supabase
      .from('task_schedule')
      .delete()
      .eq('user_id', user.id)
      .is('plan_id', null)

    if (freeTaskSchedulesError) {
      console.error('Error deleting free mode task schedules:', freeTaskSchedulesError)
      // Continue anyway
    }

    // Delete health snapshots
    const { error: healthSnapshotsError } = await supabase
      .from('health_snapshots')
      .delete()
      .eq('user_id', user.id)

    if (healthSnapshotsError) {
      console.error('Error deleting health snapshots:', healthSnapshotsError)
      // Continue anyway
    }

    // Delete onboarding responses
    const { error: onboardingError } = await supabase
      .from('onboarding_responses')
      .delete()
      .eq('user_id', user.id)

    if (onboardingError) {
      console.error('Error deleting onboarding responses:', onboardingError)
      // Continue anyway
    }

    // Delete scheduling history
    const { error: schedulingHistoryError } = await supabase
      .from('scheduling_history')
      .delete()
      .eq('user_id', user.id)

    if (schedulingHistoryError) {
      console.error('Error deleting scheduling history:', schedulingHistoryError)
      // Continue anyway
    }

    // Delete task completions
    const { error: taskCompletionsError } = await supabase
      .from('task_completions')
      .delete()
      .eq('user_id', user.id)

    if (taskCompletionsError) {
      console.error('Error deleting task completions:', taskCompletionsError)
      // Continue anyway
    }

    // Delete user profile (should cascade from user deletion, but let's be explicit)
    const { error: profileError } = await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', user.id)

    if (profileError) {
      console.error('Error deleting user profile:', profileError)
      // Continue anyway
    }

    // Create service role client to delete the user from Supabase Auth
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Delete the user from Supabase Auth using service role
    const { error: deleteUserError } = await supabaseService.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      console.error('Error deleting user from Auth:', deleteUserError)
      return NextResponse.json(
        { error: 'Failed to delete user account' },
        { status: 500 }
      )
    }

    // Sign out the user (this will happen automatically, but let's be explicit)
    await supabase.auth.signOut()

    return NextResponse.json({ 
      success: true,
      message: 'Account and all data have been permanently deleted.'
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/settings/delete-account:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



















