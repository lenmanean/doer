import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiError, handleApiError } from '@/lib/errors/api-error'
import { normalizeEmail, validateEmail } from '@/lib/validation/email'
import { verifySupabasePassword } from '@/lib/auth/verify-password'
import { getRateLimitKey, rateLimiter } from '@/lib/rate-limit'
import { generateOtpCode, hashOtp } from '@/lib/security/otp'
import { sendEmail } from '@/lib/email/mailer'
import { logger } from '@/lib/logger'
import { logEmailChange } from '@/lib/audit/log-change'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'
import { getServiceRoleClient } from '@/lib/supabase/service-role'

const EMAIL_CHANGE_RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
}

const OTP_EXPIRATION_MINUTES = 30

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.email) {
      throw new ApiError(401, 'UNAUTHORIZED', 'You must be signed in to continue.')
    }

    const rateKey = `change-email:${getRateLimitKey(request, user.id)}`
    if (
      !rateLimiter.check(
        rateKey,
        EMAIL_CHANGE_RATE_LIMIT.limit,
        EMAIL_CHANGE_RATE_LIMIT.windowMs
      )
    ) {
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'You have requested too many email changes. Please try again later.'
      )
    }

    const payload = await request.json().catch(() => ({}))
    const newEmail = normalizeEmail(String(payload?.newEmail || ''))
    const currentPassword = String(payload?.currentPassword || '')

    if (!currentPassword) {
      throw new ApiError(400, 'PASSWORD_REQUIRED', 'Your current password is required.')
    }

    const validation = validateEmail(newEmail)
    if (!validation.valid) {
      throw new ApiError(400, 'INVALID_EMAIL', validation.message || 'Invalid email address.')
    }

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new ApiError(400, 'EMAIL_UNCHANGED', 'Please enter a different email.')
    }

    const passwordCheck = await verifySupabasePassword(user.email, currentPassword)
    if (!passwordCheck.valid) {
      throw new ApiError(400, 'INVALID_PASSWORD', passwordCheck.error || 'Invalid password.')
    }

    const serviceClient = getServiceRoleClient()
    await serviceClient
      .from('email_change_requests')
      .update({ status: 'cancelled' })
      .eq('user_id', user.id)
      .eq('status', 'pending')

    const otp = generateOtpCode()
    const { hash, salt } = hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000)

    const requestContext = {
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    }

    const {
      data: requestRecord,
      error: insertError,
    } = await supabase
      .from('email_change_requests')
      .insert({
        user_id: user.id,
        new_email: newEmail,
        otp_hash: hash,
        otp_salt: salt,
        otp_expires_at: expiresAt.toISOString(),
        status: 'pending',
        requested_ip: requestContext.ip,
        user_agent: requestContext.userAgent,
      })
      .select('id')
      .single()

    if (insertError || !requestRecord) {
      logger.error('Failed to create email change request', insertError as Error, {
        userId: user.id,
      })
      throw new ApiError(500, 'EMAIL_REQUEST_FAILED', 'Unable to start email change flow.')
    }

    const html = `
      <p>Hi ${user.user_metadata?.first_name || 'there'},</p>
      <p>We received a request to change the email on your DOER account to <strong>${newEmail}</strong>.</p>
      <p>Use the following verification code within ${OTP_EXPIRATION_MINUTES} minutes to confirm this change:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 6px;">${otp}</p>
      <p>If you did not request this change, please ignore this email.</p>
    `

    try {
      await sendEmail({
        to: newEmail,
        subject: 'Verify your new DOER email address',
        html,
        text: `Your DOER email verification code is ${otp}`,
      })
    } catch (emailError) {
      await supabase
        .from('email_change_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestRecord.id)

      logger.error('Failed to send email change OTP', emailError as Error, {
        userId: user.id,
      })

      throw new ApiError(
        500,
        'EMAIL_SEND_FAILED',
        'Unable to send verification email. Please try again later.'
      )
    }

    await logEmailChange({
      userId: user.id,
      oldEmail: user.email,
      newEmail,
      status: 'pending',
      context: requestContext,
    })

    return NextResponse.json({
      success: true,
      requestId: requestRecord.id,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

