import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const url = new URL(req.url)
  const pathname = url.pathname

  // Check for static assets FIRST, before any other processing
  // This includes video and audio files from the public directory
  const isStaticAsset = pathname.startsWith('/_next/') || 
                        pathname.startsWith('/favicon') ||
                        pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|mp4|webm|ogg|mp3|wav|mov|avi)$/i)

  // If it's a static asset, return immediately with proper headers
  if (isStaticAsset) {
    // Add proper headers for video files
    if (pathname.match(/\.(mp4|webm|ogg|mov|avi)$/i)) {
      const response = NextResponse.next()
      response.headers.set('Content-Type', pathname.endsWith('.mp4') ? 'video/mp4' : 
                          pathname.endsWith('.webm') ? 'video/webm' : 
                          pathname.endsWith('.ogg') ? 'video/ogg' : 'video/quicktime')
      response.headers.set('Accept-Ranges', 'bytes')
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return response
    }
    return NextResponse.next()
  }

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Accept: 'application/json' },
      },
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/', // Homepage
    '/landing',
    '/login',
    '/pricing',
    '/features',
    '/about-us',
    '/blog',
    '/careers',
    '/changelog',
    // '/community', // Temporarily disabled until multi-user functionality is implemented
    '/contact',
    '/documentation',
    '/feature-request',
    '/help',
    '/privacy',
    '/responsible-use',
    '/roadmap',
    '/security',
    '/solutions',
    '/terms',
    '/integrations', // Public integrations page
    '/checkout', // Checkout page
    '/health', // Health check
    '/motion-graphics-brief', // Motion graphics brief page (public, no auth required)
    '/affiliates', // Affiliate program page (public)
    '/report-misuse', // Report misuse page (public, for abuse reporting)
    '/early-access', // Cold ads landing page (public)
    '/start', // Landing page for ad campaigns (public)
  ]

  // Redirect /community to dashboard (temporarily disabled until multi-user functionality is implemented)
  if (pathname === '/community' || pathname.startsWith('/community/')) {
    const redirectUrl = new URL('/dashboard', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Allow public routes
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )
  
  // Allow auth routes (signup, callback, etc.)
  const isAuthRoute = pathname.startsWith('/auth/')
  
  // Allow API routes
  const isApiRoute = pathname.startsWith('/api/')

  // If it's a public route, auth route, or API route, allow access
  if (isPublicRoute || isAuthRoute || isApiRoute) {
    return res
  }

  // For protected routes (dashboard, settings, onboarding, etc.), check authentication
  let user = null as any
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) user = data?.user ?? null
  } catch {
    user = null
  }

  // If not authenticated, redirect to login for protected routes
  if (!user) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Check if account is scheduled for deletion
  // Allow access to restore page even if scheduled for deletion
  if (pathname !== '/account/restore') {
    try {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('scheduled_deletion_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (userSettings?.scheduled_deletion_at) {
        const deletionDate = new Date(userSettings.scheduled_deletion_at)
        const now = new Date()
        
        // If deletion date is in the future, redirect to restore page
        if (deletionDate > now) {
          const restoreUrl = new URL('/account/restore', req.url)
          return NextResponse.redirect(restoreUrl)
        }
        // If deletion date has passed, allow normal flow (cron should have deleted, but handle gracefully)
      }
    } catch (error) {
      // If error checking scheduled deletion, allow normal flow
      // Log error but don't block user access
      console.error('Error checking scheduled deletion in middleware:', error)
    }
  }

  // Authenticated user, allow access to protected routes
  return res
}

export const config = {
  matcher: [
    // Exclude static files, Next.js internals, and public assets from middleware
    // Use non-capturing group (?:...) instead of capturing group (...) for file extensions
    '/((?!_next/static|_next/image|favicon.ico|auth|api|.*\\.(?:ico|png|jpg|jpeg|svg|webp|css|js|mp4|webm|ogg|mp3|wav|mov|avi)$).*)',
  ],
}
