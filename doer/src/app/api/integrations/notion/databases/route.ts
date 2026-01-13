import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getKnowledgeProvider } from '@/lib/knowledge/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * List available Notion databases
 * GET /api/integrations/notion/databases?query=...
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

    // Get query parameter
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query') || undefined

    // Get user's Notion connection
    const { data: connection, error: connectionError } = await supabase
      .from('notion_connections')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Notion connection found' },
        { status: 404 }
      )
    }

    // Get provider instance
    const provider = getKnowledgeProvider('notion')
    const accessToken = await provider.getAccessToken(connection.id)

    // Search for databases
    const databases = await provider.searchDatabases(accessToken, query)

    return NextResponse.json({
      databases,
    })
  } catch (error) {
    logger.error('Failed to list Notion databases', error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list databases' },
      { status: 500 }
    )
  }
}

