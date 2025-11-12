import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'crypto'

import type { ApiTokenScope, UsageMetric } from '@/lib/billing/plans'
import { CreditService } from '@/lib/usage/credit-service'
import { getServiceRoleClient } from '@/lib/supabase/service-role'

const TOKEN_PREFIX = 'doer'
const TOKEN_SECRET_BYTES = 32
const PBKDF2_ITERATIONS = 210_000
const PBKDF2_KEY_LENGTH = 32

export class ApiTokenError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

type ApiTokenRow = {
  id: string
  user_id: string
  secret_salt: string
  token_hash: string
  scopes: ApiTokenScope[] | null
  expires_at: string | null
  revoked_at: string | null
  billing_plan_cycle_id: string | null
  metadata?: Record<string, unknown> | null
}

export interface ApiAuthOptions {
  requiredScopes?: ApiTokenScope[]
}

export interface ApiAuthContext {
  tokenId: string
  userId: string
  scopes: ApiTokenScope[]
  expiresAt: string | null
  metadata?: Record<string, unknown>
  creditService: CreditService
}

function getPepper(): string {
  const value = process.env.API_TOKEN_HASH_PEPPER
  if (!value) {
    throw new Error('API_TOKEN_HASH_PEPPER environment variable must be set')
  }
  return value
}

function hashSecret(secret: string, saltB64: string) {
  const salt = Buffer.from(saltB64, 'base64')
  const pepper = getPepper()
  return pbkdf2Sync(
    `${secret}${pepper}`,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    'sha256'
  ).toString('hex')
}

function parseAuthorization(headerValue: string | null) {
  if (!headerValue) {
    throw new ApiTokenError('Authorization header missing')
  }

  const [scheme, token] = headerValue.split(' ')
  if (!token || scheme.toLowerCase() !== 'bearer') {
    throw new ApiTokenError('Authorization header must use Bearer scheme')
  }

  const segments = token.split('.')
  if (segments.length !== 3) {
    throw new ApiTokenError('API token is malformed')
  }

  const [prefix, tokenId, secret] = segments
  if (prefix !== TOKEN_PREFIX || !tokenId || !secret) {
    throw new ApiTokenError('API token has invalid format')
  }

  return { tokenId, secret }
}

function timingSafeHashCompare(expectedHex: string, candidateHex: string) {
  const expected = Buffer.from(expectedHex, 'hex')
  const candidate = Buffer.from(candidateHex, 'hex')

  if (expected.length !== candidate.length) {
    return false
  }

  return timingSafeEqual(expected, candidate)
}

export async function authenticateApiRequest(
  headers: Headers,
  options: ApiAuthOptions = {}
): Promise<ApiAuthContext> {
  const { tokenId, secret } = parseAuthorization(headers.get('authorization'))
  const supabase = getServiceRoleClient()

  const { data, error } = await supabase
    .from('api_tokens')
    .select(
      'id, user_id, secret_salt, token_hash, scopes, expires_at, revoked_at, billing_plan_cycle_id, metadata'
    )
    .eq('id', tokenId)
    .limit(1)
    .maybeSingle<ApiTokenRow>()

  if (error) {
    throw new ApiTokenError(`Token lookup failed: ${error.message}`, 500)
  }
  if (!data) {
    throw new ApiTokenError('API token is invalid')
  }
  if (data.revoked_at) {
    throw new ApiTokenError('API token has been revoked')
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new ApiTokenError('API token has expired')
  }

  const candidateHash = hashSecret(secret, data.secret_salt)
  const matches = timingSafeHashCompare(data.token_hash, candidateHash)
  if (!matches) {
    throw new ApiTokenError('API token verification failed')
  }

  const scopes = data.scopes ?? []
  if (options.requiredScopes?.length) {
    const missing = options.requiredScopes.filter((scope) => !scopes.includes(scope))
    if (missing.length > 0) {
      throw new ApiTokenError(`Missing required scopes: ${missing.join(', ')}`, 403)
    }
  }

  const creditService = new CreditService(data.user_id, data.id)
  await creditService.getSubscription()

  void supabase
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return {
    tokenId: data.id,
    userId: data.user_id,
    scopes,
    expiresAt: data.expires_at,
    metadata: data.metadata ?? undefined,
    creditService,
  }
}

export function generateApiToken(): {
  token: string
  secret: string
  salt: string
  id: string
  hash: string
} {
  const id = randomUUID()
  const secret = randomBytes(TOKEN_SECRET_BYTES).toString('base64url')
  const salt = randomBytes(16).toString('base64')
  const hash = hashSecret(secret, salt)
  const token = `${TOKEN_PREFIX}.${id}.${secret}`

  return { token, secret, salt, id, hash }
}

export function hashTokenSecret(secret: string, salt: string): string {
  return hashSecret(secret, salt)
}

export function assertScopes(scopes: ApiTokenScope[], required: ApiTokenScope[]) {
  const missing = required.filter((scope) => !scopes.includes(scope))
  if (missing.length > 0) {
    throw new ApiTokenError(`Missing required scopes: ${missing.join(', ')}`, 403)
  }
}

export function metricFromScope(scope: ApiTokenScope): UsageMetric | null {
  if (scope === 'integrations') {
    return 'integration_actions'
  }
  if (
    scope === 'plans.generate' ||
    scope === 'clarify' ||
    scope === 'plans.schedule' ||
    scope === 'reschedules'
  ) {
    return 'api_credits'
  }
  return null
}


