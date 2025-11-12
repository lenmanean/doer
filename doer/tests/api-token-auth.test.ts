import { describe, expect, it, beforeAll } from '@jest/globals'

import { generateApiToken, hashTokenSecret } from '../src/lib/auth/api-token-auth'

describe('API token helpers', () => {
  beforeAll(() => {
    process.env.API_TOKEN_HASH_PEPPER = 'test-pepper'
  })

  it('creates deterministic hashes given the same secret and salt', () => {
    const secret = 'super-secret'
    const salt = 'WW91IGZvdW5kIG1lIQ==' // "You found me!" in base64

    const first = hashTokenSecret(secret, salt)
    const second = hashTokenSecret(secret, salt)

    expect(first).toEqual(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('generates tokens with expected shape and verifiable hash', () => {
    const { token, id, salt, hash } = generateApiToken()

    expect(token.startsWith('doer.')).toBe(true)
    expect(id).toBeDefined()

    const [, tokenId, secret] = token.split('.')
    expect(tokenId).toBe(id)

    const recomputed = hashTokenSecret(secret, salt)
    expect(recomputed).toEqual(hash)
  })
})
