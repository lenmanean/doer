/**
 * Client-side password security utilities
 */

export type PasswordStrengthLevel = 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'

export interface PasswordRequirements {
  length: boolean
  lowercase: boolean
  uppercase: boolean
  number: boolean
  specialChar: boolean
}

export interface PasswordStrength {
  score: number
  level: PasswordStrengthLevel
  requirements: PasswordRequirements
}

/**
 * Calculate password strength score and requirements
 * 
 * @param password - The password to analyze
 * @returns Object with strength score, level, and requirements checklist
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      level: 'weak',
      requirements: {
        length: false,
        lowercase: false,
        uppercase: false,
        number: false,
        specialChar: false
      }
    }
  }

  // Check requirements
  const requirements: PasswordRequirements = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    specialChar: /[^a-zA-Z0-9]/.test(password)
  }

  // Calculate score based on length (0-40 points)
  let lengthScore = 0
  if (password.length >= 17) {
    lengthScore = 40
  } else if (password.length >= 13) {
    lengthScore = 30
  } else if (password.length >= 9) {
    lengthScore = 20
  } else if (password.length >= 6) {
    lengthScore = 10
  }

  // Calculate character variety score (0-60 points)
  let varietyScore = 0
  if (requirements.lowercase) varietyScore += 10
  if (requirements.uppercase) varietyScore += 10
  if (requirements.number) varietyScore += 10
  if (requirements.specialChar) varietyScore += 10
  
  // Bonus for combinations (up to 20 points)
  const metRequirements = Object.values(requirements).filter(Boolean).length
  if (metRequirements >= 3) varietyScore += 10
  if (metRequirements >= 4) varietyScore += 10

  const totalScore = lengthScore + varietyScore

  // Determine strength level
  let level: PasswordStrengthLevel = 'weak'
  if (totalScore >= 86) {
    level = 'very-strong'
  } else if (totalScore >= 71) {
    level = 'strong'
  } else if (totalScore >= 51) {
    level = 'good'
  } else if (totalScore >= 31) {
    level = 'fair'
  }

  return {
    score: Math.min(100, totalScore),
    level,
    requirements
  }
}

/**
 * Validate password strength
 * 
 * @param password - The password to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validatePasswordStrength(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: 'Password is required' }
  }
  
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' }
  }
  
  if (password.length > 128) {
    return { isValid: false, error: 'Password must be less than 128 characters' }
  }
  
  return { isValid: true }
}

/**
 * Validate password
 * 
 * @param password - The password to validate
 * @returns Promise with validation result and error message if invalid
 */
export async function validatePassword(
  password: string
): Promise<{ isValid: boolean; error?: string }> {
  // Check password strength
  const strengthCheck = validatePasswordStrength(password)
  if (!strengthCheck.isValid) {
    return strengthCheck
  }
  
  return { isValid: true }
}


