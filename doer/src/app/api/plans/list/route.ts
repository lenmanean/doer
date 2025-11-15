import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/plans/list
 * Returns all plans for the authenticated user
 * Sorted by: active first, then by created_at DESC
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
      console.warn('[api/plans/list] Unauthorized request', {
        error: userError?.message,
      })
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }
    
    // Use RPC function to get all plans with summary data
    const { data: plansJson, error: plansError } = await supabase
      .rpc('get_user_plans', { p_user_id: user.id })
    
    if (plansError) {
      console.error('Error fetching user plans:', plansError)
      return NextResponse.json(
        { error: 'Failed to fetch plans', details: plansError.message },
        { status: 500 }
      )
    }
    
    // Parse JSON response from RPC function
    const plans = plansJson || []
    
    console.log('[api/plans/list] Returning plans for user', user.id, 'count:', plans.length)
    return NextResponse.json({
      success: true,
      plans,
      count: plans.length
    }, { status: 200 })
    
  } catch (err) {
    console.error('List Plans Error:', err)
    return NextResponse.json(
      { error: 'Unexpected error while fetching plans' },
      { status: 500 }
    )
  }
}








