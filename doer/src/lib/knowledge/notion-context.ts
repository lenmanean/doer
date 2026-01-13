/**
 * Notion Context Service
 * Fetches and formats Notion content for AI plan generation
 */

import { createClient } from '@/lib/supabase/server'
import { getKnowledgeProvider } from '@/lib/knowledge/providers/provider-factory'
import { logger } from '@/lib/logger'

const MAX_CONTEXT_LENGTH = 5000 // Maximum characters to include in AI prompt

export async function fetchNotionContext(userId: string, goalText?: string): Promise<string | null> {
  const supabase = await createClient()
  
  // Fetch user's Notion connection with auto_context_enabled
  const { data: connection } = await supabase
    .from('notion_connections')
    .select('id, selected_page_ids, selected_database_ids')
    .eq('user_id', userId)
    .eq('auto_context_enabled', true)
    .single()

  if (!connection || (!connection.selected_page_ids?.length && !connection.selected_database_ids?.length)) {
    return null
  }

  const provider = getKnowledgeProvider('notion')
  const accessToken = await provider.getAccessToken(connection.id)
  
  const contentParts: string[] = []

  // Fetch content from selected pages
  if (connection.selected_page_ids?.length > 0) {
    for (const pageId of connection.selected_page_ids.slice(0, 5)) { // Limit to 5 pages
      try {
        const pageContent = await provider.getPageContent(accessToken, pageId)
        contentParts.push(`## ${pageContent.title}\n${pageContent.content}`)
      } catch (error) {
        logger.warn('Failed to fetch Notion page content', { pageId, error })
      }
    }
  }

  // Fetch content from selected databases (limited entries)
  if (connection.selected_database_ids?.length > 0) {
    for (const databaseId of connection.selected_database_ids.slice(0, 2)) { // Limit to 2 databases
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

  if (contentParts.length === 0) {
    return null
  }

  // Combine all content
  let combinedContent = contentParts.join('\n\n---\n\n')

  // Truncate if too long (keep first N characters, add truncation marker)
  if (combinedContent.length > MAX_CONTEXT_LENGTH) {
    combinedContent = combinedContent.substring(0, MAX_CONTEXT_LENGTH - 50) + '\n\n[Content truncated...]'
  }

  return combinedContent
}

