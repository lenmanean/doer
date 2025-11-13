import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Extract project ref from Supabase URL to determine cookie names
 * Supabase URLs are in format: https://<project-ref>.supabase.co
 */
function getSupabaseProjectRef(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null
  
  try {
    const url = new URL(supabaseUrl)
    // Extract project ref from hostname (e.g., "abc123xyz.supabase.co" -> "abc123xyz")
    const hostname = url.hostname
    const match = hostname.match(/^([^.]+)\.supabase\.co$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Get all Supabase-related cookie names
 * Supabase SSR uses: sb-<project-ref>-auth-token
 */
function getSupabaseCookieNames(projectRef: string | null): string[] {
  const cookieNames: string[] = []
  
  if (projectRef) {
    // Primary Supabase SSR cookie
    cookieNames.push(`sb-${projectRef}-auth-token`)
  }
  
  // Legacy/fallback cookie names (in case they exist)
  cookieNames.push(
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token'
  )
  
  return cookieNames
}

/**
 * Clear all cookies with proper domain and path attributes
 */
function clearAllCookies(response: NextResponse, request: NextRequest, cookieNames: string[]) {
  const host = request.headers.get('host') || ''
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Determine domain - use parent domain in production if needed
  let domain: string | undefined = undefined
  if (isProduction && host.includes('.')) {
    // Extract root domain (e.g., "usedoer.com" from "www.usedoer.com")
    const parts = host.split('.')
    if (parts.length >= 2) {
      domain = `.${parts.slice(-2).join('.')}`
    }
  }
  
  // Cookie options for clearing
  const clearOptions = {
    domain,
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
  }
  
  // Clear each cookie
  for (const cookieName of cookieNames) {
    // Clear with domain
    if (domain) {
      response.cookies.set(cookieName, '', clearOptions)
    }
    // Also clear without domain (for current subdomain)
    response.cookies.set(cookieName, '', {
      ...clearOptions,
      domain: undefined,
    })
    // Clear with path variations
    response.cookies.set(cookieName, '', {
      ...clearOptions,
      path: '/',
      domain: undefined,
    })
  }
  
  // Also clear all cookies that start with 'sb-'
  const cookieStore = cookies()
  try {
    const allCookies = cookieStore.getAll()
    for (const cookie of allCookies) {
      if (cookie.name.startsWith('sb-')) {
        response.cookies.set(cookie.name, '', clearOptions)
        if (domain) {
          response.cookies.set(cookie.name, '', { ...clearOptions, domain })
        }
      }
    }
  } catch {
    // Ignore errors when accessing cookies during SSR
  }
}

export async function POST(request: NextRequest) {
  try {
    console.error('[auth/signout] Server-side sign out requested')
    
    const supabase = await createClient()

    // Attempt to sign out - this should clear cookies via Supabase's built-in mechanism
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('[auth/signout] Supabase sign out failed:', error)
      // Still return success if the error is not critical (e.g., session already expired)
      // This prevents blocking the client-side sign out
      if (error.message?.includes('session') || error.message?.includes('invalid')) {
        console.warn('[auth/signout] Non-critical error (session may already be cleared), returning success')
      } else {
        // Log but continue with cookie clearing
        console.error('[auth/signout] Sign out error, but continuing with cookie cleanup:', error.message)
      }
    } else {
      console.error('[auth/signout] Supabase sign out successful')
    }

    // Create response
    const response = NextResponse.json({ success: true })
    
    // Get project ref to determine cookie names
    const projectRef = getSupabaseProjectRef()
    console.error('[auth/signout] Supabase project ref:', projectRef || 'not found')
    
    // Get all Supabase cookie names
    const cookieNames = getSupabaseCookieNames(projectRef)
    console.error('[auth/signout] Clearing cookies:', cookieNames)
    
    // Clear all Supabase-related cookies with proper attributes
    clearAllCookies(response, request, cookieNames)
    
    console.error('[auth/signout] Cookie clearing completed')
    
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[auth/signout] Unexpected error:', error)
    
    // Still try to clear cookies even on error
    try {
      const response = NextResponse.json({ success: true, warning: message })
      const projectRef = getSupabaseProjectRef()
      const cookieNames = getSupabaseCookieNames(projectRef)
      clearAllCookies(response, request, cookieNames)
      return response
    } catch {
      // Return success even on unexpected errors to avoid blocking client-side sign out
      return NextResponse.json({ success: true, warning: message })
    }
  }
}





