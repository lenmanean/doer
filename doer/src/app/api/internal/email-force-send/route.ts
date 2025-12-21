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
  
  // Verify preview secret for security - return 404 if invalid (don't expose route exists)
  const authHeader = request.headers.get('x-internal-preview-secret')
  const previewSecret = process.env.INTERNAL_PREVIEW_SECRET

  // Diagnostic logging via console.log (appears in Vercel function logs)
  console.log('[EMAIL-FORCE-SEND] Auth check:', {
    hasEnvVar: !!previewSecret,
    envVarLength: previewSecret?.length || 0,
    hasAuthHeader: !!authHeader,
    authHeaderLength: authHeader?.length || 0,
    lengthsMatch: previewSecret?.length === authHeader?.length,
  })

  if (!previewSecret || authHeader !== previewSecret) {
    console.log('[EMAIL-FORCE-SEND] Auth failed - returning 404')
    return new NextResponse(null, { status: 404 })
  }

  console.log('[EMAIL-FORCE-SEND] Auth passed')

  try {
    console.log('[EMAIL-FORCE-SEND] Parsing request body...')
    const body = await request.json()
    const { type } = body

    console.log('[EMAIL-FORCE-SEND] Request parsed:', {
      hasType: !!type,
      typeValue: type,
    })

    // Validate email type
    if (!type || !['welcome', 'week_out', 'launch'].includes(type)) {
      console.log('[EMAIL-FORCE-SEND] Invalid type - returning 404:', type)
      return new NextResponse(null, { status: 404 })
    }

    console.log('[EMAIL-FORCE-SEND] Type validated:', type)

    // Hardcoded internal recipient
    const internalRecipient = 'bushybrowboi@gmail.com'
    
    console.log('[EMAIL-FORCE-SEND] Preparing to send email:', {
      type,
      recipient: internalRecipient,
    })
    
    // Get base URL for unsubscribe links
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usedoer.com'
    const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(internalRecipient)}`
    const signupUrl = `${baseUrl}/auth/signup`

    // Select email template based on type - using exact same templates as production
    // Using custom domain (not test domain) since test domain only allows account owner's email
    let emailResult
    let tag: string
    let subject: string

    console.log('[EMAIL-FORCE-SEND] Selecting email template for type:', type)

    switch (type) {
      case 'welcome': {
        tag = 'force-review-welcome'
        subject = 'Welcome to DOER!'
        console.log('[EMAIL-FORCE-SEND] Sending welcome email...')
        emailResult = await sendResendEmail({
          to: internalRecipient,
          subject,
          react: Email0Welcome({ unsubscribeUrl }),
          tag,
          // Using custom domain - DNS is verified, should work
        })
        console.log('[EMAIL-FORCE-SEND] Welcome email result:', { success: emailResult.success })
        break
      }
      case 'week_out': {
        tag = 'force-review-week-out'
        subject = 'Launch is One Week Away!'
        console.log('[EMAIL-FORCE-SEND] Sending week-out email...')
        emailResult = await sendResendEmail({
          to: internalRecipient,
          subject,
          react: EmailWeekOut({ unsubscribeUrl }),
          tag,
          // Using custom domain - DNS is verified, should work
        })
        console.log('[EMAIL-FORCE-SEND] Week-out email result:', { success: emailResult.success })
        break
      }
      case 'launch': {
        tag = 'force-review-launch'
        subject = 'DOER is Live! 🎉'
        console.log('[EMAIL-FORCE-SEND] Sending launch email...')
        emailResult = await sendResendEmail({
          to: internalRecipient,
          subject,
          react: EmailLaunch({ unsubscribeUrl, signupUrl }),
          tag,
          // Using custom domain - DNS is verified, should work
        })
        console.log('[EMAIL-FORCE-SEND] Launch email result:', { success: emailResult.success })
        break
      }
      default: {
        // This should never happen due to validation above
        return new NextResponse(null, { status: 404 })
      }
    }

    if (emailResult.success) {
      console.log('[EMAIL-FORCE-SEND] Email sent successfully:', {
        type,
        messageId: emailResult.messageId,
      })
      return NextResponse.json({
        sent: true,
        type,
      })
    } else {
      console.log('[EMAIL-FORCE-SEND] Email send failed - returning 404:', {
        type,
        error: emailResult.error,
      })
      // Return 404 on failure to avoid exposing errors
      return new NextResponse(null, { status: 404 })
    }
  } catch (error) {
    console.log('[EMAIL-FORCE-SEND] Exception caught - returning 404:', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Return 404 on error to avoid exposing route
    return new NextResponse(null, { status: 404 })
  }
}

