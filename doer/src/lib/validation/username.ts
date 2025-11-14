const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/

export interface UsernameValidationResult {
  valid: boolean
  message?: string
}

export function normalizeUsername(input: string): string {
  return input.trim()
}

export function validateUsername(username: string): UsernameValidationResult {
  const value = normalizeUsername(username)

  if (value.length === 0) {
    return { valid: false, message: 'Username is required' }
  }

  if (value.length < 3 || value.length > 20) {
    return {
      valid: false,
      message: 'Username must be between 3 and 20 characters long',
    }
  }

  if (!USERNAME_REGEX.test(value)) {
    return {
      valid: false,
      message:
        'Username can only contain letters, numbers, underscores, and hyphens',
    }
  }

  return { valid: true }
}

export function getUsernameCooldownEnds(lastChangedAt: string | null) {
  if (!lastChangedAt) return null
  const expires = new Date(lastChangedAt)
  expires.setHours(expires.getHours() + 24)
  return expires
}

