import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuthOrError } from '@/lib/api/auth-helpers'
import { badRequestResponse, forbiddenResponse, internalServerErrorResponse, successResponse } from '@/lib/api/error-responses'
import { verifyUserOwnershipArray } from '@/lib/supabase/query-helpers'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/delete-tasks
 * Deletes selected tasks by their IDs
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuthOrError(request)
    if (authResult instanceof Response) {
      return authResult
    }
    const { user } = authResult

    const supabase = await createClient()
    const body = await request.json()
    const { task_ids } = body

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return badRequestResponse('task_ids array is required')
    }

    // Verify all tasks belong to the user before deletion
    const tasks = await verifyUserOwnershipArray(
      supabase,
      'tasks',
      user.id,
      task_ids,
      'id'
    )

    if (tasks.length !== task_ids.length) {
      return forbiddenResponse('Some tasks not found or access denied')
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
      return internalServerErrorResponse('Failed to delete tasks')
    }

    return successResponse({
      success: true,
      message: `Successfully deleted ${task_ids.length} task(s).`,
      deleted_count: task_ids.length
    })
  } catch (error) {
    console.error('Error deleting tasks:', error)
    return internalServerErrorResponse()
  }
}

















