import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

/**
 * Standard API error class with status code and error code
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Handle API errors and return standardized error responses
 */
export function handleApiError(error: unknown): NextResponse {
  // Generate correlation ID for error tracking
  const correlationId = randomUUID()

  if (error instanceof ApiError) {
    logger.error('API error', error, {
      correlationId,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details,
    })

    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          correlationId,
          ...(error.details && { details: error.details }),
        },
      },
      { status: error.statusCode }
    )
  }

  if (error instanceof Error) {
    logger.error('Unexpected error', error, { correlationId })

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          correlationId,
        },
      },
      { status: 500 }
    )
  }

  logger.error('Unknown error', new Error('Unknown error type'), { correlationId, error })

  return NextResponse.json(
    {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        correlationId,
      },
    },
    { status: 500 }
  )
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

