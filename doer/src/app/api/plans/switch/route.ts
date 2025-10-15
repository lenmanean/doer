import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/plans/switch
 * Switches the active plan for the authenticated user
 * Body: { plan_id: string }
 */
export async function POST(req: NextRequest) {
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
    
    // Parse request body
    const body = await req.json()
    const { plan_id } = body
    
    if (!plan_id) {
      return NextResponse.json(
        { error: 'plan_id is required' },
        { status: 400 }
      )
    }
    
    // Call RPC function to switch active plan
    const { data: result, error: switchError } = await supabase
      .rpc('switch_active_plan', {
        p_user_id: user.id,
        p_new_plan_id: plan_id
      })
    
    if (switchError) {
      console.error('Error switching active plan:', switchError)
      return NextResponse.json(
        { error: 'Failed to switch plan', details: switchError.message },
        { status: 500 }
      )
    }
    
    // Check if RPC function returned success
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to switch plan' },
        { status: 400 }
      )
    }
    
    // Fetch the updated plan data
    const { data: newActivePlan, error: fetchError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('user_id', user.id)
      .single()
    
    if (fetchError) {
      console.error('Error fetching updated plan:', fetchError)
      return NextResponse.json(
        { error: 'Plan switched but failed to fetch updated data', details: fetchError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Active plan switched successfully',
      plan: newActivePlan,
      previous_active_plan_id: result.previous_active_plan_id
    }, { status: 200 })
    
  } catch (err) {
    console.error('Switch Plan Error:', err)
    return NextResponse.json(
      { error: 'Unexpected error while switching plan' },
      { status: 500 }
    )
  }
}







