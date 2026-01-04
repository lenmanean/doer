import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering for interactive components
export const dynamic = 'force-dynamic'

/**
 * Slack Interactive Components handler
 * POST /api/integrations/slack/interactive
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const formData = new URLSearchParams(rawBody)
    const payloadStr = formData.get('payload') as string

    if (!payloadStr) {
      logger.warn('Slack interactive component missing payload')
      return NextResponse.json(
        { error: 'Missing payload' },
        { status: 400 }
      )
    }

    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')

    if (!signature || !timestamp) {
      logger.warn('Slack interactive component missing signature or timestamp')
      return NextResponse.json(
        { error: 'Missing signature or timestamp' },
        { status: 401 }
      )
    }

    // Verify request signature using raw body
    const provider = getProvider('slack')
    const slackProvider = provider as import('@/lib/notifications/providers/slack-provider').SlackProvider
    
    if (!slackProvider.verifyRequest(timestamp, signature, rawBody)) {
      logger.warn('Slack interactive component signature verification failed')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse payload (URL-encoded JSON)
    const payload = JSON.parse(payloadStr)

    // Handle different interaction types
    if (payload.type === 'block_actions') {
      return await handleBlockActions(payload)
    } else if (payload.type === 'view_submission') {
      return await handleViewSubmission(payload)
    } else if (payload.type === 'view_closed') {
      return await handleViewClosed(payload)
    }

    // Unknown interaction type
    logger.warn('Unknown Slack interaction type', { type: payload.type })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Error processing Slack interactive component', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ ok: true })
  }
}

/**
 * Handle block actions (button clicks, etc.)
 */
async function handleBlockActions(payload: any): Promise<NextResponse> {
  const actions = payload.actions || []
  
  for (const action of actions) {
    if (action.action_id) {
      // Handle approve reschedule
      if (action.action_id.startsWith('approve_reschedule_')) {
        const taskScheduleId = action.action_id.replace('approve_reschedule_', '')
        // TODO: Implement reschedule approval
        logger.info('Reschedule approved', { taskScheduleId })
        return NextResponse.json({
          text: 'Reschedule approved. The task has been updated.',
          replace_original: true,
        })
      }

      // Handle reject reschedule
      if (action.action_id.startsWith('reject_reschedule_')) {
        const taskScheduleId = action.action_id.replace('reject_reschedule_', '')
        // TODO: Implement reschedule rejection
        logger.info('Reschedule rejected', { taskScheduleId })
        return NextResponse.json({
          text: 'Reschedule rejected. The task remains unchanged.',
          replace_original: true,
        })
      }

      // Handle task completion
      if (action.action_id.startsWith('complete_task_')) {
        const taskId = action.action_id.replace('complete_task_', '')
        // TODO: Implement task completion
        logger.info('Task completed via Slack', { taskId })
        return NextResponse.json({
          text: 'Task marked as complete! ✅',
          replace_original: true,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

/**
 * Handle view submission (modal submissions)
 */
async function handleViewSubmission(payload: any): Promise<NextResponse> {
  // TODO: Implement modal submission handling
  logger.info('View submission received', { viewId: payload.view?.id })
  return NextResponse.json({ ok: true })
}

/**
 * Handle view closed (modal closed)
 */
async function handleViewClosed(payload: any): Promise<NextResponse> {
  // TODO: Implement view closed handling if needed
  return NextResponse.json({ ok: true })
}

