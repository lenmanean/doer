import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyTaskCompleted } from '@/lib/notifications/notification-hooks'
import { logger } from '@/lib/logger'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Notify about task completion
 * POST /api/notifications/task-completed
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
    const { taskId, taskName } = body

    if (!taskId || !taskName) {
      return NextResponse.json(
        { error: 'taskId and taskName are required' },
        { status: 400 }
      )
    }

    // Send notification (best effort - don't fail if it doesn't work)
    await notifyTaskCompleted(user.id, taskId, taskName)

    return NextResponse.json({ success: true })
  } catch (error) {
    // Log but don't fail - notifications are best effort
    logger.error('Failed to send task completion notification', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false })
  }
}

