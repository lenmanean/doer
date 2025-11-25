import { NextRequest, NextResponse } from 'next/server'

import { generateApiToken } from '@/lib/auth/api-token-auth'
import type { ApiTokenScope } from '@/lib/billing/plans'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

const ALL_SCOPES: ApiTokenScope[] = [
  'plans.generate',
  'plans.read',
  'plans.schedule',
  'clarify',
  'reschedules',
  'integrations',
  'admin',
]

const DEFAULT_SCOPES: ApiTokenScope[] = ['plans.generate', 'plans.read', 'clarify']

function coerceScopes(scopes: unknown): ApiTokenScope[] {
  if (!Array.isArray(scopes)) return DEFAULT_SCOPES
  const valid = scopes.filter((scope): scope is ApiTokenScope => ALL_SCOPES.includes(scope as ApiTokenScope))
  return valid.length > 0 ? valid : DEFAULT_SCOPES
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('api_tokens')
    .select('id, name, description, scopes, created_at, last_used_at, expires_at, metadata')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[API Tokens] Failed to list tokens:', error)
    return NextResponse.json({ error: 'Failed to list API tokens' }, { status: 500 })
  }

  return NextResponse.json({
    tokens: data ?? [],
    metadata: {
      availableScopes: ALL_SCOPES,
      defaultScopes: DEFAULT_SCOPES,
    },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null)

  const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
  const description =
    typeof payload?.description === 'string' && payload.description.trim().length > 0
      ? payload.description.trim()
      : null
  const scopes = coerceScopes(payload?.scopes)
  const expiresAt =
    typeof payload?.expiresAt === 'string' && payload.expiresAt ? new Date(payload.expiresAt) : null

  if (!name) {
    return NextResponse.json({ error: 'Token name is required' }, { status: 400 })
  }

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: 'expiresAt must be a valid ISO date string' }, { status: 400 })
  }

  const tokenMaterial = generateApiToken()

  const { error: insertError } = await supabase.from('api_tokens').insert({
    id: tokenMaterial.id,
    user_id: user.id,
    name,
    description,
    scopes,
    secret_salt: tokenMaterial.salt,
    token_hash: tokenMaterial.hash,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
  })

  if (insertError) {
    console.error('[API Tokens] Failed to create token:', insertError)
    return NextResponse.json(
      { error: 'Failed to create API token', details: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      token: tokenMaterial.token,
      token_id: tokenMaterial.id,
      scopes,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    },
    { status: 201 }
  )
}




