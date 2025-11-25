import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PREFERENCES } from '@/lib/types/preferences'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/delete-data
 * Deletes all user data but keeps the account intact
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { confirmation, deletePlansOnly, deleteTasksOnly } = body

    // Require explicit confirmation
    if (confirmation !== 'DELETE DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation' },
        { status: 400 }
      )
    }

    // If deletePlansOnly is true, only delete plans
    if (deletePlansOnly) {
      const { error: plansError } = await supabase
        .from('plans')
        .delete()
        .eq('user_id', user.id)

      if (plansError) {
        console.error('Error deleting user plans:', plansError)
        return NextResponse.json(
          { error: 'Failed to delete plans' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        success: true,
        message: 'All your plans have been permanently deleted.'
      })
    }

    // If deleteTasksOnly is true, only delete tasks
    if (deleteTasksOnly) {
      // Delete all tasks (both plan and free mode)
      const { error: allTasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', user.id)

      if (allTasksError) {
        console.error('Error deleting tasks:', allTasksError)
        return NextResponse.json(
          { error: 'Failed to delete tasks' },
          { status: 500 }
        )
      }

      // Delete all task schedules
      const { error: taskSchedulesError } = await supabase
        .from('task_schedule')
        .delete()
        .eq('user_id', user.id)

      if (taskSchedulesError) {
        console.error('Error deleting task schedules:', taskSchedulesError)
        // Continue anyway
      }

      return NextResponse.json({ 
        success: true,
        message: 'All your tasks have been permanently deleted.'
      })
    }

    // Delete all user plans (cascades will handle milestones, tasks, etc.)
    const { error: plansError } = await supabase
      .from('plans')
      .delete()
      .eq('user_id', user.id)

    if (plansError) {
      console.error('Error deleting user plans:', plansError)
      // Continue anyway, we'll try to delete other data
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

    // Reset user settings to defaults (keep the profile but reset settings)
    const { error: settingsError } = await supabase
      .from('user_settings')
      .update({
        preferences: DEFAULT_PREFERENCES
      })
      .eq('user_id', user.id)

    if (settingsError) {
      console.error('Error resetting user settings:', settingsError)
      // Continue anyway
    }

    return NextResponse.json({ 
      success: true,
      message: 'All your data has been permanently deleted. Your account remains active.'
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/settings/delete-data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
