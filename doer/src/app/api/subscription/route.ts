import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchActiveSubscription } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscription
 * Returns the active subscription for the authenticated user
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
    
    // Fetch active subscription using service role client (server-side only)
    const subscription = await fetchActiveSubscription(user.id)
    
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

