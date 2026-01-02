import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIfUserHadProBefore } from '@/lib/billing/plans'

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

    // Use the helper function which already handles the query correctly
    const hasHadProBefore = await checkIfUserHadProBefore(user.id)

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

