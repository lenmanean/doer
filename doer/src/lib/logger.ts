/**
 * Structured logging utility
 * Provides consistent logging across the application with proper log levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private getLogLevel(): LogLevel {
    const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development'
    const logLevel = process.env.LOG_LEVEL?.toLowerCase()
    
    if (logLevel && ['debug', 'info', 'warn', 'error'].includes(logLevel)) {
      return logLevel as LogLevel
    }
    
    // Default: debug in development, warn in production
    return env === 'production' ? 'warn' : 'debug'
  }

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.getLogLevel()
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentIndex = levels.indexOf(currentLevel)
    const messageIndex = levels.indexOf(level)
    
    return messageIndex >= currentIndex
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext, error?: Error): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    const errorStr = error ? ` Error: ${error.message}${error.stack ? `\n${error.stack}` : ''}` : ''
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}${errorStr}`
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return
    }

    const formattedMessage = this.formatMessage(level, message, context, error)
    
    switch (level) {
      case 'debug':
        console.debug(formattedMessage)
        break
      case 'info':
        console.info(formattedMessage)
        break
      case 'warn':
        console.warn(formattedMessage)
        break
      case 'error':
        console.error(formattedMessage)
        break
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error)
  }
}

export const logger = new Logger()

