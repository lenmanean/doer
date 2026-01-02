/**
 * Server-side structured logger for audit logging
 * Provides structured logging with error taxonomy for account deletion and other server operations
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogData {
  [key: string]: any
}

interface StructuredLog {
  level: LogLevel
  event: string
  userId?: string
  stripeCustomerId?: string | null
  step?: string
  status?: 'started' | 'completed' | 'failed'
  error?: {
    message: string
    code?: string
    stack?: string
    stripeError?: any
  }
  metadata?: Record<string, any>
  timestamp: string
}

class ServerLogger {
  private log(level: LogLevel, event: string, data: LogData = {}) {
    const logEntry: StructuredLog = {
      level,
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }

    // Mask sensitive data
    if (logEntry.metadata) {
      logEntry.metadata = this.maskSensitiveData(logEntry.metadata)
    }

    // Log to console (Vercel will capture this)
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    consoleMethod(`[${level.toUpperCase()}] ${event}`, JSON.stringify(logEntry, null, 2))

    // TODO: Send to Sentry for errors (if configured)
    if (level === 'error' && typeof process !== 'undefined' && process.env.SENTRY_DSN) {
      // Sentry integration can be added here
    }
  }

  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    const masked = { ...data }
    const sensitiveKeys = ['secret', 'key', 'password', 'token', 'authorization', 'stripe_secret_key']
    
    for (const key of Object.keys(masked)) {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        masked[key] = '[REDACTED]'
      }
    }
    
    return masked
  }

  error(event: string, data: LogData = {}) {
    this.log('error', event, data)
  }

  warn(event: string, data: LogData = {}) {
    this.log('warn', event, data)
  }

  info(event: string, data: LogData = {}) {
    this.log('info', event, data)
  }

  debug(event: string, data: LogData = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', event, data)
    }
  }

  /**
   * Log account deletion event with structured format
   */
  logAccountDeletion(
    step: 'subscription_cancel' | 'payment_method_detach' | 'customer_delete' | 'db_cleanup' | 'auth_delete',
    status: 'started' | 'completed' | 'failed',
    data: {
      userId: string
      stripeCustomerId?: string | null
      error?: Error | { message: string; code?: string; stripeError?: any }
      metadata?: Record<string, any>
    }
  ) {
    const logData: LogData = {
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId,
      step,
      status,
      metadata: data.metadata,
    }

    if (data.error) {
      logData.error = {
        message: data.error instanceof Error ? data.error.message : data.error.message,
        code: data.error instanceof Error ? undefined : data.error.code,
        stack: data.error instanceof Error ? data.error.stack : undefined,
        stripeError: data.error instanceof Error ? undefined : data.error.stripeError,
      }
    }

    const level = status === 'failed' ? 'error' : status === 'completed' ? 'info' : 'info'
    this.log(level, 'account_deletion', logData)
  }
}

// Export singleton instance
export const serverLogger = new ServerLogger()

// Export convenience functions
export const logError = (event: string, data?: LogData) => serverLogger.error(event, data)
export const logWarn = (event: string, data?: LogData) => serverLogger.warn(event, data)
export const logInfo = (event: string, data?: LogData) => serverLogger.info(event, data)
export const logDebug = (event: string, data?: LogData) => serverLogger.debug(event, data)

