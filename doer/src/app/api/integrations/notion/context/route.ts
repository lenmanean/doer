import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getKnowledgeProvider } from '@/lib/knowledge/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Fetch context from Notion pages/databases
 * POST /api/integrations/notion/context
 * Body: { page_ids?: string[], database_ids?: string[] }
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

    // Parse request body
    const body = await request.json()
    const { page_ids, database_ids } = body

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

    const contentParts: string[] = []

    // Fetch content from pages
    if (page_ids && Array.isArray(page_ids) && page_ids.length > 0) {
      for (const pageId of page_ids.slice(0, 5)) { // Limit to 5 pages
        try {
          const pageContent = await provider.getPageContent(accessToken, pageId)
          contentParts.push(`## ${pageContent.title}\n${pageContent.content}`)
        } catch (error) {
          logger.warn('Failed to fetch Notion page content', { pageId, error })
        }
      }
    }

    // Fetch content from databases
    if (database_ids && Array.isArray(database_ids) && database_ids.length > 0) {
      for (const databaseId of database_ids.slice(0, 2)) { // Limit to 2 databases
        try {
          const dbContent = await provider.getDatabaseContent(accessToken, databaseId)
          // Convert database entries to text (first 10 entries)
          const entriesText = dbContent.slice(0, 10).map((entry: any) => {
            // Extract properties as text
            return Object.entries(entry.properties || {})
              .map(([key, value]: [string, any]) => `${key}: ${JSON.stringify(value)}`)
              .join(', ')
          }).join('\n')
          
          if (entriesText) {
            contentParts.push(`## Database Content\n${entriesText}`)
          }
        } catch (error) {
          logger.warn('Failed to fetch Notion database content', { databaseId, error })
        }
      }
    }

    // Combine all content
    let combinedContent = contentParts.join('\n\n---\n\n')

    // Limit to 5000 characters
    const MAX_CONTEXT_LENGTH = 5000
    if (combinedContent.length > MAX_CONTEXT_LENGTH) {
      combinedContent = combinedContent.substring(0, MAX_CONTEXT_LENGTH - 50) + '\n\n[Content truncated...]'
    }

    return NextResponse.json({
      context: combinedContent || null,
    })
  } catch (error) {
    logger.error('Failed to fetch Notion context', error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch context' },
      { status: 500 }
    )
  }
}

