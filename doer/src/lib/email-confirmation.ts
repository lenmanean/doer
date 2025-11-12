import { User } from '@supabase/supabase-js'

/**
 * Check if a user's email is confirmed
 * @param user - Supabase user object
 * @returns true if email is confirmed, false otherwise
 */
export function isEmailConfirmed(user: User | null): boolean {
  if (!user) {
    return false
  }
  
  // Check if email_confirmed_at exists and is not null/undefined
  const confirmed = user.email_confirmed_at !== null && user.email_confirmed_at !== undefined
  
  // Debug logging (remove in production if desired)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Email Confirmation]', {
      userId: user.id,
      email: user.email,
      confirmed,
      email_confirmed_at: user.email_confirmed_at
    })
  }
  
  return confirmed
}

/**
 * Get email confirmation status message
 * @param user - Supabase user object
 * @returns status message
 */
export function getEmailConfirmationStatus(user: User | null): {
  confirmed: boolean
  message: string
} {
  if (!user) {
    return {
      confirmed: false,
      message: 'User not found'
    }
  }

  if (isEmailConfirmed(user)) {
    return {
      confirmed: true,
      message: 'Email confirmed'
    }
  }

  return {
    confirmed: false,
    message: 'Email not confirmed. Please check your inbox for the confirmation code.'
  }
}

