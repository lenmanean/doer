import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncTaskCompletionToTrello } from '@/lib/task-management/sync-hooks'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Sync task completion status to Trello
 * POST /api/integrations/trello/sync-completion
 * Body: { taskId: string, isCompleted: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { taskId, isCompleted } = body

    if (!taskId || typeof isCompleted !== 'boolean') {
      return NextResponse.json(
        { error: 'taskId and isCompleted (boolean) are required' },
        { status: 400 }
      )
    }

    // Call sync function
    await syncTaskCompletionToTrello(user.id, taskId, isCompleted)

    return NextResponse.json({
      success: true,
      message: 'Task completion synced to Trello',
    })
  } catch (error) {
    logger.error('Failed to sync task completion to Trello', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to sync task completion' },
      { status: 500 }
    )
  }
}

