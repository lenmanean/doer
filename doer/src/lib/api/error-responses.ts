/**
 * Standardized API Error Responses
 * 
 * Provides consistent error responses across all API routes.
 * This ensures uniform error handling and prevents information leakage.
 */

import { NextResponse } from 'next/server'

/**
 * Standard error response structure
 */
export interface ApiError {
  error: string
  message?: string
  details?: string
}

/**
 * Returns a 401 Unauthorized response
 * Use when user is not authenticated
 */
export function unauthorizedResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      ...(message && { message }),
    } as ApiError,
    { status: 401 }
  )
}

/**
 * Returns a 403 Forbidden response
 * Use when user is authenticated but lacks permission
 */
export function forbiddenResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      ...(message && { message }),
    } as ApiError,
    { status: 403 }
  )
}

/**
 * Returns a 404 Not Found response
 * Use when resource is not found or access denied
 */
export function notFoundResponse(resource?: string): NextResponse {
  const message = resource
    ? `${resource} not found or access denied`
    : 'Resource not found or access denied'
  
  return NextResponse.json(
    {
      error: 'Not Found',
      message,
    } as ApiError,
    { status: 404 }
  )
}

/**
 * Returns a 400 Bad Request response
 * Use when request is invalid or malformed
 */
export function badRequestResponse(message: string, details?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Bad Request',
      message,
      ...(details && { details }),
    } as ApiError,
    { status: 400 }
  )
}

/**
 * Returns a 500 Internal Server Error response
 * Use for unexpected server errors
 */
export function internalServerErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Internal Server Error',
      ...(message && { message }),
    } as ApiError,
    { status: 500 }
  )
}

/**
 * Returns a 429 Too Many Requests response
 * Use when rate limit is exceeded
 */
export function rateLimitExceededResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Rate Limit Exceeded',
      ...(message && { message }),
    } as ApiError,
    { status: 429 }
  )
}

/**
 * Returns a success response with data
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}


