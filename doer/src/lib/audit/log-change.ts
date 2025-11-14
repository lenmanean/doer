import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { logger } from '@/lib/logger'

interface RequestContext {
  ip?: string | null
  userAgent?: string | null
}

export async function logUsernameChange(params: {
  userId: string
  oldUsername: string | null
  newUsername: string
  context?: RequestContext
}): Promise<void> {
  try {
    const supabase = getServiceRoleClient()
    await supabase.from('username_change_audit').insert({
      user_id: params.userId,
      old_username: params.oldUsername,
      new_username: params.newUsername,
      change_ip: params.context?.ip || null,
      user_agent: params.context?.userAgent || null,
    })
  } catch (error) {
    logger.error('Failed to log username change', error as Error, {
      userId: params.userId,
    })
  }
}

export async function logEmailChange(params: {
  userId: string
  oldEmail: string
  newEmail: string
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled'
  context?: RequestContext
}): Promise<void> {
  try {
    const supabase = getServiceRoleClient()
    await supabase.from('email_change_audit').insert({
      user_id: params.userId,
      old_email: params.oldEmail,
      new_email: params.newEmail,
      status: params.status,
      request_ip: params.context?.ip || null,
      user_agent: params.context?.userAgent || null,
    })
  } catch (error) {
    logger.error('Failed to log email change', error as Error, {
      userId: params.userId,
    })
  }
}

