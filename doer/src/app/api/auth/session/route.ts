import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * Synchronize Supabase auth session between client and server cookies.
 * The client calls this endpoint on every auth state change so that
 * server-side routes can read the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const { event, session } = await request.json()
    const supabase = await createClient()

    console.log('[api/auth/session] syncing event:', event, 'user:', session?.user?.id ?? 'none')

    switch (event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
      case 'USER_UPDATED':
        if (!session) {
          return NextResponse.json({ error: 'Session payload missing' }, { status: 400 })
        }
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
        break
      case 'SIGNED_OUT':
      case 'USER_DELETED':
        await supabase.auth.signOut()
        break
      default:
        // No action needed for INITIAL_SESSION or other events
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/auth/session] Failed to sync auth session', error)
    return NextResponse.json({ error: 'Failed to sync auth session' }, { status: 500 })
  }
}

