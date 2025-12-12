/**
 * Client-side logging utility that sends logs to the server
 * These logs will appear in Vercel's server logs
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogData {
  [key: string]: any
}

class ClientLogger {
  private isEnabled: boolean = true
  private logQueue: Array<{ level: LogLevel; message: string; data?: LogData }> = []
  private isProcessingQueue: boolean = false

  constructor() {
    // Always enabled - we want logs in production too
    this.isEnabled = true
  }

  private async sendLog(level: LogLevel, message: string, data?: LogData) {
    if (!this.isEnabled) return

    const logPayload = {
      level,
      message,
      data: {
        ...data,
        clientTimestamp: new Date().toISOString(),
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      timestamp: new Date().toISOString(),
    }

    try {
      // Send to server - use fire and forget to not block
      fetch('/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logPayload),
        // Don't wait for response - fire and forget
        keepalive: true,
      }).catch((err) => {
        // Only log errors in development to avoid console spam
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Logger] Failed to send log to server:', err)
        }
      })

      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
        consoleMethod(`[ClientLogger] ${message}`, data || '')
      }
    } catch (error) {
      // Silently fail - don't break the app
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Logger] Error sending log:', error)
      }
    }
  }

  error(message: string, data?: LogData) {
    this.sendLog('error', message, data)
  }

  warn(message: string, data?: LogData) {
    this.sendLog('warn', message, data)
  }

  info(message: string, data?: LogData) {
    this.sendLog('info', message, data)
  }

  debug(message: string, data?: LogData) {
    if (process.env.NODE_ENV === 'development') {
      this.sendLog('debug', message, data)
    }
  }
}

// Export singleton instance
export const logger = new ClientLogger()

// Export convenience functions
export const logError = (message: string, data?: LogData) => logger.error(message, data)
export const logWarn = (message: string, data?: LogData) => logger.warn(message, data)
export const logInfo = (message: string, data?: LogData) => logger.info(message, data)
export const logDebug = (message: string, data?: LogData) => logger.debug(message, data)
