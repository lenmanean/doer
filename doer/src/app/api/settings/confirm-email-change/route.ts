import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiError, handleApiError } from '@/lib/errors/api-error'
import { verifyOtp } from '@/lib/security/otp'
import { logger } from '@/lib/logger'
import { updateAuthEmail } from '@/lib/supabase/user-mutations'
import { logEmailChange } from '@/lib/audit/log-change'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

const MAX_OTP_ATTEMPTS = 5

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

    const payload = await request.json().catch(() => ({}))
    const requestId = String(payload?.requestId || '')
    const otp = String(payload?.otp || '').trim()

    if (!requestId || !otp) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Request ID and verification code are required.')
    }

    const {
      data: changeRequest,
      error: requestError,
    } = await supabase
      .from('email_change_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .single()

    if (requestError || !changeRequest) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Email change request not found.')
    }

    if (changeRequest.status !== 'pending') {
      throw new ApiError(
        400,
        'REQUEST_NOT_PENDING',
        'This email change request is no longer active. Please start again.'
      )
    }

    const now = new Date()
    if (new Date(changeRequest.otp_expires_at) < now) {
      await supabase
        .from('email_change_requests')
        .update({ status: 'expired' })
        .eq('id', requestId)

      await logEmailChange({
        userId: user.id,
        oldEmail: user.email,
        newEmail: changeRequest.new_email,
        status: 'expired',
        context: {
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          userAgent: request.headers.get('user-agent'),
        },
      })

      throw new ApiError(400, 'OTP_EXPIRED', 'This code has expired. Please request a new one.')
    }

    const isValidOtp = verifyOtp({
      code: otp,
      hash: changeRequest.otp_hash,
      salt: changeRequest.otp_salt,
    })

    if (!isValidOtp) {
      const nextAttempts = (changeRequest.attempt_count || 0) + 1
      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        await supabase
          .from('email_change_requests')
          .update({ status: 'cancelled', attempt_count: nextAttempts })
          .eq('id', requestId)

        throw new ApiError(
          400,
          'OTP_TOO_MANY_ATTEMPTS',
          'Too many invalid attempts. Please start the process again.'
        )
      }

      await supabase
        .from('email_change_requests')
        .update({ attempt_count: nextAttempts })
        .eq('id', requestId)

      throw new ApiError(400, 'OTP_INVALID', 'Invalid verification code. Please try again.')
    }

    await updateAuthEmail({
      userId: user.id,
      email: changeRequest.new_email,
    })

    const verificationContext = {
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    }

    const { error: finalizeError } = await supabase
      .from('email_change_requests')
      .update({
        status: 'confirmed',
        verified_at: now.toISOString(),
        verification_ip: verificationContext.ip,
        verification_user_agent: verificationContext.userAgent,
      })
      .eq('id', requestId)

    if (finalizeError) {
      logger.error('Failed to finalize email change request', finalizeError as Error, {
        userId: user.id,
      })
      throw new ApiError(500, 'EMAIL_CHANGE_FAILED', 'Unable to finish email change.')
    }

    await logEmailChange({
      userId: user.id,
      oldEmail: user.email,
      newEmail: changeRequest.new_email,
      status: 'confirmed',
      context: verificationContext,
    })

    return NextResponse.json({
      success: true,
      newEmail: changeRequest.new_email,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

