import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/settings/delete-tasks
 * Deletes selected tasks by their IDs
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { task_ids } = body

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json(
        { error: 'task_ids array is required' },
        { status: 400 }
      )
    }

    // Verify all tasks belong to the user before deletion
    const { data: tasks, error: verifyError } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', user.id)
      .in('id', task_ids)

    if (verifyError) {
      console.error('Error verifying tasks:', verifyError)
      return NextResponse.json(
        { error: 'Failed to verify tasks' },
        { status: 500 }
      )
    }

    if (!tasks || tasks.length !== task_ids.length) {
      return NextResponse.json(
        { error: 'Some tasks not found or access denied' },
        { status: 403 }
      )
    }

    // Delete task schedules first
    const { error: scheduleError } = await supabase
      .from('task_schedule')
      .delete()
      .eq('user_id', user.id)
      .in('task_id', task_ids)

    if (scheduleError) {
      console.error('Error deleting task schedules:', scheduleError)
      // Continue anyway
    }

    // Delete the tasks
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .in('id', task_ids)

    if (deleteError) {
      console.error('Error deleting tasks:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete tasks' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully deleted ${task_ids.length} task(s).`,
      deleted_count: task_ids.length
    })
  } catch (error) {
    console.error('Error deleting tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}












