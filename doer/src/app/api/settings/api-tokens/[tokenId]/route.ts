import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuthOrError } from '@/lib/api/auth-helpers'
import { badRequestResponse, notFoundResponse, internalServerErrorResponse, successResponse } from '@/lib/api/error-responses'
import { getUserResource } from '@/lib/supabase/query-helpers'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

type Params = {
  tokenId: string
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  try {
    // Authenticate user
    const authResult = await requireAuthOrError(req)
    if (authResult instanceof Response) {
      return authResult
    }
    const { user } = authResult

    const supabase = await createClient()
    const tokenId = params.tokenId

    if (!tokenId) {
      return badRequestResponse('Token ID is required')
    }

    // Verify token belongs to user before revoking
    const token = await getUserResource(
      supabase,
      'api_tokens',
      user.id,
      tokenId,
      'id'
    )

    if (!token) {
      return notFoundResponse('API token')
    }

    // Revoke the token
    const { error } = await supabase
      .from('api_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', tokenId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[API Tokens] Failed to revoke token:', error)
      return internalServerErrorResponse('Failed to revoke API token')
    }

    return successResponse({ success: true })
  } catch (error) {
    console.error('[API Tokens] Unexpected error:', error)
    return internalServerErrorResponse()
  }
}










