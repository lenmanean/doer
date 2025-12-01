import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
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

  const url = new URL(req.url)
  const pathname = url.pathname

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
    '/community',
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
  ]

  // Allow public routes
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )
  
  // Allow auth routes (signup, callback, etc.)
  const isAuthRoute = pathname.startsWith('/auth/')
  
  // Allow API routes
  const isApiRoute = pathname.startsWith('/api/')
  
  // Allow static assets
  const isStaticAsset = pathname.startsWith('/_next/') || 
                        pathname.startsWith('/favicon') ||
                        pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js)$/)

  // If it's a public route, auth route, API route, or static asset, allow access
  if (isPublicRoute || isAuthRoute || isApiRoute || isStaticAsset) {
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

  // Authenticated user, allow access to protected routes
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth|api).*)',
  ],
}
