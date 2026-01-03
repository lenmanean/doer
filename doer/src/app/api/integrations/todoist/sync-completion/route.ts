import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncTaskCompletionToTodoist } from '@/lib/task-management/sync-hooks'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Sync task completion status to Todoist
 * POST /api/integrations/todoist/sync-completion
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
        { error: 'taskId and isCompleted are required' },
        { status: 400 }
      )
    }

    // Sync to Todoist (this is best effort - don't fail if sync fails)
    await syncTaskCompletionToTodoist(user.id, taskId, isCompleted)

    return NextResponse.json({ success: true })
  } catch (error) {
    // Don't return error - sync is best effort
    return NextResponse.json({ success: true })
  }
}

