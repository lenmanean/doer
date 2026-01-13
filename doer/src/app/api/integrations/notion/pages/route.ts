import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getKnowledgeProvider } from '@/lib/knowledge/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * List available Notion pages
 * GET /api/integrations/notion/pages?query=...
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

    // Search for pages
    const pages = await provider.searchPages(accessToken, query)

    return NextResponse.json({
      pages,
    })
  } catch (error) {
    logger.error('Failed to list Notion pages', error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list pages' },
      { status: 500 }
    )
  }
}

