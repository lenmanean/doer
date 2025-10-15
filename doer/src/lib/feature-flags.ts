// Feature flags for DOER.AI
export const FEATURE_FLAGS = {
  MEDIA_UPLOAD: true,
  CALENDAR_INTEGRATION: true,
  ANALYTICS: true,
  USER_AUTHENTICATION: true,
} as const

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

