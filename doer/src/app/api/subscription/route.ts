import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubscriptionFromStripe } from '@/lib/stripe/subscriptions'
import { subscriptionCache } from '@/lib/cache/subscription-cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscription
 * Returns the active subscription for the authenticated user
 * Now queries Stripe directly as the source of truth (no database sync needed)
 * Query param 't' (timestamp) or 'refresh=true' will bypass cache
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }
    
    // Check if we should bypass cache (force refresh)
    const { searchParams } = new URL(req.url)
    const forceRefresh = searchParams.has('t') || searchParams.get('refresh') === 'true'
    
    if (forceRefresh) {
      // Invalidate cache for this user to force fresh fetch
      subscriptionCache.invalidateUser(user.id)
    }
    
    // Fetch active subscription directly from Stripe (source of truth)
    const subscription = await getActiveSubscriptionFromStripe(user.id)
    
    return NextResponse.json({
      success: true,
      subscription,
    }, { status: 200 })
    
  } catch (err) {
    console.error('Error fetching subscription:', err)
    return NextResponse.json(
      { error: 'Failed to fetch subscription', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

