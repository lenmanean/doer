import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiError, handleApiError } from '@/lib/errors/api-error'
import {
  normalizeUsername,
  validateUsername,
} from '@/lib/validation/username'
import { logger } from '@/lib/logger'
import { getRateLimitKey, rateLimiter } from '@/lib/rate-limit'
import { getServiceRoleClient } from '@/lib/supabase/service-role'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'
import { logUsernameChange } from '@/lib/audit/log-change'
import { updateAuthUsername } from '@/lib/supabase/user-mutations'

const USERNAME_RATE_LIMIT = {
  limit: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'You must be signed in to continue.')
    }

    const rateKey = `change-username:${getRateLimitKey(request, user.id)}`
    if (!rateLimiter.check(rateKey, USERNAME_RATE_LIMIT.limit, USERNAME_RATE_LIMIT.windowMs)) {
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many username updates. Please try again later.'
      )
    }

    const payload = await request.json().catch(() => ({}))
    const normalized = normalizeUsername(String(payload?.username || ''))

    const validation = validateUsername(normalized)
    if (!validation.valid) {
      throw new ApiError(400, 'INVALID_USERNAME', validation.message || 'Invalid username')
    }

    const {
      data: settings,
      error: settingsError,
    } = await supabase
      .from('user_settings')
      .select('id, user_id, username, username_last_changed_at')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings) {
      logger.error('Failed to load user settings for username change', {
        error: settingsError instanceof Error ? settingsError.message : String(settingsError),
        errorStack: settingsError instanceof Error ? settingsError.stack : undefined,
        userId: user.id,
      })
      throw new ApiError(500, 'SETTINGS_NOT_FOUND', 'Unable to load user settings')
    }

    if (settings.username && settings.username.toLowerCase() === normalized.toLowerCase()) {
      throw new ApiError(400, 'USERNAME_UNCHANGED', 'Please choose a different username.')
    }

    if (settings.username_last_changed_at) {
      const lastChanged = new Date(settings.username_last_changed_at)
      const cooldownEnds = new Date(lastChanged.getTime() + 24 * 60 * 60 * 1000)
      if (cooldownEnds.getTime() > Date.now()) {
        const retryInHours = Math.ceil(
          (cooldownEnds.getTime() - Date.now()) / (60 * 60 * 1000)
        )
        throw new ApiError(
          400,
          'USERNAME_COOLDOWN',
          `Usernames can only be changed every 24 hours. Please try again in approximately ${retryInHours} hour(s).`
        )
      }
    }

    const serviceClient = getServiceRoleClient()
    const { data: taken } = await serviceClient
      .from('user_settings')
      .select('user_id')
      .ilike('username', normalized)
      .neq('user_id', user.id)
      .maybeSingle()

    if (taken) {
      throw new ApiError(400, 'USERNAME_TAKEN', 'That username is already in use.')
    }

    const { error: updateError } = await supabase
      .from('user_settings')
      .update({ username: normalized })
      .eq('user_id', user.id)

    if (updateError) {
      if (
        updateError.message?.includes('USERNAME_CHANGE_COOLDOWN') ||
        updateError.details?.includes('USERNAME_CHANGE_COOLDOWN')
      ) {
        throw new ApiError(
          400,
          'USERNAME_COOLDOWN',
          'Usernames can only be changed once every 24 hours.'
        )
      }

      logger.error('Failed to update username', {
        error: updateError instanceof Error ? updateError.message : String(updateError),
        errorStack: updateError instanceof Error ? updateError.stack : undefined,
        userId: user.id,
      })
      throw new ApiError(500, 'USERNAME_UPDATE_FAILED', 'Failed to update username')
    }

    await updateAuthUsername({
      userId: user.id,
      username: normalized,
      metadata: user.user_metadata || {},
    })

    await logUsernameChange({
      userId: user.id,
      oldUsername: settings.username,
      newUsername: normalized,
      context: {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    })

    return NextResponse.json({
      success: true,
      username: normalized,
      cooldownEnds: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

