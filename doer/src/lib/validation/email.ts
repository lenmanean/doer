const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i

export interface EmailValidationResult {
  valid: boolean
  message?: string
}

export function normalizeEmail(email: string): string {
  return email.trim()
}

export function validateEmail(email: string): EmailValidationResult {
  const value = normalizeEmail(email)

  if (value.length === 0) {
    return { valid: false, message: 'Email is required' }
  }

  if (!EMAIL_REGEX.test(value)) {
    return { valid: false, message: 'Please enter a valid email address' }
  }

  return { valid: true }
}

