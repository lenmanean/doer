/**
 * Shared authentication utility for API routes
 * Supports both API token authentication and session authentication (fallback)
 */

import { createClient } from '@/lib/supabase/server'
import { authenticateApiRequest, ApiTokenError, type ApiAuthContext, type ApiAuthOptions } from '@/lib/auth/api-token-auth'
import { CreditService } from '@/lib/usage/credit-service'
import type { UsageMetric } from '@/lib/billing/plans'

export interface RouteAuthContext extends ApiAuthContext {
  reserved: boolean
}

export interface RouteAuthOptions extends ApiAuthOptions {
  creditMetric?: UsageMetric
  creditCost?: number
  routeName?: string
}

/**
 * Authenticate request using API token or session (fallback)
 * Returns unified auth context with credit service
 * 
 * Credit reservation is handled automatically if creditCost and routeName are provided.
 * Returns reserved flag to track if credits were reserved (for cleanup on error).
 */
export async function authenticateApiRoute(
  headers: Headers,
  options: RouteAuthOptions = {}
): Promise<RouteAuthContext> {
  const { requiredScopes, creditMetric = 'api_credits', creditCost, routeName } = options

  let authContext: ApiAuthContext | null = null

  // Try API token authentication first
  try {
    authContext = await authenticateApiRequest(headers, {
      requiredScopes,
    })
  } catch (authError) {
    // If API token auth fails, try session auth (for web UI)
    if (!(authError instanceof ApiTokenError)) {
      // Re-throw non-auth errors (e.g., network errors)
      throw authError
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    // For session auth, create a CreditService instance
    const creditService = new CreditService(user.id, undefined)
    await creditService.getSubscription()

    authContext = {
      tokenId: '', // Empty string for session auth
      userId: user.id,
      scopes: [], // No scopes for session auth
      expiresAt: null,
      creditService,
    }
  }

  if (!authContext) {
    throw new Error('Failed to authenticate request')
  }

  // Reserve credits if credit cost is specified
  let reserved = false
  if (creditCost !== undefined && creditCost > 0 && routeName) {
    await authContext.creditService.reserve(creditMetric, creditCost, {
      route: routeName,
    })
    reserved = true
  }

  return {
    ...authContext,
    reserved,
  }
}
