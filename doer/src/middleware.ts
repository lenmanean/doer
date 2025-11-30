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

  // Enforce admin-only site access
  const url = new URL(req.url)
  const pathname = url.pathname

  // Allow access to login and auth routes for everyone
  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/')
  const isAuthRoute = pathname.startsWith('/auth/')
  
  if (isLoginRoute || isAuthRoute) {
    return res
  }

  // For all other routes, check if user is admin
  let user = null as any
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) user = data?.user ?? null
  } catch {
    user = null
  }

  // If not authenticated, redirect to login
  if (!user) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated, check if username is "admin"
  try {
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('username')
      .eq('user_id', user.id)
      .single()

    // If no user_settings found or username is not "admin", redirect to login
    if (settingsError || !userSettings || userSettings.username !== 'admin') {
      const redirectUrl = new URL('/login', req.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // User is admin, allow access
    return res
  } catch (error) {
    // On error, redirect to login for safety
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth|api).*)',
  ],
}
