import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscription/trial-eligibility
 * Checks if the authenticated user has ever had a Pro subscription before
 * Returns true if user is eligible for trial (has never had Pro), false otherwise
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

    // Query user_plan_subscriptions to check for any historical Pro subscriptions
    // We need to join with billing_plan_cycles and billing_plans to check the plan slug
    const { data: subscriptions, error } = await supabase
      .from('user_plan_subscriptions')
      .select(`
        id,
        billing_plan_cycles!inner (
          billing_plan:billing_plans!inner (
            slug
          )
        )
      `)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Trial Eligibility] Error querying subscriptions:', error)
      // On error, assume user is eligible (fail open - allow trial)
      // This is safer than blocking legitimate users due to query errors
      return NextResponse.json({
        eligible: true,
        hasHadProBefore: false,
        error: 'Could not verify subscription history, assuming eligible',
      })
    }

    // Check if any subscription was for a Pro plan
    const hasHadProBefore = subscriptions?.some(sub => 
      sub.billing_plan_cycles?.billing_plan?.slug === 'pro'
    ) || false

    return NextResponse.json({
      eligible: !hasHadProBefore,
      hasHadProBefore,
    })
    
  } catch (error) {
    console.error('[Trial Eligibility] Error:', error)
    // On error, assume user is eligible (fail open)
    return NextResponse.json({
      eligible: true,
      hasHadProBefore: false,
      error: 'Could not verify subscription history, assuming eligible',
    })
  }
}

