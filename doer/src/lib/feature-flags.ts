// Feature flags for DOER.AI
export const FEATURE_FLAGS = {
  MEDIA_UPLOAD: true,
  CALENDAR_INTEGRATION: true,
  ANALYTICS: true,
  USER_AUTHENTICATION: true,
  
  // Launch status - controlled by environment variable
  // Set NEXT_PUBLIC_APP_LAUNCH_STATUS=pre-launch or post-launch
  // Defaults to pre-launch if not set
  IS_LAUNCHED: process.env.NEXT_PUBLIC_APP_LAUNCH_STATUS === 'post-launch',
} as const

// Convenience getters for launch status
export const IS_PRE_LAUNCH = !FEATURE_FLAGS.IS_LAUNCHED
export const IS_POST_LAUNCH = FEATURE_FLAGS.IS_LAUNCHED

export function validateCoreFeatures() {
  const requiredFeatures = [
    'MEDIA_UPLOAD',
    'USER_AUTHENTICATION'
  ]
  
  const missingFeatures = requiredFeatures.filter(
    feature => !FEATURE_FLAGS[feature as keyof typeof FEATURE_FLAGS]
  )
  
  if (missingFeatures.length > 0) {
    console.warn('Missing core features:', missingFeatures)
  }
  
  return missingFeatures.length === 0
}

