/**
 * Client-side password security utilities
 */

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


