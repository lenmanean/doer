import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getKnowledgeProvider } from '@/lib/knowledge/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Export plan to Notion page
 * POST /api/integrations/notion/export
 * Body: { plan_id: string, parent_page_id?: string }
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
    const { plan_id, parent_page_id } = body

    if (!plan_id) {
      return NextResponse.json(
        { error: 'plan_id is required' },
        { status: 400 }
      )
    }

    // Verify plan belongs to user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, goal_text, summary_data, start_date, end_date')
      .eq('id', plan_id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Get user's Notion connection
    const { data: connection, error: connectionError } = await supabase
      .from('notion_connections')
      .select('id, default_page_id')
      .eq('user_id', user.id)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Notion connection found' },
        { status: 404 }
      )
    }

    // Determine parent page (from body, connection.default_page_id, or require selection)
    const targetParentPageId = parent_page_id || connection.default_page_id

    if (!targetParentPageId) {
      return NextResponse.json(
        { error: 'Parent page is required. Please select a parent page in settings.' },
        { status: 400 }
      )
    }

    // Fetch plan tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, details, estimated_duration_minutes, priority, idx')
      .eq('plan_id', plan_id)
      .order('idx', { ascending: true })

    if (tasksError) {
      logger.error('Failed to fetch plan tasks', tasksError as Error)
      return NextResponse.json(
        { error: 'Failed to fetch plan tasks' },
        { status: 500 }
      )
    }

    // Get provider instance
    const provider = getKnowledgeProvider('notion')
    const accessToken = await provider.getAccessToken(connection.id)

    // Get plan title
    const planTitle = plan.summary_data?.goal_title || plan.goal_text || 'DOER Plan'

    // Build Notion page blocks from plan data
    const blocks: any[] = []

    // Add plan summary
    if (plan.summary_data?.plan_summary) {
      blocks.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: plan.summary_data.plan_summary },
            },
          ],
        },
      })
    }

    // Add timeline
    if (plan.start_date && plan.end_date) {
      const startDate = new Date(plan.start_date).toLocaleDateString()
      const endDate = new Date(plan.end_date).toLocaleDateString()
      blocks.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: `Timeline: ${startDate} - ${endDate}` },
            },
          ],
        },
      })
    }

    // Add heading for tasks
    blocks.push({
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: { content: 'Tasks' },
          },
        ],
      },
    })

    // Add tasks as list items
    for (const task of tasks || []) {
      const priorityLabels: Record<number, string> = {
        1: 'Critical',
        2: 'High',
        3: 'Medium',
        4: 'Low',
      }
      const priorityLabel = priorityLabels[task.priority] || 'Medium'
      const duration = task.estimated_duration_minutes || 0
      const durationText = duration > 0 ? ` (${duration} min)` : ''

      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            {
              type: 'text',
              text: { content: `${task.name} - Priority ${task.priority} (${priorityLabel})${durationText}` },
            },
          ],
        },
      })

      if (task.details) {
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content: task.details },
              },
            ],
          },
        })
      }
    }

    // Check if page already exists
    const { data: existingLink } = await supabase
      .from('notion_page_links')
      .select('notion_page_id')
      .eq('plan_id', plan_id)
      .eq('connection_id', connection.id)
      .single()

    let notionPageId: string

    if (existingLink?.notion_page_id) {
      // Update existing page
      notionPageId = existingLink.notion_page_id
      // Note: Notion API doesn't support replacing all blocks easily
      // For now, we'll create a new page. In the future, we could update blocks individually.
      // For simplicity, create a new page with updated content
      try {
        await provider.updatePage(accessToken, notionPageId, {
          properties: {
            title: {
              title: [{ text: { content: planTitle } }],
            },
          },
        })
      } catch (error) {
        logger.warn('Failed to update existing Notion page, creating new one', { error })
        // Create new page if update fails
        notionPageId = await provider.createPage(accessToken, targetParentPageId, planTitle, { blocks })
      }
    } else {
      // Create new page
      notionPageId = await provider.createPage(accessToken, targetParentPageId, planTitle, { blocks })
    }

    // Store or update link
    if (existingLink) {
      await supabase
        .from('notion_page_links')
        .update({
          notion_page_id: notionPageId,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', existingLink.notion_page_id)
    } else {
      await supabase
        .from('notion_page_links')
        .insert({
          user_id: user.id,
          connection_id: connection.id,
          plan_id: plan_id,
          notion_page_id: notionPageId,
          last_synced_at: new Date().toISOString(),
        })
    }

    // Get page URL (construct from page ID)
    const pageUrl = `https://notion.so/${notionPageId.replace(/-/g, '')}`

    return NextResponse.json({
      success: true,
      notion_page_id: notionPageId,
      notion_page_url: pageUrl,
    })
  } catch (error) {
    logger.error('Failed to export plan to Notion', error as Error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export plan to Notion' },
      { status: 500 }
    )
  }
}

