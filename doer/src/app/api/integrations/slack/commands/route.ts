import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Force dynamic rendering for commands
export const dynamic = 'force-dynamic'

/**
 * Slack Slash Commands handler
 * POST /api/integrations/slack/commands
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const formData = new URLSearchParams(rawBody)
    const body = Object.fromEntries(formData.entries())
    
    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')

    if (!signature || !timestamp) {
      logger.warn('Slack command missing signature or timestamp')
      return NextResponse.json(
        { text: 'Error: Missing signature or timestamp' },
        { status: 401 }
      )
    }

    // Verify request signature using raw body
    const provider = getProvider('slack')
    const slackProvider = provider as import('@/lib/notifications/providers/slack-provider').SlackProvider
    
    if (!slackProvider.verifyRequest(timestamp, signature, rawBody)) {
      logger.warn('Slack command signature verification failed')
      return NextResponse.json(
        { text: 'Error: Invalid signature' },
        { status: 401 }
      )
    }

    const command = body.text as string
    const userId = body.user_id as string
    const teamId = body.team_id as string
    const responseUrl = body.response_url as string

    // Get user's Slack connection
    const supabase = await createClient()
    const { data: connection } = await supabase
      .from('slack_connections')
      .select('id, user_id')
      .eq('team_id', teamId)
      .single()

    if (!connection) {
      return NextResponse.json({
        text: 'DOER is not connected to this workspace. Please connect it first at https://usedoer.com/integrations/slack',
      })
    }

    // Parse command
    const commandParts = command ? command.trim().split(/\s+/) : []
    const commandName = commandParts[0]?.toLowerCase() || 'help'

    // Handle commands
    let response: any

    switch (commandName) {
      case 'status':
        response = await handleStatusCommand(connection.user_id)
        break
      case 'plan':
        response = await handlePlanCommand(connection.user_id)
        break
      case 'today':
        response = await handleTodayCommand(connection.user_id)
        break
      case 'reschedule':
        response = await handleRescheduleCommand(connection.user_id, commandParts.slice(1))
        break
      case 'reschedule-all':
        response = await handleRescheduleAllCommand(connection.user_id)
        break
      case 'complete':
        response = await handleCompleteCommand(connection.user_id, commandParts.slice(1))
        break
      case 'help':
      default:
        response = {
          text: 'DOER Slack Commands',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Available Commands:*\n\n`/doer status` - Show current plan status\n`/doer plan` - Show active plan summary\n`/doer today` - Show today\'s scheduled tasks\n`/doer reschedule [task]` - Request reschedule for a task\n`/doer reschedule-all` - Request reschedule for all overdue tasks\n`/doer complete [task]` - Mark a task as complete\n`/doer help` - Show this help message',
              },
            },
          ],
        }
        break
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Error processing Slack command', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({
      text: 'An error occurred processing your command. Please try again later.',
    })
  }
}

/**
 * Handle /doer status command
 */
async function handleStatusCommand(userId: string): Promise<any> {
  const supabase = await createClient()
  
  // Get active plan
  const { data: plan } = await supabase
    .from('plans')
    .select('id, goal_text, summary_data, start_date, end_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!plan) {
    return {
      text: 'No active plan found. Create a plan at https://usedoer.com',
    }
  }

  // Get task stats
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('plan_id', plan.id)

  const { data: completions } = await supabase
    .from('task_completions')
    .select('task_id')
    .eq('plan_id', plan.id)

  const totalTasks = tasks?.length || 0
  const completedTasks = completions?.length || 0
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Get plan title from summary_data or use goal_text
  const planTitle = plan.summary_data?.goal_title || plan.goal_text || 'Untitled Plan'

  return {
    text: `*${planTitle}*\n\nProgress: ${completedTasks}/${totalTasks} tasks (${progress}%)\nStart: ${new Date(plan.start_date).toLocaleDateString()}\nEnd: ${plan.end_date ? new Date(plan.end_date).toLocaleDateString() : 'N/A'}`,
  }
}

/**
 * Handle /doer plan command
 */
async function handlePlanCommand(userId: string): Promise<any> {
  const supabase = await createClient()
  
  const { data: plan } = await supabase
    .from('plans')
    .select('id, goal_text, summary_data, start_date, end_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!plan) {
    return {
      text: 'No active plan found. Create a plan at https://usedoer.com',
    }
  }

  // Get plan title and summary from summary_data or use goal_text
  const planTitle = plan.summary_data?.goal_title || plan.goal_text || 'Untitled Plan'
  const planSummary = plan.summary_data?.plan_summary || plan.summary_data?.goal_summary || plan.goal_text || 'No description'

  return {
    text: `*${planTitle}*\n\n${planSummary}\n\nStart: ${new Date(plan.start_date).toLocaleDateString()}\nEnd: ${plan.end_date ? new Date(plan.end_date).toLocaleDateString() : 'N/A'}`,
  }
}

/**
 * Handle /doer today command
 */
async function handleTodayCommand(userId: string): Promise<any> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: schedules } = await supabase
    .from('task_schedule')
    .select(`
      id,
      date,
      start_time,
      end_time,
      tasks:task_id (
        id,
        name,
        priority
      )
    `)
    .eq('user_id', userId)
    .eq('date', today)
    .order('start_time', { ascending: true })

  if (!schedules || schedules.length === 0) {
    return {
      text: 'No tasks scheduled for today. Great job! 🎉',
    }
  }

  const taskList = schedules.map((schedule: any) => {
    const task = Array.isArray(schedule.tasks) ? schedule.tasks[0] : schedule.tasks
    const time = schedule.start_time ? new Date(`2000-01-01T${schedule.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day'
    return `• ${time}: ${task?.name || 'Unknown task'}`
  }).join('\n')

  return {
    text: `*Today's Tasks (${schedules.length}):*\n\n${taskList}`,
  }
}

/**
 * Handle /doer reschedule command
 */
async function handleRescheduleCommand(userId: string, args: string[]): Promise<any> {
  // TODO: Implement task reschedule logic
  return {
    text: 'Reschedule functionality coming soon. Use the DOER dashboard to reschedule tasks.',
  }
}

/**
 * Handle /doer reschedule-all command
 */
async function handleRescheduleAllCommand(userId: string): Promise<any> {
  // TODO: Implement reschedule all logic
  return {
    text: 'Reschedule all functionality coming soon. Use the DOER dashboard to reschedule tasks.',
  }
}

/**
 * Handle /doer complete command
 */
async function handleCompleteCommand(userId: string, args: string[]): Promise<any> {
  // TODO: Implement task completion logic
  return {
    text: 'Task completion via Slack coming soon. Use the DOER dashboard to complete tasks.',
  }
}

