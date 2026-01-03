import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/task-management/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Get Todoist projects
 * GET /api/integrations/todoist/projects
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's Todoist connection
    const { data: connection, error: connectionError } = await supabase
      .from('task_management_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'todoist')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Todoist connection found' },
        { status: 404 }
      )
    }

    // Get provider and fetch projects
    const provider = getProvider('todoist')
    const projects = await provider.getProjects(connection.id)

    return NextResponse.json({
      projects,
    })
  } catch (error) {
    logger.error('Failed to fetch Todoist projects', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

