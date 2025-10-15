import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/plans/archive
 * Archives a plan for the authenticated user
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
    
    // Call RPC function to archive plan
    const { data: result, error: archiveError } = await supabase
      .rpc('archive_plan', {
        p_user_id: user.id,
        p_plan_id: plan_id
      })
    
    if (archiveError) {
      console.error('Error archiving plan:', archiveError)
      return NextResponse.json(
        { error: 'Failed to archive plan', details: archiveError.message },
        { status: 500 }
      )
    }
    
    // Check if RPC function returned success
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to archive plan' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Plan archived successfully',
      plan_id: result.plan_id,
      was_active: result.was_active,
      archived_at: result.archived_at
    }, { status: 200 })
    
  } catch (err) {
    console.error('Archive Plan Error:', err)
    return NextResponse.json(
      { error: 'Unexpected error while archiving plan' },
      { status: 500 }
    )
  }
}







