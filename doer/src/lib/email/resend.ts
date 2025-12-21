import { Resend } from 'resend'
import { logger } from '@/lib/logger'
import { ReactElement } from 'react'

const resendApiKey = process.env.RESEND_API_KEY

interface SendEmailOptions {
  to: string
  subject: string
  html?: string
  react?: ReactElement
  tag?: string
  from?: string // Optional override for from address (useful for testing)
}

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send email via Resend
 * 
 * @param options - Email options
 * @param options.to - Recipient email address
 * @param options.subject - Email subject
 * @param options.html - HTML content (optional if react is provided)
 * @param options.react - React component to render as email (optional if html is provided)
 * @param options.tag - Email tag for categorization
 * @returns Result object with success status, messageId, and optional error
 */
export async function sendResendEmail({
  to,
  subject,
  html,
  react,
  tag,
  from,
}: SendEmailOptions): Promise<SendEmailResult> {
  if (!resendApiKey) {
    const error = 'RESEND_API_KEY environment variable is not set'
    logger.error('Resend API key missing', { to, subject })
    return {
      success: false,
      error,
    }
  }

  if (!html && !react) {
    const error = 'Either html or react must be provided'
    logger.error('Resend email missing content', { to, subject })
    return {
      success: false,
      error,
    }
  }

  try {
    const resend = new Resend(resendApiKey)

    // Render React component to HTML if provided
    let emailHtml = html
    if (react && !html) {
      try {
        const { render } = await import('@react-email/render')
        emailHtml = await render(react)
      } catch (renderError) {
        logger.error('Failed to render React email component', {
          error: renderError instanceof Error ? renderError.message : String(renderError),
          to,
          subject,
        })
        return {
          success: false,
          error: 'Failed to render email template',
        }
      }
    }

    // Use provided from address or fall back to production domain
    const fromAddress = from || process.env.RESEND_FROM_ADDRESS || 'updates@updates.usedoer.com'
    
    const emailOptions: {
      from: string
      to: string
      subject: string
      html: string
      reply_to?: string
      tags?: Array<{ name: string; value: string }>
    } = {
      from: fromAddress,
      to,
      subject,
      html: emailHtml!,
      reply_to: 'help@usedoer.com',
    }

    if (tag) {
      emailOptions.tags = [{ name: tag, value: 'waitlist' }]
    }

    const { data, error } = await resend.emails.send(emailOptions)

    if (error) {
      logger.error('Resend email send failed', {
        error: error.message || String(error),
        to,
        subject,
        tag,
      })
      return {
        success: false,
        error: error.message || 'Failed to send email',
      }
    }

    if (data?.id) {
      logger.info('Resend email sent successfully', {
        messageId: data.id,
        to,
        subject,
        tag,
      })
      return {
        success: true,
        messageId: data.id,
      }
    }

    // Fallback if no error but no messageId
    logger.warn('Resend email sent but no messageId returned', {
      to,
      subject,
      tag,
      data,
    })
    return {
      success: true,
    }
  } catch (error) {
    logger.error('Resend email exception', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      to,
      subject,
      tag,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

