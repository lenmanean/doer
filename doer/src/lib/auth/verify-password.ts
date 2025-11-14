import { getEnvConfig } from '@/lib/config/env'
import { logger } from '@/lib/logger'

interface VerifyPasswordResult {
  valid: boolean
  error?: string
}

export async function verifySupabasePassword(
  email: string,
  password: string
): Promise<VerifyPasswordResult> {
  const {
    supabase: { url, anonKey },
  } = getEnvConfig()

  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })

    if (response.ok) {
      return { valid: true }
    }

    const payload = await response.json().catch(() => ({}))

    if (payload?.error_description?.toLowerCase().includes('invalid login')) {
      return { valid: false, error: 'Invalid password' }
    }

    return {
      valid: false,
      error: payload?.error_description || 'Failed to verify password',
    }
  } catch (error) {
    logger.error('Failed to verify Supabase password', error as Error)
    return { valid: false, error: 'Unable to verify password right now' }
  }
}

