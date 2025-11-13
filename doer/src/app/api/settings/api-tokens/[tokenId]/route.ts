import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type Params = {
  tokenId: string
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
  }

  const tokenId = params.tokenId
  if (!tokenId) {
    return NextResponse.json({ error: 'Token ID is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[API Tokens] Failed to revoke token:', error)
    return NextResponse.json({ error: 'Failed to revoke API token' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'API token not found or already revoked' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}






