/**
 * Route detection utilities for determining public vs authenticated routes
 */

/**
 * Authenticated routes that require user login
 * These routes should use user theme preferences from database
 * 
 * Note: This list should match routes protected by middleware.ts
 * (i.e., routes NOT in the publicRoutes array in middleware)
 */
const AUTHENTICATED_ROUTES = [
  '/dashboard',
  '/schedule',
  '/settings',
  '/onboarding',
  '/analytics',
  '/data', // Redirects to /analytics, but still authenticated
  '/internal', // Internal pages (may have additional auth checks)
  '/test', // Test pages (dev only, but authenticated)
  '/integrations', // Uses authenticated UI (Sidebar, useOnboardingProtection)
  // '/community', // Temporarily disabled until multi-user functionality is implemented
  '/help', // Uses authenticated UI (Sidebar, useOnboardingProtection)
]

/**
 * Check if a given pathname is an authenticated route
 * @param pathname - The pathname to check (e.g., '/dashboard', '/settings')
 * @returns true if the pathname is an authenticated route
 */
export function isAuthenticatedRoute(pathname: string): boolean {
  if (!pathname) return false
  return AUTHENTICATED_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Check if a given pathname is a public route
 * @param pathname - The pathname to check (e.g., '/', '/login', '/pricing')
 * @returns true if the pathname is a public route
 */
export function isPublicRoute(pathname: string): boolean {
  if (!pathname) return true
  return !isAuthenticatedRoute(pathname)
}
