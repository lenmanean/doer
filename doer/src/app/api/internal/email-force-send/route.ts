// INTERNAL ONLY – DO NOT USE FOR PRODUCTION SENDS
// This route exists solely for manual email content review before launch.
// It bypasses all eligibility checks, date guards, and database operations.

import { NextRequest, NextResponse } from 'next/server'
import { sendResendEmail } from '@/lib/email/resend'
import { logger } from '@/lib/logger'
import { Email0Welcome } from '@/emails/waitlist/Email0Welcome'
import { EmailWeekOut } from '@/emails/waitlist/EmailWeekOut'
import { EmailLaunch } from '@/emails/waitlist/EmailLaunch'

export const dynamic = 'force-dynamic'

/**
 * POST /api/internal/email-force-send
 * 
 * INTERNAL ONLY – Force-sends production email templates to internal address for review.
 * This route bypasses all production logic (eligibility, date guards, timestamps).
 * 
 * Requires: x-internal-preview-secret header
 * Body: { "type": "welcome" | "week_out" | "launch" }
 */
export async function POST(request: NextRequest) {
  // Immediate console log to verify route is being hit (appears in Vercel function logs)
  console.log('[EMAIL-FORCE-SEND] Route handler executed')
  
  // Diagnostic logging (without exposing secrets)
  logger.info('Internal email-force-send route hit', {
    hasEnvVar: !!process.env.INTERNAL_PREVIEW_SECRET,
    envVarLength: process.env.INTERNAL_PREVIEW_SECRET?.length || 0,
    hasAuthHeader: request.headers.has('x-internal-preview-secret'),
    authHeaderLength: request.headers.get('x-internal-preview-secret')?.length || 0,
  })

  // Verify preview secret for security - return 404 if invalid (don't expose route exists)
  const authHeader = request.headers.get('x-internal-preview-secret')
  const previewSecret = process.env.INTERNAL_PREVIEW_SECRET

  if (!previewSecret || authHeader !== previewSecret) {
    logger.warn('Internal email-force-send auth failed', {
      hasPreviewSecret: !!previewSecret,
      hasAuthHeader: !!authHeader,
      secretLengthsMatch: previewSecret?.length === authHeader?.length,
    })
    return new NextResponse(null, { status: 404 })
  }

  try {
    const body = await request.json()
    const { type } = body

    logger.info('Internal email-force-send request parsed', {
      hasType: !!type,
      typeValue: type,
    })

    // Validate email type
    if (!type || !['welcome', 'week_out', 'launch'].includes(type)) {
      logger.warn('Internal email-force-send invalid type', { type })
      return new NextResponse(null, { status: 404 })
    }

    // Hardcoded internal recipient
    const internalRecipient = 'bushybrowboi@gmail.com'
    
    // Get base URL for unsubscribe links
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'
    const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(internalRecipient)}`
    const signupUrl = `${baseUrl}/auth/signup`

    // Select email template based on type - using exact same templates as production
    let emailResult
    let tag: string
    let subject: string

    switch (type) {
      case 'welcome': {
        tag = 'force-review-welcome'
        subject = 'Welcome to DOER!'
        emailResult = await sendResendEmail({
          to: internalRecipient,
          subject,
          react: Email0Welcome({ unsubscribeUrl }),
          tag,
        })
        break
      }
      case 'week_out': {
        tag = 'force-review-week-out'
        subject = 'Launch is One Week Away!'
        emailResult = await sendResendEmail({
          to: internalRecipient,
          subject,
          react: EmailWeekOut({ unsubscribeUrl }),
          tag,
        })
        break
      }
      case 'launch': {
        tag = 'force-review-launch'
        subject = 'DOER is Live! 🎉'
        emailResult = await sendResendEmail({
          to: internalRecipient,
          subject,
          react: EmailLaunch({ unsubscribeUrl, signupUrl }),
          tag,
        })
        break
      }
      default: {
        // This should never happen due to validation above
        return new NextResponse(null, { status: 404 })
      }
    }

    if (emailResult.success) {
      logger.info('Internal force-send email sent successfully', {
        type,
        recipient: internalRecipient,
        messageId: emailResult.messageId,
        tag,
      })

      return NextResponse.json({
        sent: true,
        type,
      })
    } else {
      logger.error('Internal force-send email failed', {
        type,
        recipient: internalRecipient,
        error: emailResult.error,
        tag,
      })

      // Return 404 on failure to avoid exposing errors
      return new NextResponse(null, { status: 404 })
    }
  } catch (error) {
    logger.error('Unexpected error in internal force-send route', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })

    // Return 404 on error to avoid exposing route
    return new NextResponse(null, { status: 404 })
  }
}

