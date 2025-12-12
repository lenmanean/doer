/**
 * API Authentication Helpers
 * 
 * Provides standardized authentication checking for API routes.
 * Reduces code duplication and ensures consistent auth patterns.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-role'
import { authenticateApiRequest } from '@/lib/auth/api-token-auth'
import type { ApiTokenScope } from '@/lib/billing/plans'
import { unauthorizedResponse } from './error-responses'

export interface AuthContext {
  user: any
  isApiToken: boolean
}

/**
 * Authenticates a request using either API token or session auth
 * 
 * @param req - The incoming request
 * @param options - Optional configuration
 * @returns AuthContext with user and auth method, or null if not authenticated
 */
export async function requireAuth(
  req: NextRequest,
  options?: {
    requiredScopes?: ApiTokenScope[]
    allowApiToken?: boolean
  }
): Promise<AuthContext | null> {
  const { requiredScopes, allowApiToken = true } = options || {}

  // Try API token first if allowed
  if (allowApiToken) {
    try {
      const authContext = await authenticateApiRequest(
        req.headers,
        requiredScopes ? { requiredScopes } : {}
      )
      // Fetch user from Supabase using userId
      const supabase = getServiceRoleClient()
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(authContext.userId)
      
      if (userError || !user) {
        return null
      }
      
      return {
        user,
        isApiToken: true,
      }
    } catch (authError) {
      // Fall through to session auth
    }
  }

  // Fall back to session auth
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  return {
    user,
    isApiToken: false,
  }
}

/**
 * Authenticates a request and returns user or error response
 * 
 * @param req - The incoming request
 * @param options - Optional configuration
 * @returns AuthContext if authenticated, or NextResponse with error
 */
export async function requireAuthOrError(
  req: NextRequest,
  options?: {
    requiredScopes?: ApiTokenScope[]
    allowApiToken?: boolean
  }
): Promise<AuthContext | NextResponse> {
  const authContext = await requireAuth(req, options)

  if (!authContext) {
    return unauthorizedResponse()
  }

  return authContext
}

/**
 * Verifies that a resource belongs to the user
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param resourceId - Resource ID to verify
 * @param userId - User ID to verify against
 * @param selectFields - Fields to select (default: 'id, user_id')
 * @returns Resource data if found and owned, null otherwise
 */
export async function verifyResourceOwnership<T = any>(
  supabase: any,
  table: string,
  resourceId: string,
  userId: string,
  selectFields: string = 'id, user_id'
): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select(selectFields)
    .eq('id', resourceId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data as T
}


