import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'

export async function updateAuthUsername(params: {
  userId: string
  username: string
  metadata?: Record<string, unknown>
}) {
  try {
    const supabase = getServiceRoleClient()
    await supabase.auth.admin.updateUserById(params.userId, {
      user_metadata: {
        ...(params.metadata || {}),
        username: params.username,
      },
    })
  } catch (error) {
    logger.error('Failed to update auth username', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId: params.userId,
    })
    throw error
  }
}

export async function updateAuthEmail(params: {
  userId: string
  email: string
}) {
  try {
    const supabase = getServiceRoleClient()
    await supabase.auth.admin.updateUserById(params.userId, {
      email: params.email,
      email_confirm: true,
    })
  } catch (error) {
    logger.error('Failed to update auth email', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId: params.userId,
    })
    throw error
  }
}

