/**
 * Encryption utilities for calendar OAuth tokens
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100000
const PBKDF2_KEY_LENGTH = 32

function getEncryptionKey(): Buffer {
  const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY environment variable must be set')
  }
  
  // Derive key from secret using PBKDF2
  const salt = Buffer.from(secret.substring(0, 16), 'utf8')
  return pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, 'sha256')
}

/**
 * Encrypt a token for storage in the database
 */
export function encryptToken(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    throw new Error(`Failed to encrypt token: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt a token from the database
 */
export function decryptToken(encryptedData: string): string {
  try {
    const key = getEncryptionKey()
    const parts = encryptedData.split(':')
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format')
    }
    
    const [ivHex, authTagHex, encrypted] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    throw new Error(`Failed to decrypt token: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}


