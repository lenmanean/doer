import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveSubscriptionFromStripe } from '@/lib/stripe/subscriptions'

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * GET /api/subscription/check
 * Checks if the authenticated user has a basic plan subscription
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

    // Get active subscription from Stripe
    try {
      const subscription = await getActiveSubscriptionFromStripe(user.id)
      
      if (!subscription) {
        // No subscription = basic plan (default)
        return NextResponse.json({
          hasBasicPlan: true,
          planSlug: 'basic',
        })
      }

      return NextResponse.json({
        hasBasicPlan: subscription.planSlug === 'basic',
        planSlug: subscription.planSlug,
      })
    } catch (error) {
      // If we can't fetch subscription, assume basic plan
      console.error('[Subscription Check] Error fetching subscription:', error)
      return NextResponse.json({
        hasBasicPlan: true,
        planSlug: 'basic',
      })
    }
  } catch (error) {
    console.error('[Subscription Check] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check subscription' },
      { status: 500 }
    )
  }
}

