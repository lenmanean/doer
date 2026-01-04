import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/notifications/providers/provider-factory'
import { logger } from '@/lib/logger'

// Force dynamic rendering for webhooks
export const dynamic = 'force-dynamic'

/**
 * Slack Events API webhook handler
 * POST /api/integrations/slack/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')

    // Parse payload first to check if it's a URL verification challenge
    let payload: any
    try {
      payload = JSON.parse(body)
    } catch (parseError) {
      logger.warn('Failed to parse Slack webhook body', { error: parseError })
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Handle URL verification challenge (must respond immediately)
    if (payload.type === 'url_verification' && payload.challenge) {
      // For URL verification, we should still verify signature, but be lenient
      if (signature && timestamp) {
        try {
          const provider = getProvider('slack')
          const slackProvider = provider as import('@/lib/notifications/providers/slack-provider').SlackProvider
          if (!slackProvider.verifyRequest(timestamp, signature, body)) {
            logger.warn('Slack URL verification signature check failed, but returning challenge anyway')
          }
        } catch (verifyError) {
          logger.warn('Error verifying URL verification signature', { error: verifyError })
          // Continue anyway - return challenge
        }
      }
      
      return NextResponse.json({
        challenge: payload.challenge,
      })
    }

    // For non-challenge requests, verify signature
    if (!signature || !timestamp) {
      logger.warn('Slack webhook missing signature or timestamp')
      return NextResponse.json(
        { error: 'Missing signature or timestamp' },
        { status: 401 }
      )
    }

    // Verify request signature
    const provider = getProvider('slack')
    const slackProvider = provider as import('@/lib/notifications/providers/slack-provider').SlackProvider
    
    if (!slackProvider.verifyRequest(timestamp, signature, body)) {
      logger.warn('Slack webhook signature verification failed')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Handle event callbacks
    if (payload.type === 'event_callback') {
      const event = payload.event

      // Process events asynchronously (Slack requires < 3s response)
      // Don't await - return immediately
      processEventAsync(event, payload.team_id).catch((error) => {
        logger.error('Error processing Slack event', {
          error: error instanceof Error ? error.message : String(error),
          eventType: event?.type,
          teamId: payload.team_id,
        })
      })

      return NextResponse.json({ ok: true })
    }

    // Unknown event type
    logger.warn('Unknown Slack webhook event type', {
      type: payload.type,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Error processing Slack webhook', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    // Return 200 to prevent Slack from retrying
    return NextResponse.json({ ok: true })
  }
}

/**
 * Process Slack event asynchronously
 */
async function processEventAsync(event: any, teamId: string) {
  try {
    // Handle app mentions
    if (event.type === 'app_mention') {
      logger.info('Slack app mention received', {
        teamId,
        channel: event.channel,
        user: event.user,
        text: event.text,
      })
      // TODO: Implement app mention handling (e.g., respond with help)
    }

    // Handle direct messages
    if (event.type === 'message' && event.subtype !== 'bot_message') {
      // Check if it's a direct message (channel type is 'im')
      if (event.channel_type === 'im') {
        logger.info('Slack direct message received', {
          teamId,
          channel: event.channel,
          user: event.user,
          text: event.text,
        })
        // TODO: Implement direct message handling
      }
    }

    // Handle token revocation
    if (event.type === 'tokens_revoked') {
      logger.info('Slack tokens revoked', { teamId })
      // TODO: Clean up connections for this team
      // This would require finding all connections with this team_id and deleting them
    }
  } catch (error) {
    logger.error('Error in async event processing', {
      error: error instanceof Error ? error.message : String(error),
      eventType: event?.type,
      teamId,
    })
  }
}

