/**
 * Shared utilities for calendar providers
 * Common OAuth state generation, token handling, etc.
 */

import { encryptToken, decryptToken } from '../encryption'
import type { Tokens } from './base-provider'

/**
 * Generate OAuth state parameter with user ID for security
 */
export function generateOAuthState(userId: string): string {
  return Buffer.from(JSON.stringify({ userId })).toString('base64')
}

/**
 * Verify and decode OAuth state parameter
 */
export function verifyOAuthState(state: string, expectedUserId: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
    return decoded.userId === expectedUserId
  } catch {
    return false
  }
}

/**
 * Encrypt tokens for storage
 */
export function encryptTokens(tokens: Tokens): {
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  expiresAt: string
} {
  return {
    accessTokenEncrypted: encryptToken(tokens.access_token),
    refreshTokenEncrypted: encryptToken(tokens.refresh_token),
    expiresAt: new Date(tokens.expiry_date).toISOString(),
  }
}

/**
 * Decrypt tokens from storage
 */
export function decryptTokens(
  accessTokenEncrypted: string,
  refreshTokenEncrypted: string
): {
  access_token: string
  refresh_token: string
} {
  return {
    access_token: decryptToken(accessTokenEncrypted),
    refresh_token: decryptToken(refreshTokenEncrypted),
  }
}

