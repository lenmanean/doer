import { NextRequest, NextResponse } from 'next/server'
import { sendResendEmail } from '@/lib/email/resend'
import { logger } from '@/lib/logger'
import { Email0Welcome } from '@/emails/waitlist/Email0Welcome'
import { EmailWeekOut } from '@/emails/waitlist/EmailWeekOut'
import { EmailLaunch } from '@/emails/waitlist/EmailLaunch'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * TEST-ONLY route for email preview and verification
 * 
 * This route is for content and delivery verification only.
 * It does NOT write to the database, does NOT update timestamps,
 * and does NOT interact with any production waitlist logic.
 * 
 * Secure with INTERNAL_PREVIEW_SECRET header.
 * 
 * @deprecated This is a test-only route and can be safely removed after verification.
 */
export async function POST(request: NextRequest) {
  // Verify preview secret for security
  const authHeader = request.headers.get('x-internal-preview-secret')
  const previewSecret = process.env.INTERNAL_PREVIEW_SECRET

  if (!previewSecret || authHeader !== previewSecret) {
    logger.warn('Unauthorized email preview request', { hasAuthHeader: !!authHeader })
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { type } = body

    // Validate email type
    if (!type || !['welcome', 'week_out', 'launch'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "welcome", "week_out", or "launch"' },
        { status: 400 }
      )
    }

    // Hardcoded test recipient
    const testRecipient = 'bushybrowboi@gmail.com'
    
    // Get base URL for unsubscribe links (using default for preview)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'
    const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(testRecipient)}`
    const signupUrl = `${baseUrl}/auth/signup`

    // Select email template based on type
    let emailResult
    let emailType: string
    let tag: string
    let subject: string

    switch (type) {
      case 'welcome': {
        emailType = 'Welcome'
        tag = 'preview-welcome'
        subject = 'Welcome to DOER!'
        emailResult = await sendResendEmail({
          to: testRecipient,
          subject,
          react: Email0Welcome({ unsubscribeUrl }),
          tag,
        })
        break
      }
      case 'week_out': {
        emailType = 'Week-Out'
        tag = 'preview-week-out'
        subject = 'Launch is One Week Away!'
        emailResult = await sendResendEmail({
          to: testRecipient,
          subject,
          react: EmailWeekOut({ unsubscribeUrl }),
          tag,
        })
        break
      }
      case 'launch': {
        emailType = 'Launch'
        tag = 'preview-launch'
        subject = 'DOER is Live! 🎉'
        emailResult = await sendResendEmail({
          to: testRecipient,
          subject,
          react: EmailLaunch({ unsubscribeUrl, signupUrl }),
          tag,
        })
        break
      }
      default: {
        // This should never happen due to validation above, but satisfies TypeScript
        return NextResponse.json(
          { error: 'Invalid type' },
          { status: 400 }
        )
      }
    }

    if (emailResult.success) {
      logger.info('Email preview sent successfully', {
        emailType,
        recipient: testRecipient,
        messageId: emailResult.messageId,
        tag,
      })

      return NextResponse.json({
        success: true,
        emailType,
        recipient: testRecipient,
        messageId: emailResult.messageId,
        tag,
      })
    } else {
      logger.error('Email preview send failed', {
        emailType,
        recipient: testRecipient,
        error: emailResult.error,
        tag,
      })

      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || 'Failed to send preview email',
          emailType,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('Unexpected error in email preview route', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



