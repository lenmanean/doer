/**
 * Environment variable validation and configuration
 * Validates all required environment variables on startup
 */

interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  senderEmail: string
  senderName: string
}

interface EnvConfig {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  stripe: {
    secretKey: string
    webhookSecret: string
    priceBasic: string
  }
  openai: {
    apiKey: string
  }
  apiTokens: {
    hashSecret: string
  }
  email?: EmailConfig
}

/**
 * Validate and return environment configuration
 */
export function getEnvConfig(): EnvConfig {
  const required = {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      priceBasic: process.env.STRIPE_PRICE_BASIC,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    apiTokens: {
      hashSecret: process.env.API_TOKEN_HASH_SECRET,
    },
  }

  const emailCandidate: Partial<EmailConfig> = {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    senderEmail: process.env.EMAIL_SENDER_ADDRESS,
    senderName: process.env.EMAIL_SENDER_NAME,
  }

  const emailConfigured = Object.values(emailCandidate).every((value) => {
    if (typeof value === 'number') {
      return !Number.isNaN(value)
    }
    return Boolean(value)
  })

  const missing: string[] = []

  if (!required.supabase.url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!required.supabase.anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!required.supabase.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!required.stripe.secretKey) missing.push('STRIPE_SECRET_KEY')
  if (!required.stripe.webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET')
  if (!required.stripe.priceBasic) missing.push('STRIPE_PRICE_BASIC')
  if (!required.openai.apiKey) missing.push('OPENAI_API_KEY')
  if (!required.apiTokens.hashSecret) missing.push('API_TOKEN_HASH_SECRET')

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env.local file and ensure all required variables are set.'
    )
  }

  return {
    supabase: {
      url: required.supabase.url!,
      anonKey: required.supabase.anonKey!,
      serviceRoleKey: required.supabase.serviceRoleKey!,
    },
    stripe: {
      secretKey: required.stripe.secretKey!,
      webhookSecret: required.stripe.webhookSecret!,
      priceBasic: required.stripe.priceBasic!,
    },
    openai: {
      apiKey: required.openai.apiKey!,
    },
    apiTokens: {
      hashSecret: required.apiTokens.hashSecret!,
    },
    email: emailConfigured
      ? {
          smtpHost: emailCandidate.smtpHost!,
          smtpPort: emailCandidate.smtpPort!,
          smtpUser: emailCandidate.smtpUser!,
          smtpPassword: emailCandidate.smtpPassword!,
          senderEmail: emailCandidate.senderEmail!,
          senderName: emailCandidate.senderName!,
        }
      : undefined,
  }
}

/**
 * Validate environment variables (call this on app startup)
 */
export function validateEnv(): void {
  try {
    getEnvConfig()
  } catch (error) {
    console.error('Environment validation failed:', error)
    throw error
  }
}

